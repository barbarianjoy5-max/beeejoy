import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getAuthenticatedUser } from "@/lib/insforge-server";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const adminDb = getAdminClient();
    const { data: vendor, error } = await adminDb.database
      .from("vendors")
      .select("id, user_id, store_name, slug, bio, cover_url, status, commission_rate, created_at, updated_at")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error || !vendor) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    // Also fetch avatar_url from profiles
    const { data: userProfile } = await adminDb.database
      .from("profiles")
      .select("avatar_url")
      .eq("id", auth.user.id)
      .maybeSingle();

    return NextResponse.json({
      vendor: {
        ...vendor,
        avatar_url: userProfile?.avatar_url || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const adminDb = getAdminClient();

    // 1. Get existing vendor record
    const { data: existingVendor, error: findErr } = await adminDb.database
      .from("vendors")
      .select("*")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (findErr || !existingVendor) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    // Only active vendors or admin can update profile details
    if (existingVendor.status !== "active") {
      return NextResponse.json(
        { error: "Only approved, active sellers can edit their profile" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const storeName = typeof body.storeName === "string" ? body.storeName.trim() : existingVendor.store_name;
    const rawSlug = typeof body.slug === "string" ? body.slug.trim() : existingVendor.slug;
    const bio = typeof body.bio === "string" ? body.bio.trim() : existingVendor.bio;
    const coverUrl = body.coverUrl !== undefined ? (typeof body.coverUrl === "string" ? body.coverUrl.trim() || null : null) : existingVendor.cover_url;
    const avatarUrl = body.avatarUrl !== undefined ? (typeof body.avatarUrl === "string" ? body.avatarUrl.trim() || null : null) : undefined;

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

    // 2. If slug is being changed, check if new slug is taken
    if (cleanSlug !== existingVendor.slug) {
      const { data: slugTaken } = await adminDb.database
        .from("vendors")
        .select("id")
        .eq("slug", cleanSlug)
        .neq("id", existingVendor.id)
        .maybeSingle();

      if (slugTaken) {
        return NextResponse.json(
          { error: `The store username "${cleanSlug}" is already taken.` },
          { status: 409 }
        );
      }
    }

    // 3. Update safe fields only (status, commission_rate, and user_id are strictly preserved)
    const { data: updatedVendor, error: updErr } = await adminDb.database
      .from("vendors")
      .update({
        store_name: storeName,
        slug: cleanSlug,
        bio: bio || null,
        cover_url: coverUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingVendor.id)
      .select()
      .single();

    if (updErr || !updatedVendor) {
      return NextResponse.json(
        { error: updErr?.message || "Failed to update seller profile" },
        { status: 500 }
      );
    }

    // 4. Update avatar_url in profiles if provided
    if (avatarUrl !== undefined) {
      await adminDb.database
        .from("profiles")
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", auth.user.id);
    }

    return NextResponse.json({
      success: true,
      message: "Seller profile updated successfully",
      vendor: {
        ...updatedVendor,
        avatar_url: avatarUrl !== undefined ? avatarUrl : null,
      },
    });
  } catch (err: any) {
    console.error("Seller profile update error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
