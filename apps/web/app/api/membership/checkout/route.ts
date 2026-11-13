import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getServerClient } from "@/lib/insforge-server";
import { checkoutV2 } from "@/lib/uddoktapay";
import { isMembershipPlan, getMembershipPlanConfig } from "@/lib/membership-plans";
import { generatePaymentReference } from "@/lib/manual-payment";

export const dynamic = "force-dynamic";

// ==============================================================================
// POST /api/membership/checkout
// Creates a pending membership_payments row and returns the UddoktaPay
// Checkout V2 payment_url. Server-authoritative: plan, vendor, user and
// amount are all resolved server-side; the client supplies only `plan`.
// ==============================================================================

function siteOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const plan = body?.plan;
    if (!isMembershipPlan(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Supported plans: basic, premium, pro." },
        { status: 400 }
      );
    }

    const db = getServerClient();

    // Resolve the caller's ACTIVE vendor — never trust client-supplied IDs.
    const { data: vendor, error: vendorErr } = await db.database
      .from("vendors")
      .select("id, user_id, status, store_name")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (vendorErr || !vendor) {
      return NextResponse.json({ error: "No seller account found for this user." }, { status: 403 });
    }
    if (vendor.status !== "active") {
      return NextResponse.json(
        { error: "Seller account is not active. Membership purchase requires an active seller account." },
        { status: 403 }
      );
    }

    // Pricing must exist to price a NEW checkout; disabled plans are blocked
    // below only when no existing pending payment is being continued.
    const planConfig = await getMembershipPlanConfig(plan);
    if (!planConfig) {
      return NextResponse.json(
        { error: "Membership pricing is not configured yet.", code: "PRICING_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    const priceBdt = planConfig.priceBdt;

    // Re-fetch the active payment for this vendor+plan. Used both for the
    // pre-insert dedup check and for resolving a 23505 unique-violation race.
    const fetchActivePayment = async () => {
      const { data, error } = await db.database
        .from("membership_payments")
        .select("id, reference, status, amount_bdt, checkout_url, checkout_url_at")
        .eq("vendor_id", vendor.id)
        .eq("plan", plan)
        .in("status", ["pending", "paid_pending_review"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { data, error };
    };

    const awaitingReviewResponse = (reference: string) =>
      NextResponse.json(
        {
          error: "A payment for this plan is already awaiting admin review.",
          code: "PAYMENT_AWAITING_REVIEW",
          reference,
        },
        { status: 409 }
      );

    const { data: existing, error: existingErr } = await fetchActivePayment();

    if (existingErr) {
      console.error("membership_payments dedup lookup error:", existingErr);
      return NextResponse.json({ error: "Could not check existing payments." }, { status: 500 });
    }

    if (existing?.status === "paid_pending_review") {
      return awaitingReviewResponse(existing.reference);
    }

    let payment: { id: string; reference: string; amountBdt: number };

    if (existing?.status === "pending") {
      // Safe retry: reuse the existing pending row, reference and stored
      // amount_bdt. A FRESH checkout-v2 invoice is always created because
      // UddoktaPay checkout sessions expire and the gateway may return
      // HTTP 200 for an expired session — a stored URL can never be
      // trusted. The new payment_url overwrites checkout_url below.
      payment = {
        id: existing.id,
        reference: existing.reference,
        amountBdt: Number(existing.amount_bdt),
      };
      // NOTE: legacy pending rows keep duration_value/duration_unit NULL.
      // Their terms are resolved via the legacy fallback at Admin approval
      // time (Stage 4.2) — checkout reuse must never rewrite them.
    } else {
      // Disabled plans block NEW checkouts only — existing pending payments
      // continue at their originally stored amount.
      if (!planConfig.enabled) {
        return NextResponse.json(
          { error: `The ${plan} plan is currently unavailable.`, code: "PLAN_DISABLED" },
          { status: 403 }
        );
      }
      const reference = generatePaymentReference();
      const { data: inserted, error: insertErr } = await db.database
        .from("membership_payments")
        .insert([
          {
            vendor_id: vendor.id,
            user_id: auth.user.id,
            plan,
            amount_bdt: priceBdt,
            currency: "BDT",
            reference,
            status: "pending",
            // Stage 4.1: snapshot the plan's duration terms at checkout time
            // so later admin pricing/duration edits cannot alter this payment.
            duration_value: planConfig.durationValue,
            duration_unit: planConfig.durationUnit,
          },
        ])
        .select("id, reference")
        .single();

      if (insertErr || !inserted) {
        // 23505 = unique_violation: a concurrent request won the insert race.
        // Re-fetch and reuse the winning row — never create a second payment.
        const isUniqueViolation =
          (insertErr as any)?.code === "23505" ||
          /duplicate key|unique constraint/i.test(String((insertErr as any)?.message || ""));

        if (isUniqueViolation) {
          const { data: winner, error: winnerErr } = await fetchActivePayment();
          if (!winnerErr && winner?.status === "paid_pending_review") {
            return awaitingReviewResponse(winner.reference);
          }
          if (!winnerErr && winner?.status === "pending") {
            // Same rule as the pre-insert path: always issue a fresh
            // checkout-v2 invoice for the winning row — stored URLs are
            // never trusted because sessions expire gateway-side.
            payment = {
              id: winner.id,
              reference: winner.reference,
              amountBdt: Number(winner.amount_bdt),
            };
          } else {
            console.error("membership_payments conflict re-fetch failed:", winnerErr || "no active row");
            return NextResponse.json(
              { error: "A payment for this plan is already in progress. Please try again." },
              { status: 409 }
            );
          }
        } else {
          console.error("membership_payments insert error:", insertErr);
          return NextResponse.json({ error: "Could not create payment record." }, { status: 500 });
        }
      } else {
        payment = { id: inserted.id, reference: inserted.reference, amountBdt: priceBdt };
      }
    }

    // --- Atomic invoice-creation claim -------------------------------------
    // Only the request that wins this conditional UPDATE may call
    // checkoutV2(). The UPDATE itself is the mutex: it matches the exact
    // payment id, requires status='pending', and only succeeds when no
    // fresh claim exists (< 90s). PostgREST returns the updated row, so
    // claimed.length === 1 proves we own the claim — no read-then-write.
    const CLAIM_TTL_MS = 90_000;
    const URL_FRESH_MS = 10 * 60_000;
    const claimTs = new Date().toISOString();
    const claimCutoff = new Date(Date.now() - CLAIM_TTL_MS).toISOString();

    // Two-step atomic claim. InsForge's records API rejects `or()` filters
    // on PATCH (misleading 42703), so the "unclaimed OR stale" condition is
    // split into two sequential conditional UPDATEs. Each UPDATE is atomic:
    // Postgres evaluates its WHERE under the row lock, so two contenders
    // cannot both win — the loser's WHERE re-evaluates to false after the
    // winner commits. Step 1 claims an unclaimed row; step 2 reclaims a
    // stale claim older than CLAIM_TTL_MS.
    const tryClaim = (filter: "null" | "stale") => {
      let q = db.database
        .from("membership_payments")
        .update({ checkout_claimed_at: claimTs })
        .eq("id", payment.id)
        .eq("status", "pending");
      q = filter === "null" ? q.is("checkout_claimed_at", null) : q.lt("checkout_claimed_at", claimCutoff);
      return q.select("id");
    };

    let { data: claimed, error: claimErr } = await tryClaim("null");
    if (!claimErr && (!claimed || claimed.length === 0)) {
      ({ data: claimed, error: claimErr } = await tryClaim("stale"));
    }

    if (claimErr) {
      console.error("membership_payments claim error:", claimErr);
      return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
    }

    if (!claimed || claimed.length === 0) {
      // Another request owns the claim — never call the gateway from here.
      const { data: fresh } = await fetchActivePayment();
      const urlAge = fresh?.checkout_url_at ? Date.now() - new Date(fresh.checkout_url_at).getTime() : Infinity;
      if (fresh?.status === "pending" && fresh.checkout_url && urlAge < URL_FRESH_MS) {
        return NextResponse.json({
          success: true,
          payment_url: fresh.checkout_url,
          reference: fresh.reference,
          reused: true,
        });
      }
      return NextResponse.json(
        {
          error: "A checkout is already being prepared for this plan. Please wait a few seconds and try again.",
          code: "CHECKOUT_IN_PROGRESS",
        },
        { status: 409 }
      );
    }

    const origin = siteOrigin(req);
    const fullName =
      (auth.user as any)?.user_metadata?.full_name ||
      (auth.user as any)?.user_metadata?.name ||
      auth.user.email ||
      "BEEEJOY Seller";

    let checkout;
    try {
      checkout = await checkoutV2({
        full_name: String(fullName),
        email: auth.user.email || "",
        amount: payment.amountBdt.toFixed(2),
        metadata: {
          membership_payment_id: payment.id,
          plan,
          vendor_id: vendor.id,
        },
        redirect_url: `${origin}/membership/payment/success?ref=${encodeURIComponent(payment.reference)}`,
        return_type: "GET",
        cancel_url: `${origin}/membership/payment/cancel?ref=${encodeURIComponent(payment.reference)}`,
      });
    } catch (gwErr: any) {
      // Unknown outcome: network error, timeout, HTTP failure, or missing
      // configuration. The gateway MAY already have created an invoice, so
      // the claim is intentionally LEFT INTACT — clearing it would let a
      // retry immediately mint a second invoice. The 90s stale-claim TTL
      // is the recovery path; the row stays pending (never marked failed).
      console.error("UddoktaPay checkout-v2 error:", gwErr?.message);
      return NextResponse.json(
        { error: "Payment gateway is temporarily unavailable. Your payment record was kept — please try again." },
        { status: 502 }
      );
    }

    if (!checkout?.status || !checkout.payment_url) {
      // Explicit gateway rejection (HTTP 200 with status:false): the only
      // case where marking the payment failed is trustworthy.
      await db.database
        .from("membership_payments")
        .update({ status: "failed", checkout_claimed_at: null })
        .eq("id", payment.id)
        .eq("status", "pending");
      return NextResponse.json(
        { error: checkout?.message || "Payment gateway rejected the request." },
        { status: 502 }
      );
    }

    // Persist the checkout URL before returning it. Only write while the
    // row is still pending so a concurrent verification is never clobbered.
    // checkout_url_at records issuance time for the 10-minute reuse window;
    // the claim is released in the same write.
    const { error: urlSaveErr } = await db.database
      .from("membership_payments")
      .update({
        checkout_url: checkout.payment_url,
        checkout_url_at: new Date().toISOString(),
        checkout_claimed_at: null,
      })
      .eq("id", payment.id)
      .eq("status", "pending");

    if (urlSaveErr) {
      // The gateway invoice already exists but we could not record its URL.
      // Keep the claim until its 90s TTL expires — releasing it now could
      // let a retry create a second invoice while the first is still
      // payable. Do NOT pretend it was saved and do NOT create another row.
      console.error("membership_payments checkout_url save error:", urlSaveErr);
      return NextResponse.json(
        {
          error:
            "Payment gateway invoice was created but could not be saved. Please try again; if the problem persists, contact support for manual reconciliation.",
          code: "CHECKOUT_URL_SAVE_FAILED",
          reference: payment.reference,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      payment_url: checkout.payment_url,
      reference: payment.reference,
    });
  } catch (err: any) {
    console.error("Membership checkout error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
