import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/insforge-server";
import { HomepageAnimationConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

const SETTING_KEY = "homepage_hero_animation";
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = ["video/mp4", "video/webm"];
const ALLOWED_EXTENSIONS = [".mp4", ".webm"];

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
      const isMissingTable =
        error.message?.includes("does not exist") ||
        (error as any).code === "42P01";
      return NextResponse.json({
        animation: null,
        tableExists: !isMissingTable,
        message: isMissingTable
          ? "Database table 'site_settings' has not been created yet."
          : error.message,
      });
    }

    const config = (data?.value as HomepageAnimationConfig) || null;

    return NextResponse.json({
      animation: config || {
        enabled: false,
        video_url: null,
        storage_path: null,
        updated_at: null,
      },
      tableExists: true,
    });
  } catch (err: any) {
    console.error("Admin homepage animation GET error:", err);
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

    // Check if site_settings table exists
    const { data: existingRow, error: checkErr } = await admin.adminDb.database
      .from("site_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();

    if (checkErr && (checkErr.message?.includes("does not exist") || (checkErr as any).code === "42P01")) {
      return NextResponse.json(
        {
          error:
            "Database table 'site_settings' does not exist yet. Please approve and apply the migration first.",
          tableExists: false,
        },
        { status: 400 }
      );
    }

    const currentConfig: HomepageAnimationConfig = (existingRow?.value as HomepageAnimationConfig) || {
      enabled: false,
      video_url: null,
      storage_path: null,
    };

    const contentType = req.headers.get("content-type") || "";

    // Case 1: File Upload (Multipart Form Data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("video") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No video file provided" }, { status: 400 });
      }

      // 1. Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
        return NextResponse.json(
          { error: "Invalid video format. Only MP4 and WebM videos are allowed." },
          { status: 400 }
        );
      }

      // 2. Validate file extension
      const fileName = file.name.toLowerCase();
      const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
      if (!hasValidExt) {
        return NextResponse.json(
          { error: "Invalid file extension. Please upload a .mp4 or .webm file." },
          { status: 400 }
        );
      }

      // 3. Validate size
      if (file.size > MAX_VIDEO_SIZE) {
        return NextResponse.json(
          { error: "Video file exceeds the 50MB limit." },
          { status: 400 }
        );
      }

      const ext = fileName.endsWith(".webm") ? "webm" : "mp4";
      const newStoragePath = `animations/hero-animation-${Date.now()}.${ext}`;

      // 4. Upload new video FIRST (so failure never breaks the active animation)
      const { error: uploadErr } = await admin.adminDb.storage
        .from("public-assets")
        .upload(newStoragePath, file);

      if (uploadErr) {
        console.error("Hero animation upload error:", uploadErr);
        return NextResponse.json(
          { error: `Video upload failed: ${uploadErr.message}` },
          { status: 500 }
        );
      }

      const { data: urlData } = admin.adminDb.storage
        .from("public-assets")
        .getPublicUrl(newStoragePath);

      const newVideoUrl = urlData?.publicUrl || null;
      const oldStoragePath = currentConfig.storage_path;

      // 5. Update setting in database
      const updatedConfig: HomepageAnimationConfig = {
        enabled: true, // Auto-enable when new animation uploaded
        video_url: newVideoUrl,
        storage_path: newStoragePath,
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
        console.error("Hero animation setting save error:", saveErr);
        // Rollback uploaded file
        await admin.adminDb.storage.from("public-assets").remove([newStoragePath]).catch(() => {});
        return NextResponse.json(
          { error: `Failed to save animation settings: ${saveErr.message}` },
          { status: 500 }
        );
      }

      // 6. Safely clean up previous animation video if one existed
      if (oldStoragePath && oldStoragePath !== newStoragePath) {
        await admin.adminDb.storage
          .from("public-assets")
          .remove([oldStoragePath])
          .catch((e: any) => console.warn("Old hero animation cleanup warning:", e));
      }

      return NextResponse.json({
        success: true,
        message: "Homepage animation uploaded and enabled successfully",
        animation: updatedConfig,
      });
    }

    // Case 2: JSON Payload (Toggle or Remove)
    const body = await req.json();
    const action = body.action;

    if (action === "toggle") {
      const isEnabled = Boolean(body.enabled);
      if (!currentConfig.video_url && isEnabled) {
        return NextResponse.json(
          { error: "Cannot enable animation without an uploaded video." },
          { status: 400 }
        );
      }

      const updatedConfig: HomepageAnimationConfig = {
        ...currentConfig,
        enabled: isEnabled,
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
          { error: `Failed to update toggle: ${saveErr.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Homepage animation ${isEnabled ? "enabled" : "disabled"}`,
        animation: updatedConfig,
      });
    }

    if (action === "remove") {
      const oldStoragePath = currentConfig.storage_path;

      const updatedConfig: HomepageAnimationConfig = {
        enabled: false,
        video_url: null,
        storage_path: null,
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
          { error: `Failed to remove animation: ${saveErr.message}` },
          { status: 500 }
        );
      }

      // Clean up file from storage
      if (oldStoragePath) {
        await admin.adminDb.storage
          .from("public-assets")
          .remove([oldStoragePath])
          .catch((e: any) => console.warn("Removed hero animation cleanup warning:", e));
      }

      return NextResponse.json({
        success: true,
        message: "Homepage animation removed",
        animation: updatedConfig,
      });
    }

    return NextResponse.json({ error: "Invalid action requested" }, { status: 400 });
  } catch (err: any) {
    console.error("Admin homepage animation POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
