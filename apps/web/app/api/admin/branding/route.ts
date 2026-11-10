import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/insforge-server";
import { sanitizeSvg } from "@/lib/svg-sanitizer";
import {
  BRANDING_SIZE_LIMITS,
  SITE_BRANDING_KEY,
  isBrandingSizeKey,
  normalizeSiteBranding,
  toDisplayBranding,
  type BrandingSizes,
} from "@/lib/branding";
import { SiteBrandingConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

const SETTING_KEY = SITE_BRANDING_KEY;
const MAX_SVG_SIZE = 2 * 1024 * 1024; // 2MB

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
      .eq("key", SETTING_KEY)
      .maybeSingle();

    if (error) {
      console.warn("Branding settings query error:", error);
    }

    const config = normalizeSiteBranding(data?.value);

    return NextResponse.json({
      branding: toDisplayBranding(config),
    });
  } catch (err: any) {
    console.error("Admin site branding GET error:", err);
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

    // Get current branding config
    const { data: existingRow } = await admin.adminDb.database
      .from("site_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();

    const currentConfig: SiteBrandingConfig = normalizeSiteBranding(existingRow?.value);

    const contentType = req.headers.get("content-type") || "";

    // Case 1: Upload (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const target = (formData.get("target") || formData.get("type")) as string;
      // "icon"/"wordmark" = Dark-mode assets; "*_light" = Light-mode overrides.
      const VALID_TARGETS = ["icon", "wordmark", "icon_light", "wordmark_light"];
      const file = formData.get("file") as File | null;

      if (!target || !VALID_TARGETS.includes(target)) {
        return NextResponse.json(
          { error: "Invalid target. Must be icon, wordmark, icon_light or wordmark_light." },
          { status: 400 }
        );
      }

      if (!file) {
        return NextResponse.json(
          { error: "No SVG file provided." },
          { status: 400 }
        );
      }

      // Check extension
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".svg")) {
        return NextResponse.json(
          { error: "Invalid file type. Only .svg files are allowed." },
          { status: 400 }
        );
      }

      // Check size
      if (file.size > MAX_SVG_SIZE) {
        return NextResponse.json(
          { error: "SVG file exceeds the 2MB size limit." },
          { status: 400 }
        );
      }

      // Read text and sanitize
      const rawSvg = await file.text();
      const validation = sanitizeSvg(rawSvg);
      if (!validation.valid || !validation.sanitizedSvg) {
        return NextResponse.json(
          { error: validation.error || "SVG failed security validation." },
          { status: 400 }
        );
      }

      const cleanSvg = validation.sanitizedSvg;
      const svgBlob = new Blob([cleanSvg], { type: "image/svg+xml" });
      const storagePath = `branding/${target.replace("_", "-")}-${Date.now()}.svg`;

      // Upload to public-assets
      const { error: uploadErr } = await admin.adminDb.storage
        .from("public-assets")
        .upload(storagePath, svgBlob);

      if (uploadErr) {
        console.error(`Branding ${target} upload error:`, uploadErr);
        return NextResponse.json(
          { error: `Upload failed: ${uploadErr.message}` },
          { status: 500 }
        );
      }

      const { data: urlData } = admin.adminDb.storage
        .from("public-assets")
        .getPublicUrl(storagePath);

      const publicUrl = urlData?.publicUrl || null;

      // Prepare updated config
      const FIELD_MAP: Record<string, { url: keyof SiteBrandingConfig; path: keyof SiteBrandingConfig; label: string }> = {
        icon: { url: "icon_url", path: "icon_storage_path", label: "Square icon (Dark)" },
        wordmark: { url: "wordmark_url", path: "wordmark_storage_path", label: "Site wordmark (Dark)" },
        icon_light: { url: "icon_light_url", path: "icon_light_storage_path", label: "Square icon (Light)" },
        wordmark_light: { url: "wordmark_light_url", path: "wordmark_light_storage_path", label: "Site wordmark (Light)" },
      };
      const fields = FIELD_MAP[target];
      const previousPath = currentConfig[fields.path] as string | null | undefined;

      const updatedConfig: SiteBrandingConfig = {
        ...currentConfig,
        [fields.url]: publicUrl,
        [fields.path]: storagePath,
        updated_at: new Date().toISOString(),
      };

      const { error: saveErr } = await admin.adminDb.database
        .from("site_settings")
        .upsert(
          [
            {
              key: SETTING_KEY,
              value: updatedConfig,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "key" }
        );

      if (saveErr) {
        console.error("Branding setting save error:", saveErr);
        // Rollback uploaded file
        await admin.adminDb.storage.from("public-assets").remove([storagePath]).catch(() => {});
        return NextResponse.json(
          { error: `Failed to save branding settings: ${saveErr.message}` },
          { status: 500 }
        );
      }

      // Safely delete previous asset
      if (previousPath && previousPath !== storagePath) {
        await admin.adminDb.storage
          .from("public-assets")
          .remove([previousPath])
          .catch((e: any) => console.warn("Old branding file removal warning:", e));
      }

      return NextResponse.json({
        success: true,
        message: `${fields.label} updated successfully.`,
        branding: toDisplayBranding(updatedConfig),
      });
    }

    // Case 2: JSON Action (e.g. remove)
    const body = await req.json();
    const action = body.action;

    const REMOVE_MAP: Record<string, { url: keyof SiteBrandingConfig; path: keyof SiteBrandingConfig; label: string }> = {
      remove_icon: { url: "icon_url", path: "icon_storage_path", label: "Square icon (Dark)" },
      remove_wordmark: { url: "wordmark_url", path: "wordmark_storage_path", label: "Site wordmark (Dark)" },
      remove_icon_light: { url: "icon_light_url", path: "icon_light_storage_path", label: "Square icon (Light)" },
      remove_wordmark_light: { url: "wordmark_light_url", path: "wordmark_light_storage_path", label: "Site wordmark (Light)" },
    };

    if (action && action in REMOVE_MAP) {
      const fields = REMOVE_MAP[action];
      const oldPath = currentConfig[fields.path] as string | null | undefined;

      const updatedConfig: SiteBrandingConfig = {
        ...currentConfig,
        [fields.url]: null,
        [fields.path]: null,
        updated_at: new Date().toISOString(),
      };

      const { error: saveErr } = await admin.adminDb.database
        .from("site_settings")
        .upsert(
          [
            {
              key: SETTING_KEY,
              value: updatedConfig,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "key" }
        );

      if (saveErr) {
        return NextResponse.json(
          { error: `Failed to update branding settings: ${saveErr.message}` },
          { status: 500 }
        );
      }

      // Clean up old storage file
      if (oldPath) {
        await admin.adminDb.storage
          .from("public-assets")
          .remove([oldPath])
          .catch((e: any) => console.warn("Branding file removal warning:", e));
      }

      return NextResponse.json({
        success: true,
        message: `${fields.label} removed. Reverted to default.`,
        branding: toDisplayBranding(updatedConfig),
      });
    }

    // Case 3: Global display sizes (square icon, wordmark, seller avatars).
    // Only the numeric size fields are merged in; asset URLs, storage paths and
    // the uploaded files themselves are never touched, and this can only be
    // reached by the verified single admin checked at the top of POST.
    if (action === "save_sizes") {
      const payload = body.sizes;

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return NextResponse.json(
          { error: "Invalid payload. Expected a 'sizes' object." },
          { status: 400 }
        );
      }

      const validatedSizes: Partial<BrandingSizes> = {};

      for (const [key, raw] of Object.entries(payload)) {
        if (!isBrandingSizeKey(key)) continue;

        const { min, max, label } = BRANDING_SIZE_LIMITS[key];

        if (typeof raw !== "number" || !Number.isInteger(raw)) {
          return NextResponse.json(
            { error: `${label} size must be a whole pixel number.` },
            { status: 400 }
          );
        }

        if (raw < min || raw > max) {
          return NextResponse.json(
            { error: `${label} size must be between ${min} and ${max} px.` },
            { status: 400 }
          );
        }

        validatedSizes[key] = raw;
      }

      if (Object.keys(validatedSizes).length === 0) {
        return NextResponse.json(
          { error: "No display size values provided to save." },
          { status: 400 }
        );
      }

      const updatedConfig: SiteBrandingConfig = {
        ...currentConfig,
        ...validatedSizes,
        updated_at: new Date().toISOString(),
      };

      const { error: saveErr } = await admin.adminDb.database
        .from("site_settings")
        .upsert(
          [
            {
              key: SETTING_KEY,
              value: updatedConfig,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "key" }
        );

      if (saveErr) {
        console.error("Branding size save error:", saveErr);
        return NextResponse.json(
          { error: `Failed to save branding sizes: ${saveErr.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Display sizes saved successfully.",
        branding: toDisplayBranding(updatedConfig),
      });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err: any) {
    console.error("Admin site branding POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
