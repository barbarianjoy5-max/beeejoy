import "server-only";

import { getServerClient } from "./insforge-server";

// ==============================================================================
// BEEEJOY Membership Plans & Pricing
// Plans mirror PLAN_PRESETS in app/api/admin/sellers/route.ts — the database
// RPCs apply the actual permission values on approval; this module only
// validates plan names and resolves prices/availability.
//
// site_settings key 'membership_plan_prices' value shape (JSONB):
//   {
//     "basic":   { "price": 500,  "enabled": true },
//     "premium": { "price": 1000, "enabled": true },
//     "pro":     { "price": 2000, "enabled": true }
//   }
// Legacy plain-number values ({ "basic": 500 }) are still accepted and are
// treated as enabled. Missing/invalid entries fail closed.
// ==============================================================================

export const MEMBERSHIP_PLANS = ["basic", "premium", "pro"] as const;
export type MembershipPlan = (typeof MEMBERSHIP_PLANS)[number];

export const MEMBERSHIP_PLAN_PRICES_KEY = "membership_plan_prices";

export interface MembershipPlanConfig {
  plan: MembershipPlan;
  priceBdt: number;
  enabled: boolean;
}

export function isMembershipPlan(value: unknown): value is MembershipPlan {
  return typeof value === "string" && (MEMBERSHIP_PLANS as readonly string[]).includes(value);
}

function parsePlanEntry(raw: unknown): { priceBdt: number; enabled: boolean } | null {
  // Legacy shape: plain positive number => enabled.
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? { priceBdt: raw, enabled: true } : null;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const price = typeof obj.price === "number" ? obj.price : Number(obj.price);
    if (!Number.isFinite(price) || price <= 0) return null;
    // enabled defaults to true when absent so older partial configs keep working.
    const enabled = obj.enabled === undefined ? true : obj.enabled === true;
    return { priceBdt: price, enabled };
  }
  return null;
}

async function readPlanPricesValue(): Promise<Record<string, unknown> | null> {
  try {
    const db = getServerClient();
    const { data, error } = await db.database
      .from("site_settings")
      .select("value")
      .eq("key", MEMBERSHIP_PLAN_PRICES_KEY)
      .maybeSingle();

    if (error || !data?.value) return null;
    const value = data.value;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Returns the config for one plan, or null when pricing is not configured
 * or the stored value is invalid. `enabled === false` means the plan is
 * configured but disabled — callers must block new checkouts for it.
 */
export async function getMembershipPlanConfig(plan: MembershipPlan): Promise<MembershipPlanConfig | null> {
  const value = await readPlanPricesValue();
  if (!value) return null;
  const parsed = parsePlanEntry(value[plan]);
  if (!parsed) return null;
  return { plan, priceBdt: parsed.priceBdt, enabled: parsed.enabled };
}

/**
 * Returns normalized config for all three fixed plans. Plans without a
 * valid configured price are reported with priceBdt 0 and enabled false
 * so the admin UI can still render them.
 */
export async function getAllMembershipPlanConfigs(): Promise<MembershipPlanConfig[]> {
  const value = await readPlanPricesValue();
  return MEMBERSHIP_PLANS.map((plan) => {
    const parsed = value ? parsePlanEntry(value[plan]) : null;
    return {
      plan,
      priceBdt: parsed?.priceBdt ?? 0,
      enabled: parsed?.enabled ?? false,
    };
  });
}

/**
 * Backward-compatible price lookup: returns the BDT price only when the
 * plan is enabled, otherwise null (fail closed).
 */
export async function getMembershipPlanPriceBdt(plan: MembershipPlan): Promise<number | null> {
  const config = await getMembershipPlanConfig(plan);
  if (!config || !config.enabled) return null;
  return config.priceBdt;
}
