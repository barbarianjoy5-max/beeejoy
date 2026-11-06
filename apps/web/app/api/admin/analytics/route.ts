import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin, getUserClient } from "@/lib/insforge-server";
import { AnalyticsRangePreset, resolveAnalyticsRange } from "@/lib/analytics";

export const dynamic = "force-dynamic";

// ==============================================================================
// BEEEJOY admin-only website analytics report
// ------------------------------------------------------------------------------
// Access is checked twice:
//   1. here, with a server-verified JWT and a profiles.role lookup, and
//   2. inside public.analytics_report(), which refuses unless is_admin() is true.
// The RPC runs with the admin's own token and aggregates entirely in PostgreSQL,
// so no raw event history is ever transferred to the browser.
// ==============================================================================

const ALLOWED_PRESETS: AnalyticsRangePreset[] = ["today", "7d", "30d", "custom"];

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const preset = (params.get("range") || "7d") as AnalyticsRangePreset;
    if (!ALLOWED_PRESETS.includes(preset)) {
      return NextResponse.json({ error: "Unsupported range preset" }, { status: 400 });
    }

    const resolved = resolveAnalyticsRange(
      preset,
      params.get("from") || undefined,
      params.get("to") || undefined
    );
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const userClient = getUserClient(admin.token);
    const { data, error } = await userClient.database.rpc("analytics_report", {
      p_from: resolved.from,
      p_to: resolved.to,
    });

    if (error) {
      const missingFunction =
        error.message?.includes("does not exist") ||
        (error as any).code === "42883" ||
        (error as any).code === "PGRST202";
      const forbidden = (error as any).code === "42501" || error.message?.includes("Admin access");

      if (missingFunction) {
        return NextResponse.json(
          {
            error:
              "Analytics report function is missing. Apply migrations/20261106120000_create-website-analytics.sql.",
            migrationRequired: true,
          },
          { status: 503 }
        );
      }

      console.error("Analytics report error:", error.message);
      return NextResponse.json(
        { error: forbidden ? "Admin access required" : error.message },
        { status: forbidden ? 403 : 500 }
      );
    }

    return NextResponse.json({ report: data ?? null });
  } catch (err: any) {
    console.error("Admin analytics GET error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
