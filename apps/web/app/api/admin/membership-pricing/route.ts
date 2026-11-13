import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/insforge-server";
import {
  MEMBERSHIP_PLANS,
  MEMBERSHIP_PLAN_PRICES_KEY,
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_DURATIONS,
  parseFeatures,
  validateDuration,
  isMembershipPlan,
  type DurationUnit,
} from "@/lib/membership-plans";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const MAX_PLAN_PRICE_BDT = 10_000_000;
const MAX_PRODUCT_LIMIT = 1_000_000;
const MAX_PRODUCT_PRIORITY = 1_000;

// ==============================================================================
// /api/admin/membership-pricing
// GET  -> normalized config for the three fixed plans (price + duration + enabled + features)
//         alongside global membership rules (free_basic_on_registration).
// POST -> { plan, price, enabled, duration_value, duration_unit, features }
//         OR { global_rules: { free_basic_on_registration: boolean } }
//         merges configuration into site_settings.membership_plan_prices JSONB. Admin-only.
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

    const globalRulesRaw = raw?.global_rules as Record<string, any> | undefined;
    const global_rules = {
      free_basic_on_registration:
        globalRulesRaw && typeof globalRulesRaw.free_basic_on_registration === "boolean"
          ? globalRulesRaw.free_basic_on_registration
          : true, // Default safe: ON
    };

    const plans = MEMBERSHIP_PLANS.map((plan) => {
      const entry = raw[plan];
      const defaultDur = DEFAULT_PLAN_DURATIONS[plan];

      const price =
        typeof entry === "number"
          ? entry
          : entry && typeof entry === "object"
          ? Number(entry.price)
          : NaN;

      const enabled =
        entry && typeof entry === "object" && entry.enabled !== undefined
          ? entry.enabled === true
          : Number.isFinite(price) && (plan === "basic" ? price >= 0 : price > 0);

      const duration_value =
        entry && typeof entry === "object" && entry.duration_value !== undefined
          ? entry.duration_value
          : defaultDur.durationValue;

      const duration_unit =
        entry && typeof entry === "object" && entry.duration_unit !== undefined
          ? entry.duration_unit
          : defaultDur.durationUnit;

      const features = parseFeatures(entry && typeof entry === "object" ? entry.features : null, plan);

      return {
        plan,
        price: Number.isFinite(price) && (plan === "basic" ? price >= 0 : price > 0) ? price : null,
        enabled,
        duration_value,
        duration_unit,
        configured: Number.isFinite(price) && (plan === "basic" ? price >= 0 : price > 0),
        features,
      };
    });

    return NextResponse.json(
      { plans, global_rules, updated_at: data?.updated_at || null },
      { headers: NO_STORE }
    );
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
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    // Read current value and merge — never clobber sibling plans or existing keys.
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

    let updatedGlobalRules: any = null;
    let updatedPlanData: any = null;

    // 1. Handle Global Rules update (if provided)
    if (body.global_rules && typeof body.global_rules === "object") {
      if (typeof body.global_rules.free_basic_on_registration !== "boolean") {
        return NextResponse.json(
          { error: "global_rules.free_basic_on_registration must be a boolean." },
          { status: 400 }
        );
      }
      current.global_rules = {
        ...(current.global_rules || {}),
        free_basic_on_registration: body.global_rules.free_basic_on_registration,
      };
      updatedGlobalRules = current.global_rules;
    }

    // 2. Handle Plan update (if provided)
    if (body.plan !== undefined) {
      const plan = body.plan;
      const price = body.price;
      const enabled = body.enabled;
      const rawFeatures = body.features;
      const rawDurVal = body.duration_value;
      const rawDurUnit = body.duration_unit;

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
      const minPrice = plan === "basic" ? 0 : 1; // Basic allows 0 (Free); Premium/Pro require > 0
      if (!Number.isFinite(priceNum) || priceNum < minPrice || priceNum > MAX_PLAN_PRICE_BDT) {
        return NextResponse.json(
          {
            error:
              plan === "basic"
                ? `Price for Basic must be non-negative BDT amount (max ${MAX_PLAN_PRICE_BDT}).`
                : `Price must be a positive BDT amount (min 1, max ${MAX_PLAN_PRICE_BDT}).`,
          },
          { status: 400 }
        );
      }

      // Duration Validation
      let duration_value: number | null = null;
      let duration_unit: DurationUnit | null = null;

      if (plan === "basic") {
        // Basic can be Permanent (null/empty/0) or a timed subscription (positive integer + unit)
        if (rawDurVal !== null && rawDurVal !== undefined && rawDurVal !== "" && rawDurVal !== 0) {
          const validated = validateDuration(rawDurVal, rawDurUnit);
          if (!validated.valid) {
            return NextResponse.json({ error: validated.error || "Invalid duration for Basic plan." }, { status: 400 });
          }
          duration_value = validated.durationValue;
          duration_unit = validated.durationUnit;
        }
      } else {
        // Premium and Pro require explicit positive duration
        const validated = validateDuration(rawDurVal, rawDurUnit);
        if (!validated.valid || validated.durationValue === null || validated.durationUnit === null) {
          return NextResponse.json(
            { error: validated.error || `${plan.toUpperCase()} plan requires a valid positive duration and unit (days, months, or years).` },
            { status: 400 }
          );
        }
        duration_value = validated.durationValue;
        duration_unit = validated.durationUnit;
      }

      // Validate features if provided, else use defaults
      const defaults = DEFAULT_PLAN_FEATURES[plan];
      let product_limit = defaults.product_limit;
      let product_priority = defaults.product_priority;
      let whatsapp_enabled = defaults.whatsapp_enabled;
      let profile_picture_enabled = defaults.profile_picture_enabled;
      let cover_photo_enabled = defaults.cover_photo_enabled;
      let showcase_enabled = defaults.showcase_enabled;

      if (rawFeatures && typeof rawFeatures === "object") {
        if (rawFeatures.product_limit !== undefined) {
          const pl = Number(rawFeatures.product_limit);
          if (!Number.isInteger(pl) || pl < 0 || pl > MAX_PRODUCT_LIMIT) {
            return NextResponse.json(
              { error: `Product limit must be an integer between 0 and ${MAX_PRODUCT_LIMIT}.` },
              { status: 400 }
            );
          }
          product_limit = pl;
        }

        if (rawFeatures.product_priority !== undefined) {
          const pp = Number(rawFeatures.product_priority);
          if (!Number.isInteger(pp) || pp < 0 || pp > MAX_PRODUCT_PRIORITY) {
            return NextResponse.json(
              { error: `Product priority must be an integer between 0 and ${MAX_PRODUCT_PRIORITY}.` },
              { status: 400 }
            );
          }
          product_priority = pp;
        }

        if (rawFeatures.whatsapp_enabled !== undefined) {
          if (typeof rawFeatures.whatsapp_enabled !== "boolean") {
            return NextResponse.json({ error: "whatsapp_enabled must be a boolean." }, { status: 400 });
          }
          whatsapp_enabled = rawFeatures.whatsapp_enabled;
        }

        if (rawFeatures.profile_picture_enabled !== undefined) {
          if (typeof rawFeatures.profile_picture_enabled !== "boolean") {
            return NextResponse.json({ error: "profile_picture_enabled must be a boolean." }, { status: 400 });
          }
          profile_picture_enabled = rawFeatures.profile_picture_enabled;
        }

        if (rawFeatures.cover_photo_enabled !== undefined) {
          if (typeof rawFeatures.cover_photo_enabled !== "boolean") {
            return NextResponse.json({ error: "cover_photo_enabled must be a boolean." }, { status: 400 });
          }
          cover_photo_enabled = rawFeatures.cover_photo_enabled;
        }

        if (rawFeatures.showcase_enabled !== undefined) {
          if (typeof rawFeatures.showcase_enabled !== "boolean") {
            return NextResponse.json({ error: "showcase_enabled must be a boolean." }, { status: 400 });
          }
          showcase_enabled = rawFeatures.showcase_enabled;
        }
      }

      const validatedFeatures = {
        product_limit,
        product_priority,
        whatsapp_enabled,
        profile_picture_enabled,
        cover_photo_enabled,
        showcase_enabled,
      };

      current[plan] = {
        price: priceNum,
        enabled,
        duration_value,
        duration_unit,
        features: validatedFeatures,
      };

      updatedPlanData = {
        plan,
        price: priceNum,
        enabled,
        duration_value,
        duration_unit,
        features: validatedFeatures,
      };
    }

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
      return NextResponse.json({ error: "Failed to save plan configuration." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: updatedPlanData
        ? `${updatedPlanData.plan.toUpperCase()} plan settings saved successfully.`
        : "Global membership rules updated successfully.",
      plan: updatedPlanData,
      global_rules: updatedGlobalRules || current.global_rules,
    });
  } catch (err: any) {
    console.error("Admin membership pricing POST error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
