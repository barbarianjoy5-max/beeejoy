import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/insforge-server";
import {
  MEMBERSHIP_PLANS,
  MEMBERSHIP_PLAN_PRICES_KEY,
  isMembershipPlan,
} from "@/lib/membership-plans";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const MAX_PLAN_PRICE_BDT = 10_000_000;

// ==============================================================================
// /api/admin/membership-pricing
// GET  -> normalized config for the three fixed plans (price + enabled).
// POST -> { plan, price, enabled } — merges one plan into the existing
//         site_settings.membership_plan_prices JSONB value. Admin-only.
// Existing membership_payments rows are never touched: they keep their
// stored amount_bdt, so price changes affect new checkouts only.
// ==============================================================================

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { data, error } = await admin.adminDb.database
      .from("site_settings")
      .select("value, updated_at")
      .eq("key", MEMBERSHIP_PLAN_PRICES_KEY)
      .maybeSingle();

    if (error) {
      console.warn("membership_plan_prices query error:", error);
    }

    const raw = (data?.value && typeof data.value === "object" ? data.value : {}) as Record<string, any>;

    const plans = MEMBERSHIP_PLANS.map((plan) => {
      const entry = raw[plan];
      // Accept both legacy number shape and { price, enabled } object shape.
      const price =
        typeof entry === "number"
          ? entry
          : entry && typeof entry === "object"
          ? Number(entry.price)
          : NaN;
      const enabled =
        entry && typeof entry === "object" && entry.enabled !== undefined
          ? entry.enabled === true
          : Number.isFinite(price) && price > 0;
      return {
        plan,
        price: Number.isFinite(price) && price > 0 ? price : null,
        enabled,
        configured: Number.isFinite(price) && price > 0,
      };
    });

    return NextResponse.json({ plans, updated_at: data?.updated_at || null }, { headers: NO_STORE });
  } catch (err: any) {
    console.error("Admin membership pricing GET error:", err);
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
    const plan = body?.plan;
    const price = body?.price;
    const enabled = body?.enabled;

    if (!isMembershipPlan(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Only basic, premium and pro are supported." },
        { status: 400 }
      );
    }
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
    }

    const priceNum = typeof price === "number" ? price : Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0 || priceNum > MAX_PLAN_PRICE_BDT) {
      return NextResponse.json(
        { error: `Price must be a positive BDT amount (max ${MAX_PLAN_PRICE_BDT}).` },
        { status: 400 }
      );
    }

    // Read current value and merge — never clobber sibling plans.
    const { data: existing, error: readErr } = await admin.adminDb.database
      .from("site_settings")
      .select("value")
      .eq("key", MEMBERSHIP_PLAN_PRICES_KEY)
      .maybeSingle();

    if (readErr) {
      console.error("membership_plan_prices read error:", readErr);
      return NextResponse.json({ error: "Could not read current pricing." }, { status: 500 });
    }

    const current =
      existing?.value && typeof existing.value === "object"
        ? { ...(existing.value as Record<string, any>) }
        : {};

    current[plan] = { price: priceNum, enabled };

    const { error: saveErr } = await admin.adminDb.database
      .from("site_settings")
      .upsert(
        [
          {
            key: MEMBERSHIP_PLAN_PRICES_KEY,
            value: current,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "key" }
      );

    if (saveErr) {
      console.error("membership_plan_prices save error:", saveErr);
      return NextResponse.json({ error: "Failed to save pricing." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${plan} plan pricing updated.`,
      plan: { plan, price: priceNum, enabled },
    });
  } catch (err: any) {
    console.error("Admin membership pricing POST error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
