import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getAuthenticatedUser } from "@/lib/insforge-server";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const storeName = typeof body.storeName === "string" ? body.storeName.trim() : "";
    const rawSlug = typeof body.slug === "string" ? body.slug.trim() : "";
    const bio = typeof body.bio === "string" ? body.bio.trim() : null;

    if (!storeName) {
      return NextResponse.json({ error: "Store/Seller name is required" }, { status: 400 });
    }

    const cleanSlug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!cleanSlug || cleanSlug.length < 3) {
      return NextResponse.json(
        { error: "Username/slug must be at least 3 alphanumeric characters" },
        { status: 400 }
      );
    }

    const adminDb = getAdminClient();

    // 1. Check if user already has an existing vendor application/store
    const { data: existingUserVendor } = await adminDb.database
      .from("vendors")
      .select("id, status, slug")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (existingUserVendor) {
      return NextResponse.json(
        {
          error: `You already have an existing seller record (${existingUserVendor.status}).`,
          vendor: existingUserVendor,
        },
        { status: 400 }
      );
    }

    // 2. Check if slug is already taken
    const { data: existingSlug } = await adminDb.database
      .from("vendors")
      .select("id")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (existingSlug) {
      return NextResponse.json(
        { error: `The store username "${cleanSlug}" is already taken. Please choose another.` },
        { status: 409 }
      );
    }

    // 3. Insert vendor application with pending status
    const { data: newVendor, error: insErr } = await adminDb.database
      .from("vendors")
      .insert([
        {
          user_id: auth.user.id,
          store_name: storeName,
          slug: cleanSlug,
          bio: bio || null,
          status: "pending",
          commission_rate: 15.0,
        },
      ])
      .select()
      .single();

    if (insErr || !newVendor) {
      console.error("Vendor application error:", insErr);
      return NextResponse.json(
        { error: insErr?.message || "Failed to submit seller application" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Seller application submitted successfully! Please wait for Admin approval.",
      vendor: newVendor,
    });
  } catch (err: any) {
    console.error("Seller apply route error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
