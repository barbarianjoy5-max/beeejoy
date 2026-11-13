import "server-only";

import { getServerClient } from "./insforge-server";

// ==============================================================================
// BEEEJOY Membership Plans, Pricing, Dynamic Features & Expiry
// Defines the 3 fixed tiers: basic, premium, pro.
// Features, pricing, duration, and global rules are stored in site_settings
// under key 'membership_plan_prices'.
//
// site_settings key 'membership_plan_prices' value shape (JSONB):
//   {
//     "global_rules": {
//       "free_basic_on_registration": true
//     },
//     "basic": {
//       "price": 0,
//       "enabled": true,
//       "duration_value": null,
//       "duration_unit": null,
//       "features": {
//         "product_limit": 5,
//         "product_priority": 0,
//         "whatsapp_enabled": true,
//         "profile_picture_enabled": true,
//         "cover_photo_enabled": false,
//         "showcase_enabled": false
//       }
//     },
//     "premium": { ... },
//     "pro": { ... }
//   }
// ==============================================================================

export const MEMBERSHIP_PLANS = ["basic", "premium", "pro"] as const;
export type MembershipPlan = (typeof MEMBERSHIP_PLANS)[number];

export const DURATION_UNITS = ["days", "months", "years"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

export const FREE_BASIC_STATUSES = ["inherit", "granted", "revoked"] as const;
export type FreeBasicStatus = (typeof FREE_BASIC_STATUSES)[number];

export type ResolvedMembershipState =
  | "active_paid"
  | "free_basic_active"
  | "membership_required"
  | "custom";

export const MEMBERSHIP_PLAN_PRICES_KEY = "membership_plan_prices";

export interface MembershipPlanFeatures {
  product_limit: number;
  product_priority: number;
  whatsapp_enabled: boolean;
  profile_picture_enabled: boolean;
  cover_photo_enabled: boolean;
  showcase_enabled: boolean;
}

export const DEFAULT_PLAN_FEATURES: Record<MembershipPlan, MembershipPlanFeatures> = {
  basic: {
    product_limit: 5,
    product_priority: 0,
    whatsapp_enabled: true,
    profile_picture_enabled: true,
    cover_photo_enabled: false,
    showcase_enabled: false,
  },
  premium: {
    product_limit: 25,
    product_priority: 5,
    whatsapp_enabled: true,
    profile_picture_enabled: true,
    cover_photo_enabled: true,
    showcase_enabled: false,
  },
  pro: {
    product_limit: 100,
    product_priority: 10,
    whatsapp_enabled: true,
    profile_picture_enabled: true,
    cover_photo_enabled: true,
    showcase_enabled: true,
  },
};

export const DEFAULT_PLAN_DURATIONS: Record<MembershipPlan, { durationValue: number | null; durationUnit: DurationUnit | null }> = {
  basic: { durationValue: null, durationUnit: null }, // Permanent baseline by default
  premium: { durationValue: 30, durationUnit: "days" },
  pro: { durationValue: 1, durationUnit: "months" },
};

export interface MembershipPlanConfig {
  plan: MembershipPlan;
  priceBdt: number;
  enabled: boolean;
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  features: MembershipPlanFeatures;
}

export interface MembershipGlobalRules {
  free_basic_on_registration: boolean; // default: true
}

export function isMembershipPlan(value: unknown): value is MembershipPlan {
  return typeof value === "string" && (MEMBERSHIP_PLANS as readonly string[]).includes(value);
}

export function isDurationUnit(value: unknown): value is DurationUnit {
  return typeof value === "string" && (DURATION_UNITS as readonly string[]).includes(value as DurationUnit);
}

export function isFreeBasicStatus(value: unknown): value is FreeBasicStatus {
  return typeof value === "string" && (FREE_BASIC_STATUSES as readonly string[]).includes(value as FreeBasicStatus);
}

/**
 * Validates duration value and unit for paid tiers.
 * Positive integer (1..10000) and allowed units (days, months, years).
 */
export function validateDuration(
  value: unknown,
  unit: unknown
): { valid: boolean; durationValue: number | null; durationUnit: DurationUnit | null; error?: string } {
  if (value === null || value === undefined || value === "") {
    return { valid: true, durationValue: null, durationUnit: null };
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 10_000) {
    return { valid: false, durationValue: null, durationUnit: null, error: "Duration value must be a positive integer (1..10000)." };
  }
  if (!isDurationUnit(unit)) {
    return { valid: false, durationValue: null, durationUnit: null, error: "Duration unit must be one of: days, months, years." };
  }
  return { valid: true, durationValue: n, durationUnit: unit };
}

/**
 * Calendar month/year addition with end-of-month clamping and leap-year handling.
 * Examples:
 *   Jan 31 + 1 month  -> Feb 28 (or Feb 29 in leap year)
 *   Feb 29 + 1 year   -> Feb 28
 *   Mar 31 + 1 month  -> Apr 30
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date);
  const targetDay = d.getUTCDate();
  // Set to 1st of target month first to avoid rolling over on overflow
  d.setUTCMonth(d.getUTCMonth() + months, 1);
  // Total days in the resulting month
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(targetDay, daysInMonth));
  return d;
}

export function addYearsClamped(date: Date, years: number): Date {
  return addMonthsClamped(date, years * 12);
}

/**
 * Calculates a new expiry date starting from startDate.
 */
export function calculateExpiryDate(startDate: Date | string, durationValue: number, durationUnit: DurationUnit): Date {
  const base = new Date(startDate);
  if (isNaN(base.getTime())) {
    throw new Error("Invalid start date provided for expiry calculation.");
  }
  if (!Number.isInteger(durationValue) || durationValue <= 0) {
    throw new Error("durationValue must be a positive integer.");
  }

  if (durationUnit === "days") {
    const d = new Date(base);
    d.setTime(d.getTime() + durationValue * 24 * 60 * 60 * 1000);
    return d;
  }
  if (durationUnit === "months") {
    return addMonthsClamped(base, durationValue);
  }
  if (durationUnit === "years") {
    return addYearsClamped(base, durationValue);
  }

  throw new Error(`Unsupported duration unit: ${durationUnit}`);
}

/**
 * Evaluates whether a seller is eligible for Permanent Free Basic access.
 * Precedence:
 *   1. "granted" => always true (overrides global OFF)
 *   2. "revoked" => always false (overrides global ON)
 *   3. "inherit" => follows global toggle (defaults to true)
 */
export function isVendorFreeBasicEligible(
  sellerStatus: FreeBasicStatus | string | null | undefined,
  globalFreeBasicAllowed: boolean = true
): boolean {
  if (sellerStatus === "granted") return true;
  if (sellerStatus === "revoked") return false;
  return globalFreeBasicAllowed ?? true;
}

/**
 * Resolves the 4-state membership condition of a vendor:
 *   - "custom": Admin individually customized permissions; bypasses all automation.
 *   - "active_paid": Has an active unexpired paid term (membership_expires_at > now).
 *   - "free_basic_active": No active paid term, but seller is eligible for Free Basic.
 *   - "membership_required": No active paid term, and Free Basic is revoked/ineligible.
 */
export function resolveVendorMembershipState(
  vendor: {
    membership_plan?: string | null;
    membership_expires_at?: string | null;
    free_basic_status?: string | null;
    payout_info?: Record<string, any> | null;
  },
  globalFreeBasicAllowed: boolean = true,
  now: Date = new Date()
): ResolvedMembershipState {
  // 1. Custom membership is completely under Admin's manual control
  if (vendor.membership_plan === "custom") {
    return "custom";
  }

  // 2. Check for active timed membership (Paid Basic, Premium, or Pro)
  if (vendor.membership_expires_at) {
    const expiresAt = new Date(vendor.membership_expires_at);
    if (!isNaN(expiresAt.getTime()) && expiresAt.getTime() > now.getTime()) {
      return "active_paid";
    }
  }

  // 3. Seller has no active timed membership. Determine Free Basic eligibility.
  const rawStatus =
    vendor.free_basic_status ||
    (vendor.payout_info && typeof vendor.payout_info === "object" ? vendor.payout_info.free_basic_status : null) ||
    "inherit";

  const isEligible = isVendorFreeBasicEligible(rawStatus, globalFreeBasicAllowed);

  if (isEligible) {
    return "free_basic_active";
  }

  return "membership_required";
}

export function parseFeatures(raw: unknown, plan: MembershipPlan): MembershipPlanFeatures {
  const defaults = DEFAULT_PLAN_FEATURES[plan];
  if (!raw || typeof raw !== "object") return { ...defaults };
  const obj = raw as Record<string, unknown>;

  const product_limit =
    typeof obj.product_limit === "number" && Number.isInteger(obj.product_limit) && obj.product_limit >= 0
      ? obj.product_limit
      : defaults.product_limit;

  const product_priority =
    typeof obj.product_priority === "number" && Number.isInteger(obj.product_priority) && obj.product_priority >= 0
      ? obj.product_priority
      : defaults.product_priority;

  const whatsapp_enabled =
    typeof obj.whatsapp_enabled === "boolean" ? obj.whatsapp_enabled : defaults.whatsapp_enabled;

  const profile_picture_enabled =
    typeof obj.profile_picture_enabled === "boolean"
      ? obj.profile_picture_enabled
      : defaults.profile_picture_enabled;

  const cover_photo_enabled =
    typeof obj.cover_photo_enabled === "boolean" ? obj.cover_photo_enabled : defaults.cover_photo_enabled;

  const showcase_enabled =
    typeof obj.showcase_enabled === "boolean" ? obj.showcase_enabled : defaults.showcase_enabled;

  return {
    product_limit,
    product_priority,
    whatsapp_enabled,
    profile_picture_enabled,
    cover_photo_enabled,
    showcase_enabled,
  };
}

function parsePlanEntry(raw: unknown, plan: MembershipPlan): {
  priceBdt: number;
  enabled: boolean;
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  features: MembershipPlanFeatures;
} | null {
  const defaultDur = DEFAULT_PLAN_DURATIONS[plan];

  // Legacy shape: plain positive number => enabled with default features.
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0
      ? {
          priceBdt: raw,
          enabled: true,
          durationValue: defaultDur.durationValue,
          durationUnit: defaultDur.durationUnit,
          features: { ...DEFAULT_PLAN_FEATURES[plan] },
        }
      : null;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const price = typeof obj.price === "number" ? obj.price : Number(obj.price);
    if (!Number.isFinite(price) || price < 0) return null;
    const enabled = obj.enabled === undefined ? true : obj.enabled === true;

    // Validate duration if present
    const durValRaw = obj.duration_value;
    const durUnitRaw = obj.duration_unit;
    let durationValue: number | null = defaultDur.durationValue;
    let durationUnit: DurationUnit | null = defaultDur.durationUnit;

    if (durValRaw !== undefined || durUnitRaw !== undefined) {
      const validated = validateDuration(durValRaw, durUnitRaw);
      if (validated.valid) {
        durationValue = validated.durationValue;
        durationUnit = validated.durationUnit;
      }
    }

    const features = parseFeatures(obj.features, plan);
    return { priceBdt: price, enabled, durationValue, durationUnit, features };
  }
  return null;
}

export async function readPlanPricesValue(): Promise<Record<string, unknown> | null> {
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
 * Returns global membership rules, failing safe to { free_basic_on_registration: true }.
 */
export async function getMembershipGlobalRules(): Promise<MembershipGlobalRules> {
  const raw = await readPlanPricesValue();
  const rules = raw?.global_rules as Record<string, unknown> | undefined;
  const free_basic_on_registration =
    rules && typeof rules.free_basic_on_registration === "boolean"
      ? rules.free_basic_on_registration
      : true; // Default safe: ON

  return { free_basic_on_registration };
}

/**
 * Returns the config for one plan, or null when pricing is not configured
 * or the stored value is invalid.
 */
export async function getMembershipPlanConfig(plan: MembershipPlan): Promise<MembershipPlanConfig | null> {
  const value = await readPlanPricesValue();
  if (!value) return null;
  const parsed = parsePlanEntry(value[plan], plan);
  if (!parsed) return null;
  return {
    plan,
    priceBdt: parsed.priceBdt,
    enabled: parsed.enabled,
    durationValue: parsed.durationValue,
    durationUnit: parsed.durationUnit,
    features: parsed.features,
  };
}

/**
 * Returns dynamic features for a plan, falling back to defaults.
 */
export async function getMembershipPlanFeatures(plan: MembershipPlan): Promise<MembershipPlanFeatures> {
  const config = await getMembershipPlanConfig(plan);
  return config?.features || DEFAULT_PLAN_FEATURES[plan];
}

/**
 * Returns normalized config for all three fixed plans.
 */
export async function getAllMembershipPlanConfigs(): Promise<MembershipPlanConfig[]> {
  const value = await readPlanPricesValue();
  return MEMBERSHIP_PLANS.map((plan) => {
    const parsed = value ? parsePlanEntry(value[plan], plan) : null;
    const defaultDur = DEFAULT_PLAN_DURATIONS[plan];
    return {
      plan,
      priceBdt: parsed?.priceBdt ?? 0,
      enabled: parsed?.enabled ?? false,
      durationValue: parsed?.durationValue ?? defaultDur.durationValue,
      durationUnit: parsed?.durationUnit ?? defaultDur.durationUnit,
      features: parsed?.features ?? { ...DEFAULT_PLAN_FEATURES[plan] },
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

/**
 * Server-side helper: Safely processes a lapsed vendor membership.
 * Never deletes products, releases, or storage assets.
 * Respects custom_overrides and custom plan immunity.
 */
export async function expireVendorMembership(
  vendorId: string,
  adminDb: any
): Promise<{ success: boolean; newState: ResolvedMembershipState; warning?: string }> {
  try {
    const { data: vendor, error: vErr } = await adminDb.database
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .maybeSingle();

    if (vErr || !vendor) {
      return { success: false, newState: "membership_required", warning: "Vendor not found" };
    }

    // 1. Custom membership is immune to automated downgrades (zero database writes)
    if (vendor.membership_plan === "custom") {
      return { success: true, newState: "custom" };
    }

    // 2. If membership_expires_at is NULL, the vendor has an untimed / permanent plan.
    // Zero database updates must be performed. Return the currently resolved state.
    if (!vendor.membership_expires_at) {
      const globalRules = await getMembershipGlobalRules();
      const state = resolveVendorMembershipState(vendor, globalRules.free_basic_on_registration);
      return { success: true, newState: state };
    }

    // 3. If the plan has NOT expired yet (future timestamp), do nothing (zero database writes)
    const expiresAt = new Date(vendor.membership_expires_at);
    if (!isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now()) {
      return { success: true, newState: "active_paid" };
    }

    const globalRules = await getMembershipGlobalRules();
    const newState = resolveVendorMembershipState(vendor, globalRules.free_basic_on_registration);

    const payoutInfo =
      vendor.payout_info && typeof vendor.payout_info === "object" ? { ...vendor.payout_info } : {};
    const customOverrides =
      payoutInfo.custom_overrides && typeof payoutInfo.custom_overrides === "object"
        ? { ...payoutInfo.custom_overrides }
        : {};

    const updatePayload: Record<string, any> = {
      membership_plan: "basic",
      membership_expires_at: null, // Ends expiry loop
      updated_at: new Date().toISOString(),
    };

    if (newState === "free_basic_active") {
      // Revert to dynamic Basic plan defaults, respecting individual overrides
      const basicFeatures = await getMembershipPlanFeatures("basic");
      for (const [key, val] of Object.entries(basicFeatures)) {
        if (!customOverrides[key]) {
          updatePayload[key] = val;
        }
      }
    } else {
      // newState === "membership_required": neutralize priority/showcase for new listings
      if (!customOverrides.product_priority) updatePayload.product_priority = 0;
      if (!customOverrides.showcase_enabled) updatePayload.showcase_enabled = false;
      if (!customOverrides.whatsapp_enabled) updatePayload.whatsapp_enabled = false;
    }

    // Atomic update conditioned on both vendor ID and the exact previously-read membership_expires_at.
    // Guarantees concurrency safety: if another worker already transitioned this row, affected rows = 0.
    const { data: updatedRows, error: updErr } = await adminDb.database
      .from("vendors")
      .update(updatePayload)
      .eq("id", vendorId)
      .eq("membership_expires_at", vendor.membership_expires_at)
      .select("id, membership_plan, membership_expires_at, free_basic_status, payout_info");

    if (updErr) throw updErr;

    // If another request already transitioned this vendor, re-fetch and return the authoritative current state
    if (!updatedRows || updatedRows.length === 0) {
      const { data: freshVendor } = await adminDb.database
        .from("vendors")
        .select("*")
        .eq("id", vendorId)
        .maybeSingle();

      const currentResolved = resolveVendorMembershipState(
        freshVendor || vendor,
        globalRules.free_basic_on_registration
      );
      return { success: true, newState: currentResolved };
    }

    return { success: true, newState };
  } catch (err: any) {
    console.error("expireVendorMembership error for vendor", vendorId, err);
    return { success: false, newState: "membership_required", warning: err?.message };
  }
}
