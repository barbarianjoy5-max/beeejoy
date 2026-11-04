import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSeller } from "@/lib/insforge-server";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedSeller(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Access denied. Active seller account required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId") || "";
    const rawPath = searchParams.get("path") || "";

    let videoStoragePath = rawPath;

    // If productId is provided, verify ownership and get pending_video_path
    if (productId) {
      const { data: product, error: prodErr } = await auth.adminDb.database
        .from("products")
        .select("id, vendor_id, metadata")
        .eq("id", productId)
        .maybeSingle();

      if (prodErr || !product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      if (product.vendor_id !== auth.vendor.id) {
        return NextResponse.json(
          { error: "Access denied. You can only view your own videos." },
          { status: 403 }
        );
      }

      videoStoragePath = product.metadata?.pending_video_path || "";
    } else if (rawPath) {
      // If direct path is requested, ensure it belongs to this seller's vendor folder
      if (!rawPath.startsWith(`pending-videos/${auth.vendor.id}/`)) {
        return NextResponse.json(
          { error: "Access denied. Path not authorized." },
          { status: 403 }
        );
      }
    }

    if (!videoStoragePath) {
      return NextResponse.json(
        { error: "No pending video found for this product" },
        { status: 404 }
      );
    }

    // Generate a secure 15-minute (900 seconds) signed URL from private software-packages bucket
    const { data: signedData, error: signErr } = await auth.adminDb.storage
      .from("software-packages")
      .createSignedUrl(videoStoragePath, 900);

    if (signErr || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: signErr?.message || "Failed to generate video preview URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ previewUrl: signedData.signedUrl });
  } catch (err: any) {
    console.error("Seller video preview error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
