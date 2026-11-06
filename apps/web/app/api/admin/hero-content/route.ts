import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/insforge-server";
import {
  HERO_CONTENT_KEY,
  HERO_LIMITS,
  normalizeHeroContent,
} from "@/lib/hero-content";

export const dynamic = "force-dynamic";

// The editor must always read the latest saved values.
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Access denied. Admin authorization required." },
        { status: 403 }
      );
    }

    const { data, error } = await admin.adminDb.database
      .from("site_settings")
      .select("value, updated_at")
      .eq("key", HERO_CONTENT_KEY)
      .maybeSingle();

    if (error) {
      console.warn("Hero content query error:", error);
    }

    return NextResponse.json(
      {
        hero: normalizeHeroContent(data?.value),
      },
      { headers: NO_STORE }
    );
  } catch (err: any) {
    console.error("Admin hero content GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Access denied. Admin authorization required." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const draft = body?.hero;

    if (!draft || typeof draft !== "object") {
      return NextResponse.json(
        { error: "Invalid payload. Expected a 'hero' object." },
        { status: 400 }
      );
    }

    // --- Validation ---------------------------------------------------------
    const heading = typeof draft.heading === "string" ? draft.heading.trim() : "";
    if (!heading) {
      return NextResponse.json(
        { error: "Main heading is required." },
        { status: 400 }
      );
    }
    if (heading.length > HERO_LIMITS.heading.max) {
      return NextResponse.json(
        { error: `Main heading must be ${HERO_LIMITS.heading.max} characters or fewer.` },
        { status: 400 }
      );
    }

    if (draft.description != null && typeof draft.description !== "string") {
      return NextResponse.json(
        { error: "Hero description must be text." },
        { status: 400 }
      );
    }

    const description = typeof draft.description === "string" ? draft.description.trim() : "";
    if (description.length > HERO_LIMITS.description.max) {
      return NextResponse.json(
        { error: `Hero description must be ${HERO_LIMITS.description.max} characters or fewer.` },
        { status: 400 }
      );
    }

    if (!Array.isArray(draft.phrases)) {
      return NextResponse.json(
        { error: "Animated phrases must be a list." },
        { status: 400 }
      );
    }

    const phrases = draft.phrases
      .map((phrase: unknown) => (typeof phrase === "string" ? phrase.trim() : ""))
      .filter((phrase: string) => phrase.length > 0);

    if (phrases.length < HERO_LIMITS.phrases.min) {
      return NextResponse.json(
        { error: "Add at least one animated phrase." },
        { status: 400 }
      );
    }
    if (phrases.length > HERO_LIMITS.phrases.max) {
      return NextResponse.json(
        { error: `You can configure up to ${HERO_LIMITS.phrases.max} phrases.` },
        { status: 400 }
      );
    }
    if (phrases.some((phrase: string) => phrase.length > HERO_LIMITS.phrases.length)) {
      return NextResponse.json(
        { error: `Each phrase must be ${HERO_LIMITS.phrases.length} characters or fewer.` },
        { status: 400 }
      );
    }

    // --- Persist ------------------------------------------------------------
    // normalizeHeroContent() clamps the speed sliders and fills any missing flag.
    const config = normalizeHeroContent({
      heading,
      description,
      phrases,
      typewriter_enabled: draft.typewriter_enabled,
      cursor_enabled: draft.cursor_enabled,
      typing_speed_ms: draft.typing_speed_ms,
      deleting_speed_ms: draft.deleting_speed_ms,
      pause_ms: draft.pause_ms,
      updated_at: new Date().toISOString(),
    });

    const { error: saveErr } = await admin.adminDb.database
      .from("site_settings")
      .upsert(
        [
          {
            key: HERO_CONTENT_KEY,
            value: config,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "key" }
      );

    if (saveErr) {
      console.error("Hero content save error:", saveErr);
      return NextResponse.json(
        { error: `Failed to save hero content: ${saveErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Hero content saved successfully.",
      hero: config,
    });
  } catch (err: any) {
    console.error("Admin hero content POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
