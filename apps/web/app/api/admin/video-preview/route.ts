import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/insforge-server";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Access denied. Admin authorization required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId") || "";
    const rawPath = searchParams.get("path") || "";

    let videoStoragePath = rawPath;

    if (productId) {
      const { data: product, error: prodErr } = await admin.adminDb.database
        .from("products")
        .select("id, metadata")
        .eq("id", productId)
        .maybeSingle();

      if (prodErr || !product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      videoStoragePath = product.metadata?.pending_video_path || "";
    }

    if (!videoStoragePath) {
      return NextResponse.json(
        { error: "No pending video found for this product" },
        { status: 404 }
      );
    }

    // Generate a secure 15-minute (900 seconds) signed URL from private software-packages bucket
    const { data: signedData, error: signErr } = await admin.adminDb.storage
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
    console.error("Admin video preview error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
