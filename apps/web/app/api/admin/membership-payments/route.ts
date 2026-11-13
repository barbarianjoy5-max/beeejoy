import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin, getUserClient } from "@/lib/insforge-server";
import {
  getMembershipPlanConfig,
  getMembershipPlanFeatures,
  isMembershipPlan,
  calculateExpiryDate,
  validateDuration,
} from "@/lib/membership-plans";

export const dynamic = "force-dynamic";

// ==============================================================================
// /api/admin/membership-payments
// GET  -> list membership payments (newest first) with vendor store names.
// POST -> { paymentId, decision: "approved" | "rejected", notes? }
//         1. Calls the existing SECURITY DEFINER RPC (approve_membership_payment /
//            reject_membership_payment) for transaction-locked status change.
//         2. Post-RPC (non-atomic, resilient): syncs dynamic plan features to the
//            vendor record while strictly preserving any individual custom overrides.
//            Failure in step 2 is safely logged and retryable without marking
//            the payment as failed or duplicating approval.
// ==============================================================================

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { data: payments, error } = await admin.adminDb.database
      .from("membership_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Attach vendor store names for display.
    const vendorIds = Array.from(new Set((payments || []).map((p: any) => p.vendor_id)));
    const vendorMap: Record<string, string> = {};
    if (vendorIds.length > 0) {
      const { data: vendors } = await admin.adminDb.database
        .from("vendors")
        .select("id, store_name, slug")
        .in("id", vendorIds);
      for (const v of vendors || []) {
        vendorMap[(v as any).id] = (v as any).store_name;
      }
    }

    return NextResponse.json({
      payments: (payments || []).map((p: any) => ({
        ...p,
        vendor_store_name: vendorMap[p.vendor_id] || null,
      })),
    });
  } catch (err: any) {
    console.error("Admin membership payments GET error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
    const decision = body?.decision;
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 1000) : null;

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId is required." }, { status: 400 });
    }
    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json({ error: "decision must be 'approved' or 'rejected'." }, { status: 400 });
    }

    // Step 1: Execute existing database RPC
    const userClient = getUserClient(admin.token);
    const rpcName = decision === "approved" ? "approve_membership_payment" : "reject_membership_payment";
    const { data: rpcData, error: rpcError } = await userClient.database.rpc(rpcName, {
      p_payment_id: paymentId,
      p_admin_notes: notes,
    });

    if (rpcError) {
      // Check if already approved (idempotency check)
      const { data: existingPay } = await admin.adminDb.database
        .from("membership_payments")
        .select("status")
        .eq("id", paymentId)
        .maybeSingle();

      if (existingPay?.status !== "approved" || decision !== "approved") {
        return NextResponse.json({ error: rpcError.message || "Review failed." }, { status: 400 });
      }
    }

    // If decision was rejection, we are done
    if (decision === "rejected") {
      return NextResponse.json({ success: true, result: rpcData });
    }

    // Step 2: Post-RPC Dynamic Plan Feature Sync (Resilient two-phase)
    let syncWarning: string | null = null;
    try {
      const { data: payRecord, error: payErr } = await admin.adminDb.database
        .from("membership_payments")
        .select("vendor_id, plan, status, amount_bdt, duration_value, duration_unit, activated_at, expires_at")
        .eq("id", paymentId)
        .maybeSingle();

      if (payErr || !payRecord) {
        throw new Error(`Could not load payment record ${paymentId}: ${payErr?.message || "Not found"}`);
      }

      if (isMembershipPlan(payRecord.plan)) {
        // --- Stage 4.2: resolve frozen duration terms -----------------------
        // 1. Prefer the checkout-time snapshot (duration_value/duration_unit).
        // 2. LEGACY FALLBACK: payments created before the snapshot columns
        //    have NULL duration -> resolve from the plan's CURRENT configured
        //    duration at approval time. If the plan config is also untimed,
        //    the membership is permanent (expires_at NULL).
        // 3. validateDuration guards against corrupt snapshot values.
        let durValue = payRecord.duration_value;
        let durUnit = payRecord.duration_unit;
        if (durValue == null || durUnit == null) {
          const cfg = await getMembershipPlanConfig(payRecord.plan);
          durValue = cfg?.durationValue ?? null;
          durUnit = cfg?.durationUnit ?? null;
        }
        const durCheck = validateDuration(durValue, durUnit);
        const hasTimedDuration =
          durCheck.valid && durCheck.durationValue != null && durCheck.durationUnit != null;

        // Paid-plan safety: a payment with a positive amount must NEVER
        // silently activate as a permanent membership. If no valid positive
        // duration can be resolved (missing/invalid/corrupt snapshot AND no
        // configured fallback), abort activation with an admin-facing error.
        // The payment stays approved-but-unactivated; re-approving after the
        // admin fixes the plan duration retries this sync safely.
        // Free/zero-amount plans may legitimately be permanent (NULL expiry).
        if (!hasTimedDuration && !payRecord.activated_at && Number(payRecord.amount_bdt) > 0) {
          throw new Error(
            `Cannot activate ${payRecord.plan} membership for payment ${paymentId}: no valid duration resolved. ` +
            `Set a positive duration for this plan in Membership Pricing, then approve the payment again.`
          );
        }

        // Idempotent activation timestamps: once the payment row is marked,
        // its stored values are reused so re-approvals never drift or extend.
        const { data: vendor, error: vErr } = await admin.adminDb.database
          .from("vendors")
          .select("*")
          .eq("id", payRecord.vendor_id)
          .maybeSingle();

        if (vErr || !vendor) {
          throw new Error(`Could not load vendor record ${payRecord.vendor_id}: ${vErr?.message || "Not found"}`);
        }

        // --- Stage 4.3: renewal / upgrade / reactivation expiry base --------
        // Same-plan renewal while the paid term is still active extends from
        // the EXISTING expiry (remaining paid time preserved). A different
        // plan, an expired term, or Free Basic -> Paid Basic (plan 'basic'
        // with NULL expiry = permanent free, not a paid term) all start a
        // fresh duration from approval time — no carryover.
        const now = new Date();
        const currentExpiry = vendor.membership_expires_at
          ? new Date(vendor.membership_expires_at)
          : null;
        const hasActivePaidTerm =
          vendor.membership_plan !== "custom" &&
          vendor.membership_plan === payRecord.plan &&
          !!currentExpiry &&
          !isNaN(currentExpiry.getTime()) &&
          currentExpiry.getTime() > now.getTime();

        // --- Retry-safety commit point --------------------------------------
        // The payment row is marked FIRST (conditional on activated_at IS
        // NULL). This persists the calculated terms exactly once, BEFORE the
        // vendor update. If the vendor update then fails, any retry finds
        // activated_at already set, reuses the STORED expires_at, and can
        // never recompute a second extension from the already-updated vendor
        // expiry. Concurrent approvals: only one request wins the conditional
        // UPDATE; the loser re-reads the stored values and writes identical
        // vendor fields — no last-writer-wins corruption.
        let activatedAt = payRecord.activated_at || null;
        let expiresAt = payRecord.expires_at || null;

        if (!activatedAt) {
          const candidateActivatedAt = new Date().toISOString();
          const expiryBase = hasActivePaidTerm ? currentExpiry! : new Date(candidateActivatedAt);
          const candidateExpiresAt = hasTimedDuration
            ? calculateExpiryDate(expiryBase, durCheck.durationValue!, durCheck.durationUnit!).toISOString()
            : null;

          const { data: marked, error: actErr } = await admin.adminDb.database
            .from("membership_payments")
            .update({ activated_at: candidateActivatedAt, expires_at: candidateExpiresAt })
            .eq("id", paymentId)
            .is("activated_at", null)
            .select("id");

          if (actErr) {
            throw actErr;
          }

          if (marked && marked.length > 0) {
            // We won the commit — use the values we just stored.
            activatedAt = candidateActivatedAt;
            expiresAt = candidateExpiresAt;
          } else {
            // Another request already activated this payment — reuse the
            // authoritative stored terms instead of our candidates.
            const { data: stored } = await admin.adminDb.database
              .from("membership_payments")
              .select("activated_at, expires_at")
              .eq("id", paymentId)
              .maybeSingle();
            activatedAt = stored?.activated_at || candidateActivatedAt;
            expiresAt = stored?.expires_at ?? candidateExpiresAt;
          }
        }

        // If the seller's plan was individually set to 'custom', preserve all custom permissions!
        if (vendor.membership_plan !== "custom") {
          const planFeatures = await getMembershipPlanFeatures(payRecord.plan);
          const payoutInfo = (vendor.payout_info && typeof vendor.payout_info === "object" ? vendor.payout_info : {}) as Record<string, any>;
          const customOverrides = (payoutInfo.custom_overrides && typeof payoutInfo.custom_overrides === "object" ? payoutInfo.custom_overrides : {}) as Record<string, boolean>;

          const updatePayload: Record<string, any> = {
            membership_plan: payRecord.plan,
            membership_activated_at: activatedAt,
            membership_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          };

          // Only apply dynamic plan defaults to fields that have NOT been explicitly overridden by Admin
          if (!customOverrides.product_limit) updatePayload.product_limit = planFeatures.product_limit;
          if (!customOverrides.product_priority) updatePayload.product_priority = planFeatures.product_priority;
          if (!customOverrides.whatsapp_enabled) updatePayload.whatsapp_enabled = planFeatures.whatsapp_enabled;
          if (!customOverrides.profile_picture_enabled) updatePayload.profile_picture_enabled = planFeatures.profile_picture_enabled;
          if (!customOverrides.cover_photo_enabled) updatePayload.cover_photo_enabled = planFeatures.cover_photo_enabled;
          if (!customOverrides.showcase_enabled) updatePayload.showcase_enabled = planFeatures.showcase_enabled;

          const { error: updErr } = await admin.adminDb.database
            .from("vendors")
            .update(updatePayload)
            .eq("id", vendor.id);

          if (updErr) {
            throw updErr;
          }
        }
      }
    } catch (syncErr: any) {
      console.error("Post-RPC dynamic feature sync warning for payment:", paymentId, syncErr);
      syncWarning = `Payment was approved, but dynamic feature sync encountered an issue: ${syncErr.message || syncErr}. You can update seller permissions anytime in the Sellers tab.`;
    }

    return NextResponse.json({
      success: true,
      result: rpcData || { status: "approved" },
      warning: syncWarning,
    });
  } catch (err: any) {
    console.error("Admin membership payments POST error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
