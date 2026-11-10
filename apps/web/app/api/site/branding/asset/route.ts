import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-server";
import { sanitizeSvg } from "@/lib/svg-sanitizer";
import {
  BRANDING_BUCKET,
  SITE_BRANDING_KEY,
  isBrandingTarget,
  isBrandingTheme,
} from "@/lib/branding";
import { SiteBrandingConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

function notFound() {
  return NextResponse.json(
    { error: "Branding asset not found." },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Serves the active Square Icon / Site Wordmark SVG.
 *
 * InsForge storage delivers objects as `application/octet-stream`, so browsers
 * reject them inside <img>. Re-serving the sanitized file from the same origin
 * with `image/svg+xml` makes the logos render without redeploying.
 *
 * The storage key always comes from site_settings (never from the request),
 * so this route cannot be used to read arbitrary objects.
 */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("target");

  if (!isBrandingTarget(target)) {
    return notFound();
  }

  try {
    const adminDb = getAdminClient();

    const { data, error } = await adminDb.database
      .from("site_settings")
      .select("value")
      .eq("key", SITE_BRANDING_KEY)
      .maybeSingle();

    if (error || !data) {
      return notFound();
    }

    const config = (data.value as SiteBrandingConfig) || null;

    // Optional theme=light selects the light-mode upload; when none exists the
    // dark asset is served so the header never loses its logo.
    const themeParam = req.nextUrl.searchParams.get("theme");
    const theme = isBrandingTheme(themeParam) ? themeParam : "dark";

    const storagePath =
      target === "icon"
        ? theme === "light"
          ? config?.icon_light_storage_path || config?.icon_storage_path
          : config?.icon_storage_path
        : theme === "light"
          ? config?.wordmark_light_storage_path || config?.wordmark_storage_path
          : config?.wordmark_storage_path;

    if (!storagePath) {
      return notFound();
    }

    const { data: file, error: downloadError } = await adminDb.storage
      .from(BRANDING_BUCKET)
      .download(storagePath);

    if (downloadError || !file) {
      console.warn(`Branding ${target} download failed:`, downloadError);
      return notFound();
    }

    // Defense in depth: the SVG was sanitized on upload, re-validate on read.
    const validation = sanitizeSvg(await file.text());
    if (!validation.valid || !validation.sanitizedSvg) {
      console.warn(`Branding ${target} failed re-validation:`, validation.error);
      return notFound();
    }

    return new NextResponse(validation.sanitizedSvg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        // The URL carries a version token, so the bytes never change in place.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err: any) {
    console.error(`Branding ${target} asset error:`, err?.message || err);
    return notFound();
  }
}
