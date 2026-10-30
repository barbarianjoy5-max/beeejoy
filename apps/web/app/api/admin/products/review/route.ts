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
