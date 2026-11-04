import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const adminDb = getAdminClient();

    // 1. Fetch vendor from public_vendors view or vendors table (status = 'active')
    const { data: vendor, error: vErr } = await adminDb.database
      .from("vendors")
      .select("id, user_id, store_name, slug, bio, cover_url, status, created_at")
      .eq("slug", username)
      .eq("status", "active")
      .maybeSingle();

    if (vErr || !vendor) {
      return NextResponse.json({ error: "Seller store not found" }, { status: 404 });
    }

    // 2. Fetch avatar_url from profiles using vendor.user_id
    let avatarUrl: string | null = null;
    if (vendor.user_id) {
      const { data: profile } = await adminDb.database
        .from("profiles")
        .select("avatar_url")
        .eq("id", vendor.user_id)
        .maybeSingle();

      avatarUrl = profile?.avatar_url || null;
    }

    // 3. Fetch only published products belonging to this seller
    const { data: products, error: pErr } = await adminDb.database
      .from("products")
      .select("id, title, slug, tagline, description, product_type, price_cents, currency, status, thumbnail_url, metadata, is_featured, created_at")
      .eq("vendor_id", vendor.id)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    // Expose only safe public vendor information
    return NextResponse.json({
      vendor: {
        id: vendor.id,
        store_name: vendor.store_name,
        slug: vendor.slug,
        bio: vendor.bio,
        cover_url: vendor.cover_url,
        avatar_url: avatarUrl,
        created_at: vendor.created_at,
      },
      products: products || [],
    });
  } catch (err: any) {
    console.error("Public seller query error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
