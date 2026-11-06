import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-server";
import { HomepageAnimationConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adminDb = getAdminClient();
    const { data, error } = await adminDb.database
      .from("site_settings")
      .select("value")
      .eq("key", "homepage_hero_animation")
      .maybeSingle();

    if (error) {
      // Graceful fallback if table does not exist yet
      return NextResponse.json({
        animation: null,
        enabled: false,
      });
    }

    const config = (data?.value as HomepageAnimationConfig) || null;

    if (!config || !config.enabled || !config.video_url) {
      return NextResponse.json({
        animation: null,
        enabled: false,
      });
    }

    return NextResponse.json({
      animation: {
        enabled: Boolean(config.enabled),
        video_url: config.video_url,
      },
      enabled: Boolean(config.enabled),
    });
  } catch (err: any) {
    console.warn("Homepage animation query warning:", err);
    return NextResponse.json({
      animation: null,
      enabled: false,
    });
  }
}
