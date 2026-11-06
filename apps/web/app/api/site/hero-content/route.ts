import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-server";
import {
  DEFAULT_HERO_CONTENT,
  HERO_CONTENT_KEY,
  normalizeHeroContent,
} from "@/lib/hero-content";

export const dynamic = "force-dynamic";

// Admin edits must show up on the next request, never from a browser cache.
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/**
 * Public Hero content. Always returns a complete, bounded config so the
 * homepage can render the current copy as a fallback when nothing is saved.
 */
export async function GET() {
  try {
    const adminDb = getAdminClient();
    const { data, error } = await adminDb.database
      .from("site_settings")
      .select("value")
      .eq("key", HERO_CONTENT_KEY)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ hero: DEFAULT_HERO_CONTENT }, { headers: NO_STORE });
    }

    return NextResponse.json(
      {
        hero: normalizeHeroContent(data.value),
      },
      { headers: NO_STORE }
    );
  } catch (err: any) {
    console.warn("Site hero content query warning:", err);
    return NextResponse.json({ hero: DEFAULT_HERO_CONTENT }, { headers: NO_STORE });
  }
}
