import { NextRequest, NextResponse } from "next/server";
import { getServerClient, getUserClient, getAuthenticatedUser } from "@/lib/insforge-server";
import {
  VISITOR_ID_PATTERN,
  extractReferrerDomain,
  hashForRateLimit,
  normalizePagePath,
  parseProductSlug,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

// ==============================================================================
// BEEEJOY public page-view ingest
// ------------------------------------------------------------------------------
// - The browser may send only { visitorId, path, referrer }. Every other field is
//   ignored, so a client cannot supply a role, a timestamp or a view_date.
// - Identity, when a bearer token is present, is resolved from the database here
//   through the caller's own verified token (RLS-backed), never from a claim sent
//   by the browser.
// - Admin traffic and seller traffic on their own products / seller surfaces are
//   dropped before anything is written.
// - Timing authority lives in PostgreSQL: occurred_at defaults to now() and
//   view_date is a STORED generated column, so neither value can be back-dated or
//   future-dated by a caller.
// - The analytics tables expose no INSERT policy, so this route — using the
//   strict server-only INSFORGE_API_KEY client — is the only writer. Without that
//   secret the route fails closed and records nothing.
// ==============================================================================

const MAX_BODY_BYTES = 2048;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_EVENTS = 40;

/** Best-effort, single-instance throttle. The DB unique index is the real guard. */
const buckets = new Map<string, { count: number; resetAt: number }>();

async function isRateLimited(req: NextRequest): Promise<boolean> {
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim();
  const key = await hashForRateLimit(ip, "beeejoy-analytics-rl");

  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    // Keep the map bounded without a background job
    if (buckets.size > 5000) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_MAX_EVENTS;
}

/** True when the request carries the site's own host (self-referral noise). */
function ownHosts(req: NextRequest): string[] {
  const hosts = new Set<string>();
  const host = req.headers.get("host");
  if (host) hosts.add(host.split(":")[0]);
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  if (baseUrl) {
    try {
      hosts.add(new URL(baseUrl).hostname);
    } catch {
      // ignore a malformed env value
    }
  }
  hosts.add("beeejoy.com");
  hosts.add("www.beeejoy.com");
  hosts.add("localhost");
  return Array.from(hosts);
}

export async function POST(req: NextRequest) {
  try {
    // Enforced on the bytes actually read, not on a client-declared header.
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let body: { visitorId?: unknown; path?: unknown; referrer?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const visitorId = typeof body.visitorId === "string" ? body.visitorId.toLowerCase() : "";
    if (!VISITOR_ID_PATTERN.test(visitorId)) {
      return NextResponse.json({ error: "Invalid visitor id" }, { status: 400 });
    }

    const path = normalizePagePath(typeof body.path === "string" ? body.path : null);
    if (!path) return new NextResponse(null, { status: 204 });

    if (await isRateLimited(req)) {
      return NextResponse.json({ error: "Too many events" }, { status: 429 });
    }

    const productSlug = parseProductSlug(path);
    const referrerDomain = extractReferrerDomain(
      typeof body.referrer === "string" ? body.referrer : req.headers.get("referer"),
      ownHosts(req)
    );

    // ---- Role-based exclusions, resolved server-side against the database ----
    // The caller's own verified JWT is used for these reads: existing RLS already
    // authorises a user to see their own profile / vendor row / products, so the
    // decision needs no privileged key and cannot be steered by the browser. The
    // token is what getAuthenticatedUser validated; auth.uid() in Postgres is the
    // enforcement point.
    const auth = await getAuthenticatedUser(req);
    if (auth) {
      const identityDb = getUserClient(auth.token);
      const { data: profile, error: profileErr } = await identityDb.database
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profileErr) {
        // Unknown role: record nothing rather than risk polluting customer traffic.
        console.error("Analytics identity lookup error:", profileErr.message);
        return new NextResponse(null, { status: 204 });
      }

      // Admin activity is never customer traffic.
      if (profile?.role === "admin") return new NextResponse(null, { status: 204 });

      // Sellers are excluded from their own product statistics.
      if (productSlug) {
        const { data: vendor } = await identityDb.database
          .from("vendors")
          .select("id")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        if (vendor?.id) {
          const { data: ownProduct } = await identityDb.database
            .from("products")
            .select("id")
            .eq("slug", productSlug)
            .eq("vendor_id", vendor.id)
            .maybeSingle();

          if (ownProduct) return new NextResponse(null, { status: 204 });
        }
      }
    }

    // ---- Privileged write: server-only secret, no anon fallback, fail closed ----
    let db: ReturnType<typeof getServerClient>;
    try {
      db = getServerClient();
    } catch (err: any) {
      console.error("Analytics ingest unavailable:", err?.message);
      return NextResponse.json(
        { error: "Analytics is not configured on this server", configured: false },
        { status: 503 }
      );
    }

    // First-seen record (ON CONFLICT DO NOTHING: never overwrites the original).
    const { error: visitorErr } = await db.database
      .from("analytics_visitors")
      .upsert(
        [{ visitor_id: visitorId, first_referrer_domain: referrerDomain }],
        { onConflict: "visitor_id", ignoreDuplicates: true }
      );

    // One row per visitor + path + Asia/Dhaka day. occurred_at is the database
    // clock and view_date is derived from it by a STORED generated column, so the
    // payload deliberately carries no time value at all.
    const { error: viewErr } = await db.database
      .from("analytics_page_views")
      .upsert(
        [
          {
            visitor_id: visitorId,
            page_path: path,
            product_slug: productSlug,
            referrer_domain: referrerDomain,
          },
        ],
        { onConflict: "visitor_id,page_path,view_date", ignoreDuplicates: true }
      );

    const writeError = visitorErr || viewErr;
    if (writeError) {
      const missingRelation =
        writeError.message?.includes("does not exist") || (writeError as any).code === "42P01";
      console.error("Analytics write error:", writeError.message);
      return NextResponse.json(
        {
          error: missingRelation
            ? "Analytics tables are missing. Apply migrations/20261106120000_create-website-analytics.sql."
            : writeError.message,
          migrationRequired: missingRelation,
        },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error("Analytics track error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
