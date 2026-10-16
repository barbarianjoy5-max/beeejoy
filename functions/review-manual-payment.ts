// ==============================================================================
// InsForge Edge Function: review-manual-payment
// Runtime: Deno / TypeScript
// Purpose: Admin endpoint to approve or reject manual payments (bKash/Nagad/Bank).
//          Issues cryptographically hashed licenses ONLY upon verified payment.
// ==============================================================================

import { createClient } from "npm:@insforge/sdk@^0.1.0";

interface ReviewPaymentRequest {
  submission_id: string;
  decision: "verified" | "rejected";
  admin_notes?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: ReviewPaymentRequest = await req.json();
    const { submission_id, decision, admin_notes } = body;

    if (!submission_id || !["verified", "rejected"].includes(decision)) {
      return new Response(JSON.stringify({ error: "Invalid submission_id or decision" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Authenticate user via JWT
    const insforge = createClient({
      baseUrl: Deno.env.get("INSFORGE_URL") || "",
      anonKey: Deno.env.get("INSFORGE_ANON_KEY") || "",
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await insforge.auth.getUser(token);

    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const adminId = userData.user.id;

    // Service client for privileged queries
    const adminClient = createClient({
      baseUrl: Deno.env.get("INSFORGE_URL") || "",
      anonKey: Deno.env.get("INSFORGE_ANON_KEY") || "",
      serviceRoleKey: Deno.env.get("INSFORGE_SERVICE_ROLE_KEY"),
    });

    // Verify requesting user is an Admin
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", adminId)
      .single();

    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin privileges required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch the submission and associated order
    const { data: submission, error: subError } = await adminClient
      .from("manual_payment_submissions")
      .select(`
        id,
        order_id,
        status,
        orders!inner (
          id,
          customer_id,
          status,
          total_amount_cents,
          order_items (
            id,
            product_id,
            release_id
          )
        )
      `)
      .eq("id", submission_id)
      .single();

    if (subError || !submission) {
      return new Response(JSON.stringify({ error: "Payment submission not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    if (decision === "rejected") {
      // Mark submission rejected, order cancelled
      await adminClient
        .from("manual_payment_submissions")
        .update({
          status: "rejected",
          reviewed_by: adminId,
          reviewed_at: now,
          admin_notes: admin_notes || "Payment verification rejected",
        })
        .eq("id", submission_id);

      await adminClient
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", submission.order_id);

      return new Response(
        JSON.stringify({ success: true, status: "rejected", order_id: submission.order_id }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // DECISION IS "verified":
    // 1. Update submission
    await adminClient
      .from("manual_payment_submissions")
      .update({
        status: "verified",
        reviewed_by: adminId,
        reviewed_at: now,
        admin_notes: admin_notes || "Payment manually verified and approved",
      })
      .eq("id", submission_id);

    // 2. Mark order completed
    await adminClient
      .from("orders")
      .update({ status: "completed" })
      .eq("id", submission.order_id);

    // 3. Issue licenses for all items in the order
    const items = submission.orders.order_items || [];
    const generatedLicenses = [];

    for (const item of items) {
      // Generate secure 32-character license key formatted as BEEE-XXXX-XXXX-XXXX
      const randomBytes = new Uint8Array(12);
      crypto.getRandomValues(randomBytes);
      const hexKey = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      const rawLicenseKey = `BEEE-${hexKey.slice(0, 4)}-${hexKey.slice(4, 8)}-${hexKey.slice(8, 12)}-${hexKey.slice(12, 16)}`;

      // Compute SHA-256 hash for secure database storage
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawLicenseKey));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const licenseKeyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const prefix = rawLicenseKey.slice(0, 9); // e.g. "BEEE-XXXX"

      const { data: newLicense } = await adminClient
        .from("licenses")
        .insert({
          order_id: submission.order_id,
          customer_id: submission.orders.customer_id,
          product_id: item.product_id,
          license_key_hash: licenseKeyHash,
          key_prefix: prefix,
          status: "active",
          max_activations: 2, // Standard default: 2 machines
          current_activations: 0,
          grace_period_days: 7,
        })
        .select()
        .single();

      generatedLicenses.push({
        product_id: item.product_id,
        raw_key: rawLicenseKey, // returned once in admin response / email notification
        prefix,
        license_id: newLicense?.id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "verified",
        order_id: submission.order_id,
        licenses_issued: generatedLicenses.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
