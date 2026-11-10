import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getServerClient } from "@/lib/insforge-server";
import { verifyPayment } from "@/lib/uddoktapay";

export const dynamic = "force-dynamic";

// ==============================================================================
// POST /api/payments/uddoktapay/verify
// Authenticated verification of a UddoktaPay membership payment.
// NEVER called via bare GET — the success page POSTs here with the user's
// session after the gateway redirect.
//
// State machine:
//   pending/failed + COMPLETED + amount + metadata match -> paid_pending_review
//   pending + PENDING                                    -> stays pending
//   ERROR or any mismatch                                -> failed
//   paid_pending_review / approved / rejected            -> returned as-is
// ==============================================================================

const FINAL_STATES = ["paid_pending_review", "approved", "rejected"];

function amountsMatch(a: unknown, b: unknown): boolean {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) < 0.005;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const invoiceId = typeof body?.invoice_id === "string" ? body.invoice_id.trim() : "";
    const reference = typeof body?.ref === "string" ? body.ref.trim() : "";

    if (!invoiceId || !reference) {
      return NextResponse.json({ error: "invoice_id and ref are required." }, { status: 400 });
    }

    const db = getServerClient();

    const { data: payment, error: payErr } = await db.database
      .from("membership_payments")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (payErr || !payment) {
      return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
    }

    // Ownership: the payment must belong to the authenticated user.
    if (payment.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // Idempotent: never re-process a payment that already reached a final state.
    if (FINAL_STATES.includes(payment.status)) {
      return NextResponse.json({ success: true, status: payment.status, idempotent: true });
    }

    let verification;
    try {
      verification = await verifyPayment(invoiceId);
    } catch (gwErr: any) {
      console.error("UddoktaPay verify-payment error:", gwErr?.message);
      return NextResponse.json(
        { error: "Payment verification is temporarily unavailable. Please try again." },
        { status: 502 }
      );
    }

    const gatewayStatus = verification?.status;

    if (gatewayStatus === "PENDING") {
      return NextResponse.json({ success: true, status: "pending" });
    }

    const metadata = verification?.metadata || {};
    const metadataOk =
      String(metadata.membership_payment_id) === String(payment.id) &&
      String(metadata.plan) === String(payment.plan) &&
      String(metadata.vendor_id) === String(payment.vendor_id);

    // Compare the gateway's invoiced `amount` against the stored amount.
    // `charged_amount` is intentionally NOT used: it may include gateway
    // fees and must never satisfy the membership amount check.
    // amountsMatch returns false for missing/invalid values (NaN-safe).
    const amountOk = amountsMatch(verification?.amount, payment.amount_bdt);

    if (gatewayStatus !== "COMPLETED" || !metadataOk || !amountOk) {
      // ERROR status, missing/mismatched metadata, or amount mismatch -> failed.
      // Never mark paid, never activate membership.
      await db.database
        .from("membership_payments")
        .update({ status: "failed" })
        .eq("id", payment.id)
        .in("status", ["pending", "failed"]);
      return NextResponse.json({ success: true, status: "failed" });
    }

    // All checks passed -> paid_pending_review ONLY. Membership activation
    // happens exclusively via admin approval (approve_membership_payment RPC).
    const { error: updErr } = await db.database
      .from("membership_payments")
      .update({
        status: "paid_pending_review",
        invoice_id: invoiceId,
        gateway_txn_id: verification.transaction_id || null,
        paid_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .in("status", ["pending", "failed"]);

    if (updErr) {
      console.error("membership_payments verify update error:", updErr);
      return NextResponse.json({ error: "Could not record payment status." }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: "paid_pending_review" });
  } catch (err: any) {
    console.error("UddoktaPay verify route error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
