import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin, getUserClient } from "@/lib/insforge-server";

export const dynamic = "force-dynamic";

// ==============================================================================
// /api/admin/membership-payments
// GET  -> list membership payments (newest first) with vendor store names.
// POST -> { paymentId, decision: "approved" | "rejected", notes? }
//         Calls the admin-only SECURITY DEFINER RPCs. Preset logic lives
//         exclusively in the database functions — never duplicated here.
// ==============================================================================

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { data: payments, error } = await admin.adminDb.database
      .from("membership_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Attach vendor store names for display.
    const vendorIds = Array.from(new Set((payments || []).map((p: any) => p.vendor_id)));
    const vendorMap: Record<string, string> = {};
    if (vendorIds.length > 0) {
      const { data: vendors } = await admin.adminDb.database
        .from("vendors")
        .select("id, store_name, slug")
        .in("id", vendorIds);
      for (const v of vendors || []) {
        vendorMap[(v as any).id] = (v as any).store_name;
      }
    }

    return NextResponse.json({
      payments: (payments || []).map((p: any) => ({
        ...p,
        vendor_store_name: vendorMap[p.vendor_id] || null,
      })),
    });
  } catch (err: any) {
    console.error("Admin membership payments GET error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
    const decision = body?.decision;
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 1000) : null;

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId is required." }, { status: 400 });
    }
    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json({ error: "decision must be 'approved' or 'rejected'." }, { status: 400 });
    }

    // RPC runs under the admin's own JWT so auth.uid()/is_admin() resolve
    // correctly inside the SECURITY DEFINER function.
    const userClient = getUserClient(admin.token);
    const rpcName = decision === "approved" ? "approve_membership_payment" : "reject_membership_payment";
    const { data, error } = await userClient.database.rpc(rpcName, {
      p_payment_id: paymentId,
      p_admin_notes: notes,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Review failed." }, { status: 400 });
    }

    return NextResponse.json({ success: true, result: data });
  } catch (err: any) {
    console.error("Admin membership payments POST error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
