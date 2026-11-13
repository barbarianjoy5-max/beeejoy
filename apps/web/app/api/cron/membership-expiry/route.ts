import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/insforge-server";
import { expireVendorMembership } from "@/lib/membership-plans";

export const dynamic = "force-dynamic";

// ==============================================================================
// GET|POST /api/cron/membership-expiry
// Secure server-side housekeeping for expired paid memberships.
//
// Auth: dedicated CRON_SECRET env var ONLY — sent as
//   Authorization: Bearer <CRON_SECRET>   or   x-cron-secret: <CRON_SECRET>
// INSFORGE_API_KEY is NEVER accepted here.
//
// Finds vendors whose membership_expires_at has passed and invokes the
// existing expireVendorMembership() helper, which is idempotent and
// concurrency-safe (conditional UPDATE on the exact expiry timestamp).
// custom memberships, permanent plans and already-transitioned rows are
// no-ops inside the helper. No payment records are modified.
//
// NOTE: this endpoint only runs when an external scheduler (cron job,
// Vercel Cron, etc.) is configured to call it with the secret.
// ==============================================================================

const BATCH_LIMIT = 200;

function isAuthorized(req: NextRequest): "ok" | "unconfigured" | "denied" {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "unconfigured";

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerSecret = req.headers.get("x-cron-secret") || "";

  if (bearer === secret || headerSecret === secret) return "ok";
  return "denied";
}

async function run(req: NextRequest) {
  const authResult = isAuthorized(req);
  if (authResult === "unconfigured") {
    return NextResponse.json(
      { error: "Cron endpoint is not configured (CRON_SECRET missing)." },
      { status: 503 }
    );
  }
  if (authResult === "denied") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = getServerClient();
  const nowIso = new Date().toISOString();

  // Candidates: timed memberships whose expiry has passed. NULL expiry
  // (permanent plans) and custom memberships are excluded/handled safely
  // inside expireVendorMembership (custom returns early, zero writes).
  const { data: candidates, error } = await db.database
    .from("vendors")
    .select("id, membership_plan, membership_expires_at")
    .not("membership_expires_at", "is", null)
    .lte("membership_expires_at", nowIso)
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("membership-expiry candidate query error:", error);
    return NextResponse.json({ error: "Could not query expired memberships." }, { status: 500 });
  }

  let processed = 0;
  let transitioned = 0;
  let failed = 0;

  for (const vendor of candidates || []) {
    processed += 1;
    try {
      const result = await expireVendorMembership(vendor.id, db);
      if (!result.success) {
        failed += 1;
        console.error("membership-expiry failed for vendor", vendor.id, result.warning);
      } else if (result.newState === "free_basic_active" || result.newState === "membership_required") {
        transitioned += 1;
      }
    } catch (err: any) {
      failed += 1;
      console.error("membership-expiry exception for vendor", vendor.id, err?.message);
    }
  }

  return NextResponse.json({
    success: true,
    candidates: (candidates || []).length,
    processed,
    transitioned,
    failed,
    ran_at: nowIso,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
