import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/insforge-server";
import { sanitizeSvg } from "@/lib/svg-sanitizer";
import { SITE_BRANDING_KEY, toDisplayBranding } from "@/lib/branding";
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

    const config = (data?.value as SiteBrandingConfig) || {
      icon_url: null,
      icon_storage_path: null,
      wordmark_url: null,
      wordmark_storage_path: null,
      updated_at: null,
    };

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

    const currentConfig: SiteBrandingConfig = (existingRow?.value as SiteBrandingConfig) || {
      icon_url: null,
      icon_storage_path: null,
      wordmark_url: null,
      wordmark_storage_path: null,
    };

    const contentType = req.headers.get("content-type") || "";

    // Case 1: Upload (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const target = (formData.get("target") || formData.get("type")) as string; // "icon" | "wordmark"
      const file = formData.get("file") as File | null;

      if (!target || (target !== "icon" && target !== "wordmark")) {
        return NextResponse.json(
          { error: "Invalid target. Must specify 'icon' or 'wordmark'." },
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
      const storagePath = `branding/${target}-${Date.now()}.svg`;

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
      const previousPath = target === "icon" ? currentConfig.icon_storage_path : currentConfig.wordmark_storage_path;

      const updatedConfig: SiteBrandingConfig = {
        ...currentConfig,
        ...(target === "icon"
          ? { icon_url: publicUrl, icon_storage_path: storagePath }
          : { wordmark_url: publicUrl, wordmark_storage_path: storagePath }),
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
        message: `${target === "icon" ? "Square icon" : "Site wordmark"} updated successfully.`,
        branding: toDisplayBranding(updatedConfig),
      });
    }

    // Case 2: JSON Action (e.g. remove)
    const body = await req.json();
    const action = body.action;

    if (action === "remove_icon" || action === "remove_wordmark") {
      const isIcon = action === "remove_icon";
      const oldPath = isIcon ? currentConfig.icon_storage_path : currentConfig.wordmark_storage_path;

      const updatedConfig: SiteBrandingConfig = {
        ...currentConfig,
        ...(isIcon
          ? { icon_url: null, icon_storage_path: null }
          : { wordmark_url: null, wordmark_storage_path: null }),
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
        message: `${isIcon ? "Square icon" : "Site wordmark"} removed. Reverted to default.`,
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
