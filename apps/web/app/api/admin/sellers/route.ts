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
      .select("id, email, full_name, role");

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
