import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin, getUserClient } from "@/lib/insforge-server";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Load all vendors
    const { data: vendors, error: vErr } = await admin.adminDb.database
      .from("vendors")
      .select("*")
      .order("created_at", { ascending: false });

    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 500 });
    }

    // Load associated profiles and products count
    const { data: profiles } = await admin.adminDb.database
      .from("profiles")
      .select("id, email, full_name, role, avatar_url");

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const { data: products } = await admin.adminDb.database
      .from("products")
      .select("id, vendor_id, status");

    const productCounts = new Map<string, { total: number; published: number; pending: number }>();
    for (const p of products || []) {
      if (!p.vendor_id) continue;
      const current = productCounts.get(p.vendor_id) || { total: 0, published: 0, pending: 0 };
      current.total += 1;
      if (p.status === "published") current.published += 1;
      if (p.status === "pending_review") current.pending += 1;
      productCounts.set(p.vendor_id, current);
    }

    const enhancedVendors = (vendors || []).map((v: any) => ({
      ...v,
      user: profileMap.get(v.user_id) || null,
      stats: productCounts.get(v.id) || { total: 0, published: 0, pending: 0 },
    }));

    return NextResponse.json({ vendors: enhancedVendors });
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
    const vendorId = typeof body.vendorId === "string" ? body.vendorId : "";
    const action = body.action; // "approve" | "reject" | "suspend"

    if (!vendorId || !["approve", "reject", "suspend"].includes(action)) {
      return NextResponse.json({ error: "Valid vendorId and action required" }, { status: 400 });
    }

    const { data: vendor, error: findErr } = await admin.adminDb.database
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .maybeSingle();

    if (findErr || !vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    if (action === "approve") {
      // Use the Admin's own JWT client so the vendor update guard trigger
      // sees auth.uid() = admin UUID and is_admin() returns true,
      // which allows the status field to be updated.
      const adminUserClient = getUserClient(admin.token);

      // 1. Activate vendor (trigger requires is_admin() == true, satisfied by admin JWT)
      const { error: updVErr } = await adminUserClient.database
        .from("vendors")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", vendorId);

      if (updVErr) throw updVErr;

      // 2. Escalate user profile role to 'vendor' (use adminDb service client)
      const { data: existingProf } = await admin.adminDb.database
        .from("profiles")
        .select("id")
        .eq("id", vendor.user_id)
        .maybeSingle();

      if (existingProf) {
        await admin.adminDb.database
          .from("profiles")
          .update({ role: "vendor", updated_at: new Date().toISOString() })
          .eq("id", vendor.user_id);
      } else {
        await admin.adminDb.database
          .from("profiles")
          .insert([
            {
              id: vendor.user_id,
              role: "vendor",
              updated_at: new Date().toISOString(),
            },
          ]);
      }

      return NextResponse.json({
        success: true,
        message: `Seller "${vendor.store_name}" approved successfully!`,
      });
    } else {
      // action is "reject" or "suspend"
      // Use admin JWT client so the trigger allows status change
      const adminUserClient = getUserClient(admin.token);

      // 1. Suspend vendor
      const { error: updVErr } = await adminUserClient.database
        .from("vendors")
        .update({ status: "suspended", updated_at: new Date().toISOString() })
        .eq("id", vendorId);

      if (updVErr) throw updVErr;

      // 2. Revert user profile role to 'customer' if not admin
      if (vendor.user_id !== admin.user.id) {
        await admin.adminDb.database
          .from("profiles")
          .update({ role: "customer", updated_at: new Date().toISOString() })
          .eq("id", vendor.user_id);
      }

      return NextResponse.json({
        success: true,
        message: `Seller "${vendor.store_name}" ${action === "reject" ? "rejected" : "suspended"}.`,
      });
    }
  } catch (err: any) {
    console.error("Admin seller manage error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

function extractStorageKey(url: string, folder: "avatars" | "covers", owner: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const marker = `/public-assets/`;
    const idx = pathname.indexOf(marker);
    if (idx === -1) return null;
    const key = pathname.slice(idx + marker.length);
    if (!key.startsWith(`${folder}/${owner}-`)) return null;
    return key;
  } catch {
    return null;
  }
}
const PLAN_PRESETS: Record<string, Partial<Record<string, any>>> = {
  basic: {
    product_limit: 5,
    whatsapp_enabled: true,
    profile_picture_enabled: true,
    cover_photo_enabled: false,
    product_priority: 0,
    showcase_enabled: false,
    downloadable_enabled: false,
  },
  premium: {
    product_limit: 25,
    whatsapp_enabled: true,
    profile_picture_enabled: true,
    cover_photo_enabled: true,
    product_priority: 5,
    showcase_enabled: false,
    downloadable_enabled: true,
  },
  pro: {
    product_limit: 100,
    whatsapp_enabled: true,
    profile_picture_enabled: true,
    cover_photo_enabled: true,
    product_priority: 10,
    showcase_enabled: true,
    downloadable_enabled: true,
  },
  custom: {},
};

export async function PATCH(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const vendorId = typeof body.vendorId === "string" ? body.vendorId : "";
    if (!vendorId) {
      return NextResponse.json({ error: "vendorId is required" }, { status: 400 });
    }

    const { data: vendor, error: findErr } = await admin.adminDb.database
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .maybeSingle();

    if (findErr || !vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const validPlans = ["basic", "premium", "pro", "custom"];
    const requestedPlan =
      typeof body.membership_plan === "string" ? body.membership_plan : vendor.membership_plan;

    if (!validPlans.includes(requestedPlan)) {
      return NextResponse.json({ error: "Invalid membership plan" }, { status: 400 });
    }

    // Handle permission disable: delete owned storage object before clearing DB.
    const disableAvatar = body.profile_picture_enabled === false && vendor.profile_picture_enabled !== false;
    const disableCover = body.cover_photo_enabled === false && vendor.cover_photo_enabled !== false;

    if (disableAvatar) {
      const avatarUrl = vendor.avatar_url ?? null; // may be on profiles; fallback below
      // Fetch profile avatar_url if not present on vendor
      let resolvedAvatar = avatarUrl;
      if (!resolvedAvatar) {
        const { data: prof } = await admin.adminDb.database
          .from("profiles")
          .select("avatar_url")
          .eq("id", vendor.user_id)
          .maybeSingle();
        resolvedAvatar = prof?.avatar_url || null;
      }
      if (resolvedAvatar) {
        const key = extractStorageKey(resolvedAvatar, "avatars", vendor.id);
        if (!key) {
          return NextResponse.json({ error: "Cannot verify avatar ownership for deletion" }, { status: 400 });
        }
        const { error: delErr } = await admin.adminDb.storage.from("public-assets").remove([key]);
        if (delErr) {
          return NextResponse.json({ error: `Avatar storage deletion failed: ${delErr.message}` }, { status: 500 });
        }
        // clear profile avatar_url
        const { error: avatarDbErr } = await admin.adminDb.database
          .from("profiles")
          .update({ avatar_url: null, updated_at: new Date().toISOString() })
          .eq("id", vendor.user_id);
        if (avatarDbErr) {
          return NextResponse.json({ error: `Avatar database update failed: ${avatarDbErr.message}` }, { status: 500 });
        }
      }
    }

    if (disableCover && vendor.cover_url) {
      const key = extractStorageKey(vendor.cover_url, "covers", vendor.slug);
      if (!key) {
        return NextResponse.json({ error: "Cannot verify cover ownership for deletion" }, { status: 400 });
      }
      const { error: delErr } = await admin.adminDb.storage.from("public-assets").remove([key]);
      if (delErr) {
        return NextResponse.json({ error: `Cover storage deletion failed: ${delErr.message}` }, { status: 500 });
      }
      // clear cover_url after update object exists
    }

    // Start from preset defaults when plan changes, otherwise keep existing.
    const planChanged = requestedPlan !== vendor.membership_plan;
    const update: Record<string, any> = {
      membership_plan: requestedPlan,
      updated_at: new Date().toISOString(),
    };

    if (disableCover) update.cover_url = null;

    if (planChanged && PLAN_PRESETS[requestedPlan]) {
      Object.assign(update, PLAN_PRESETS[requestedPlan]);
    }

    // Explicit overrides.
    if (body.product_limit !== undefined) {
      const n = Number(body.product_limit);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: "product_limit must be a non-negative integer" }, { status: 400 });
      }
      update.product_limit = n;
    }
    if (body.product_priority !== undefined) {
      const n = Number(body.product_priority);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: "product_priority must be a non-negative integer" }, { status: 400 });
      }
      update.product_priority = n;
    }
    for (const key of ["whatsapp_enabled", "profile_picture_enabled", "cover_photo_enabled", "showcase_enabled", "downloadable_enabled"]) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== "boolean") {
          return NextResponse.json({ error: `${key} must be boolean` }, { status: 400 });
        }
        update[key] = body[key];
      }
    }

    const adminUserClient = getUserClient(admin.token);
    const { error: updErr } = await adminUserClient.database
      .from("vendors")
      .update(update)
      .eq("id", vendorId);

    if (updErr) throw updErr;

    return NextResponse.json({ success: true, message: "Membership updated successfully." });
  } catch (err: any) {
    console.error("Admin seller membership error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
