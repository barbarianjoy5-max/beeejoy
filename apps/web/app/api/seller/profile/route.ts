import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getAuthenticatedAdmin, getAuthenticatedUser, getUserClient } from "@/lib/insforge-server";

/**
 * Avatar-only save for the single admin account.
 *
 * The admin owns no vendors row, so the vendor-scoped checks in PUT can never
 * pass for it, yet its picture still lives on profiles.avatar_url (the same
 * column the seller flow writes). Returns null when the caller is not the
 * verified admin so the route falls through to its original seller error.
 * The write target is the subject of the admin check itself - never a value
 * from the request body - and only avatar_url is touched.
 *
 * avatar_url is the one column this may overwrite, so the accepted input is
 * restricted to string | null. Anything else is rejected with 400 BEFORE any
 * write: coercing a malformed value to null would silently delete the picture
 * the admin already has.
 */
async function saveAdminAvatarOnly(req: NextRequest): Promise<NextResponse | null> {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return null;

  const body = await req.json().catch(() => null);
  if (!body || body.avatarUrl === undefined) {
    return NextResponse.json(
      { error: "Admin accounts have no store profile to edit; only the profile picture can be saved." },
      { status: 400 }
    );
  }

  // Only a URL string or an explicit null may reach the write.
  if (typeof body.avatarUrl !== "string" && body.avatarUrl !== null) {
    return NextResponse.json(
      { error: "Invalid profile picture: avatarUrl must be a URL string or null." },
      { status: 400 }
    );
  }

  // Empty or whitespace-only string means "no picture", same as null.
  const avatarUrl =
    typeof body.avatarUrl === "string" ? body.avatarUrl.trim() || null : null;

  const { error } = await admin.adminDb.database
    .from("profiles")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", admin.user.id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update profile picture" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Profile picture updated successfully",
    avatar_url: avatarUrl,
  });
}

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

    // A missing vendor record is expected for the admin, which has no store.
    if (findErr || !existingVendor) {
      const adminOnly = await saveAdminAvatarOnly(req);
      if (adminOnly) return adminOnly;
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    // Only active vendors or admin can update profile details
    if (existingVendor.status !== "active") {
      const adminOnly = await saveAdminAvatarOnly(req);
      if (adminOnly) return adminOnly;
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

    // 4. Update avatar_url in profiles if provided.
    // The write runs on the caller's own JWT client rather than the privileged
    // key: profiles RLS decides on auth.uid() = id, and a key that carries no
    // user identity matches zero rows while still answering without an error -
    // which previously reported a save the database never applied. Asserting on
    // the returned row turns that silent no-op into an explicit failure.
    if (avatarUrl !== undefined) {
      const { error: avatarErr, data: avatarRows } = await getUserClient(auth.token)
        .database
        .from("profiles")
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", auth.user.id)
        .select("id");

      if (avatarErr) {
        return NextResponse.json(
          { error: avatarErr.message || "Failed to update profile picture" },
          { status: 500 }
        );
      }

      if (!avatarRows || avatarRows.length === 0) {
        return NextResponse.json(
          { error: "Profile picture was not saved: no profile row matched the signed-in user." },
          { status: 500 }
        );
      }
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
