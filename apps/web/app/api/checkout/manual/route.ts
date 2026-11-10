import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getAuthenticatedUser, getUserClient } from "@/lib/insforge-server";
import {
  MANUAL_PAYMENT_CHANNELS,
  RECEIPT_ALLOWED_MIME,
  RECEIPT_BUCKET,
  RECEIPT_MAX_BYTES,
  buildReceiptPath,
  dbPaymentMethod,
  generatePaymentReference,
  type ManualPaymentChannel,
} from "@/lib/manual-payment";

// ==============================================================================
// BEEEJOY Manual Payment Checkout (bKash / Nagad / DBBL Bank Transfer)
//
// Replaces the browser-side order writes that used to build `ORD-<timestamp>`
// from Date.now(). Everything that decides money or review state is now
// server-authoritative:
//   - the unique payment reference (orders.order_number)
//   - mandatory Transaction ID *and* payment screenshot
//   - duplicate transaction_ref rejection before any row is written
//
// Orders are always created in 'pending_payment'. Moving an order to
// 'completed' is impossible from this route; the existing
// enforce_order_update_guard trigger blocks it for non-admins, and only the
// admin review endpoint (which calls verify_manual_payment) can grant access.
// ==============================================================================

const TRX_PATTERN = /^[A-Z0-9][A-Z0-9-]{5,39}$/;
const BD_MOBILE_PATTERN = /^(?:\+?8801|01)[3-9]\d{8}$/;

function normalizeMobile(raw: string): string {
  return raw.replace(/[\s()-]/g, "").replace(/^\+?880/, "0");
}

/**
 * Removes the rows/objects this request just created. Guarded by row
 * assertions so it can only ever touch the order it was handed.
 */
async function abandonOrder(
  adminDb: ReturnType<typeof getAdminClient>,
  orderId: string,
  customerId: string,
  receiptPath: string | null
) {
  try {
    if (receiptPath) {
      await adminDb.storage.from(RECEIPT_BUCKET).remove([receiptPath]).catch(() => {});
    }
    await adminDb.database
      .from("orders")
      .delete()
      .eq("id", orderId)
      .eq("customer_id", customerId)
      .eq("status", "pending_payment");
  } catch (cleanupErr) {
    // Cleanup is best-effort: the unique indexes still prevent double-crediting.
    console.warn("Checkout cleanup warning:", cleanupErr);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Sign in required to place an order." }, { status: 401 });
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
    }

    const productId = String(form.get("product_id") || "").trim();
    const channelRaw = String(form.get("payment_channel") || "").trim();
    const senderRaw = String(form.get("sender_identifier") || "").trim();
    const trxId = String(form.get("transaction_ref") || "").trim().toUpperCase();
    const notes = String(form.get("notes") || "").trim().slice(0, 500);
    const receipt = form.get("receipt");

    const paymentChannel = channelRaw as ManualPaymentChannel;
    if (!MANUAL_PAYMENT_CHANNELS.includes(paymentChannel)) {
      return NextResponse.json({ error: "Unsupported payment method." }, { status: 400 });
    }

    if (!productId || !/^[0-9a-fA-F-]{36}$/.test(productId)) {
      return NextResponse.json({ error: "A valid product is required." }, { status: 400 });
    }

    // --- Requirement: Transaction ID AND screenshot are both mandatory -------
    if (!TRX_PATTERN.test(trxId)) {
      return NextResponse.json(
        { error: "Enter a valid Transaction ID (6-40 letters/digits, no spaces)." },
        { status: 400 }
      );
    }

    const sender = normalizeMobile(senderRaw);
    if (paymentChannel === "bank") {
      if (!/^[0-9+ -]{6,34}$/.test(senderRaw) || sender.replace(/\D/g, "").length < 6) {
        return NextResponse.json({ error: "Enter the sender account number used for the transfer." }, { status: 400 });
      }
    } else if (!BD_MOBILE_PATTERN.test(sender)) {
      return NextResponse.json(
        { error: `Enter the 11-digit mobile number you sent the ${paymentChannel === "bkash" ? "bKash" : "Nagad"} payment from.` },
        { status: 400 }
      );
    }

    if (!(receipt instanceof File)) {
      return NextResponse.json(
        { error: "A payment screenshot (or deposit slip) is required." },
        { status: 400 }
      );
    }
    if (!RECEIPT_ALLOWED_MIME.includes(receipt.type)) {
      return NextResponse.json(
        { error: "Screenshot must be a PNG, JPG, WEBP, GIF or PDF." },
        { status: 400 }
      );
    }
    if (receipt.size === 0 || receipt.size > RECEIPT_MAX_BYTES) {
      return NextResponse.json(
        { error: "Screenshot must be between 1 byte and 8 MB." },
        { status: 400 }
      );
    }

    const adminDb = getAdminClient();
    const userDb = getUserClient(auth.token);

    // --- Server-authoritative product + price -------------------------------
    const { data: product, error: prodErr } = await adminDb.database
      .from("products")
      .select("id, title, slug, status, price_cents, currency, vendor_id")
      .eq("id", productId)
      .maybeSingle();

    if (prodErr) {
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }
    if (!product || product.status !== "published") {
      return NextResponse.json({ error: "This product is not available for purchase." }, { status: 404 });
    }
    if (!product.vendor_id) {
      return NextResponse.json({ error: "This product has no seller attached to it." }, { status: 400 });
    }

    // --- Duplicate Transaction ID rejection (DB unique index is the hard guard)
    // Every writer uppercases the reference, so an exact compare lines up with
    // the UPPER(TRIM(...)) unique index while staying free of LIKE escaping.
    const { data: clash, error: clashErr } = await adminDb.database
      .from("manual_payment_submissions")
      .select("id")
      .eq("payment_channel", paymentChannel)
      .eq("transaction_ref", trxId)
      .in("status", ["submitted", "verified"])
      .limit(1)
      .maybeSingle();

    if (clashErr) {
      return NextResponse.json({ error: clashErr.message }, { status: 500 });
    }
    if (clash) {
      return NextResponse.json(
        {
          error: "This Transaction ID has already been submitted for another order. Double submissions are not allowed.",
          code: "DUPLICATE_TRANSACTION_REF",
        },
        { status: 409 }
      );
    }

    // --- Unique payment reference + order -----------------------------------
    let order: any = null;
    let lastInsertError: any = null;

    for (let attempt = 0; attempt < 3 && !order; attempt++) {
      const orderNumber = generatePaymentReference();
      const { data, error } = await userDb.database
        .from("orders")
        .insert([
          {
            order_number: orderNumber,
            customer_id: auth.user.id,
            total_amount_cents: product.price_cents,
            currency: product.currency || "BDT",
            payment_method: dbPaymentMethod(paymentChannel),
            status: "pending_payment",
            notes: notes || null,
          },
        ])
        .select()
        .single();

      if (error) {
        lastInsertError = error;
        // Only a UNIQUE violation on order_number is worth retrying.
        const duplicateRef =
          /order_number|duplicate key|Unique/i.test(`${error.message || ""} ${JSON.stringify(error.details || "")}`);
        if (!duplicateRef) break;
        continue;
      }

      order = data;
    }

    if (!order) {
      return NextResponse.json(
        { error: lastInsertError?.message || "Could not create the order. Please try again." },
        { status: 500 }
      );
    }

    const reference = order.order_number as string;

    // --- Payment screenshot into the private bucket, server-owned path -------
    const receiptPath = buildReceiptPath(reference, receipt.type);
    if (!receiptPath) {
      await abandonOrder(adminDb, order.id, auth.user.id, null);
      return NextResponse.json({ error: "Unsupported screenshot format." }, { status: 400 });
    }

    const { error: uploadErr } = await adminDb.storage.from(RECEIPT_BUCKET).upload(receiptPath, receipt);
    if (uploadErr) {
      console.error("Receipt upload failed:", uploadErr);
      await abandonOrder(adminDb, order.id, auth.user.id, null);
      return NextResponse.json(
        { error: `Could not attach your payment screenshot: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    // --- Order item (customer JWT: trg_validate_order_item needs auth.uid()) --
    const { error: itemErr } = await userDb.database.from("order_items").insert([
      {
        order_id: order.id,
        product_id: product.id,
        vendor_id: product.vendor_id,
        unit_price_cents: product.price_cents,
      },
    ]);

    if (itemErr) {
      console.error("Order item insert failed:", itemErr);
      await abandonOrder(adminDb, order.id, auth.user.id, receiptPath);
      return NextResponse.json({ error: itemErr.message || "Could not add the product to your order." }, { status: 500 });
    }

    // --- Submission for admin review -----------------------------------------
    const { error: subErr } = await userDb.database
      .from("manual_payment_submissions")
      .insert([
        {
          order_id: order.id,
          payment_channel: paymentChannel,
          sender_identifier: sender,
          transaction_ref: trxId,
          receipt_storage_path: receiptPath,
          status: "submitted",
        },
      ]);

    if (subErr) {
      const message = String(subErr.message || "");
      await abandonOrder(adminDb, order.id, auth.user.id, receiptPath);

      if (/uq_active_payment_channel_trx|duplicate key/i.test(message)) {
        return NextResponse.json(
          {
            error: "This Transaction ID has already been submitted for another order. Double submissions are not allowed.",
            code: "DUPLICATE_TRANSACTION_REF",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: message || "Failed to submit payment details." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: reference,
      amountCents: product.price_cents,
      currency: product.currency || "BDT",
      status: "pending_payment",
    });
  } catch (err: any) {
    console.error("Manual payment checkout error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
