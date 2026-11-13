import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/insforge-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

// ==============================================================================
// GET /api/site/products
// Public endpoint for published products enriched with vendor details,
// sorted by vendor product_priority (descending) with fallback to created_at (descending).
// ==============================================================================

export async function GET() {
  try {
    const db = getServerClient();

    // 1. Fetch published products
    const { data: prodsData, error: pErr } = await db.database
      .from("products")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    // 2. Fetch active vendors with priority and permissions
    const { data: vendorsData, error: vErr } = await db.database
      .from("vendors")
      .select("id, store_name, slug, bio, cover_url, product_priority, showcase_enabled, whatsapp_enabled, created_at")
      .eq("status", "active");

    const vendorMap = new Map((vendorsData || []).map((v: any) => [v.id, v]));

    // 3. Enrich products and sort by vendor product_priority DESC, then created_at DESC
    const enriched = (prodsData || []).map((p: any) => {
      const v = p.vendor_id ? vendorMap.get(p.vendor_id) || null : null;
      return {
        ...p,
        vendor: v
          ? {
              id: v.id,
              store_name: v.store_name,
              slug: v.slug,
              bio: v.bio,
              cover_url: v.cover_url,
              created_at: v.created_at,
              product_priority: v.product_priority ?? 0,
              showcase_enabled: !!v.showcase_enabled,
              whatsapp_enabled: v.whatsapp_enabled !== false,
            }
          : null,
        vendor_priority: v?.product_priority ?? 0,
      };
    });

    enriched.sort((a: any, b: any) => {
      const pDiff = (b.vendor_priority ?? 0) - (a.vendor_priority ?? 0);
      if (pDiff !== 0) return pDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({ products: enriched }, { headers: NO_STORE });
  } catch (err: any) {
    console.error("Site products GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
