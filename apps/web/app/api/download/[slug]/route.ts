import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-server";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: "Product slug is required" }, { status: 400 });
    }

    const adminDb = getAdminClient();

    // 1. Fetch product record
    const { data: product, error: prodErr } = await adminDb.database
      .from("products")
      .select("id, title, slug, status, product_type")
      .eq("slug", slug)
      .maybeSingle();

    if (prodErr || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 2. Authorization Rule: Status must be published
    if (product.status !== "published") {
      return NextResponse.json(
        { error: "This product is not currently available for download" },
        { status: 404 }
      );
    }

    // 3. Authorization Rule: Product type must be exactly 'free'
    // Strict requirement: Do not use price_cents to infer free status.
    if (product.product_type !== "free") {
      return NextResponse.json(
        { error: "Access denied. Premium software must be ordered through WhatsApp." },
        { status: 403 }
      );
    }

    // 4. Authorization Rule: Active release must exist
    const { data: release, error: relErr } = await adminDb.database
      .from("software_releases")
      .select("storage_path")
      .eq("product_id", product.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (relErr || !release || !release.storage_path) {
      return NextResponse.json(
        { error: "No download package is currently attached to this product" },
        { status: 404 }
      );
    }

    // 5. Generate short-lived (60s) signed URL from private software-packages bucket
    const { data: signedData, error: signErr } = await adminDb.storage
      .from("software-packages")
      .createSignedUrl(release.storage_path, 60);

    if (signErr || !signedData?.signedUrl) {
      console.error("Failed to generate signed download URL:", signErr);
      return NextResponse.json(
        { error: "Failed to generate secure download link" },
        { status: 500 }
      );
    }

    // 6. Direct HTTP 302 Redirect to begin download immediately
    return NextResponse.redirect(signedData.signedUrl, 302);
  } catch (err: any) {
    console.error("Download route error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
