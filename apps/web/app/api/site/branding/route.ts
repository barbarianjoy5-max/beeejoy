import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-server";
import { SITE_BRANDING_KEY, toDisplayBranding } from "@/lib/branding";
import { SiteBrandingConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adminDb = getAdminClient();
    const { data, error } = await adminDb.database
      .from("site_settings")
      .select("value")
      .eq("key", SITE_BRANDING_KEY)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({
        icon_url: null,
        wordmark_url: null,
      });
    }

    const stored = (data.value as SiteBrandingConfig) || null;
    const config = stored ? toDisplayBranding(stored) : null;

    return NextResponse.json({
      icon_url: config?.icon_url || null,
      wordmark_url: config?.wordmark_url || null,
    });
  } catch (err: any) {
    console.warn("Site branding query warning:", err);
    return NextResponse.json({
      icon_url: null,
      wordmark_url: null,
    });
  }
}
