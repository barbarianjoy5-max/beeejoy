import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/insforge-server";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Load pending review products
    const { data: products, error: pErr } = await admin.adminDb.database
      .from("products")
      .select("*, software_releases(id, version_str, storage_path, file_size_bytes, is_active)")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false });

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    // Load vendor details
    const vendorIds = Array.from(new Set((products || []).map((p: any) => p.vendor_id).filter(Boolean)));

    let vendorMap = new Map<string, any>();
    if (vendorIds.length > 0) {
      const { data: vendors } = await admin.adminDb.database
        .from("vendors")
        .select("id, store_name, slug, user_id")
        .in("id", vendorIds);

      vendorMap = new Map((vendors || []).map((v: any) => [v.id, v]));
    }

    const enhancedProducts = (products || []).map((p: any) => ({
      ...p,
      vendor: vendorMap.get(p.vendor_id) || null,
    }));

    return NextResponse.json({ products: enhancedProducts });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const productId = typeof body.productId === "string" ? body.productId : "";
    const decision = body.decision; // "approve" | "reject" | "changes_requested"
    const adminFeedback = typeof body.adminFeedback === "string" ? body.adminFeedback.trim() : "";

    if (!productId || !["approve", "reject", "changes_requested"].includes(decision)) {
      return NextResponse.json({ error: "Valid productId and decision required" }, { status: 400 });
    }

    const { data: product, error: findErr } = await admin.adminDb.database
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (findErr || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const metadataPayload = { ...(product.metadata || {}) };

    if (decision === "approve") {
      delete metadataPayload.admin_feedback;

      // Check if there is a pending video that needs promotion from private storage
      const pendingVideoPath = metadataPayload.pending_video_path;
      if (pendingVideoPath) {
        try {
          // 1. Download video blob from private software-packages bucket
          const { data: videoBlob, error: dlErr } = await admin.adminDb.storage
            .from("software-packages")
            .download(pendingVideoPath);

          if (dlErr || !videoBlob) {
            console.error("Failed to download pending video:", dlErr);
            throw new Error(`Failed to retrieve pending video: ${dlErr?.message || "file not found"}`);
          }

          // Server-side validation: Max 200MB limit & allowed video types
          if (videoBlob.size > 200 * 1024 * 1024) {
            throw new Error("Video size exceeds the 200MB limit.");
          }

          const extMatch = pendingVideoPath.match(/\.(mp4|webm|mov)$/i);
          if (!extMatch) {
            throw new Error("Invalid video format. Only MP4, WebM, and MOV are supported.");
          }
          const ext = extMatch[1].toLowerCase();
          const publicVideoPath = `videos/${product.slug}-${Date.now()}.${ext}`;

          const { error: upErr } = await admin.adminDb.storage
            .from("public-assets")
            .upload(publicVideoPath, videoBlob);

          if (upErr) {
            console.error("Failed to upload video to public-assets:", upErr);
            throw new Error(`Failed to publish video: ${upErr.message}`);
          }

          const { data: urlData } = admin.adminDb.storage
            .from("public-assets")
            .getPublicUrl(publicVideoPath);

          const newPublicVideoUrl = urlData?.publicUrl || null;

          // 3. Delete old published video from public-assets if one existed
          const oldPublishedUrl = metadataPayload.demo_video_path;
          if (oldPublishedUrl && typeof oldPublishedUrl === "string") {
            const oldPathMatch = oldPublishedUrl.match(/videos\/[^?#]+/);
            if (oldPathMatch) {
              await admin.adminDb.storage
                .from("public-assets")
                .remove([oldPathMatch[0]])
                .catch((e: any) => console.warn("Old video cleanup warning:", e));
            }
          }

          // 4. Update metadata: assign demo_video_path and remove pending_video_path
          metadataPayload.demo_video_path = newPublicVideoUrl;
          delete metadataPayload.pending_video_path;

          // 5. Remove private staging file from software-packages
          await admin.adminDb.storage
            .from("software-packages")
            .remove([pendingVideoPath])
            .catch((e: any) => console.warn("Pending video cleanup warning:", e));
        } catch (videoErr: any) {
          console.error("Video promotion error during approval:", videoErr);
          return NextResponse.json(
            { error: `Video publishing failed: ${videoErr?.message || "Storage error"}` },
            { status: 500 }
          );
        }
      }

      const { error: updErr } = await admin.adminDb.database
        .from("products")
        .update({
          status: "published",
          metadata: metadataPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (updErr) throw updErr;

      return NextResponse.json({
        success: true,
        message: `Product "${product.title}" has been approved and published to the marketplace!`,
      });
    } else {
      // "reject" or "changes_requested" -> sets to 'draft'
      if (adminFeedback) {
        metadataPayload.admin_feedback = adminFeedback;
      }

      const { error: updErr } = await admin.adminDb.database
        .from("products")
        .update({
          status: "draft",
          metadata: metadataPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (updErr) throw updErr;

      return NextResponse.json({
        success: true,
        message: `Product "${product.title}" status changed to Draft (${decision}).`,
      });
    }
  } catch (err: any) {
    console.error("Product review decision error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
