import { NextResponse } from "next/server";
import { getAllMembershipPlanConfigs, getMembershipGlobalRules } from "@/lib/membership-plans";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

// ==============================================================================
// GET /api/membership/plans
// Public/Seller endpoint returning configured plans with price, enabled status,
// and dynamic features for the Seller Dashboard comparison cards.
// ==============================================================================

export async function GET() {
  try {
    const [plans, globalRules] = await Promise.all([
      getAllMembershipPlanConfigs(),
      getMembershipGlobalRules(),
    ]);
    return NextResponse.json({ plans, global_rules: globalRules }, { headers: NO_STORE });
  } catch (err: any) {
    console.error("Membership plans GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
