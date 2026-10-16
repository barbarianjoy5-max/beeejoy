// ==============================================================================
// InsForge Edge Function: activate-license
// Runtime: Deno / TypeScript
// Purpose: Validates and activates CEP extension licenses (BEJOY SYSTEM ACTIVE,
//          BEJOY BROWSER) with machine fingerprinting and grace period handling.
// ==============================================================================

import { createClient } from "npm:@insforge/sdk@^0.1.0";

interface ActivateRequest {
  license_key: string;
  product_slug: string;
  machine_fingerprint: string;
  device_name?: string;
  os_info?: string;
  host_app_version?: string; // e.g. "Illustrator 28.0"
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body: ActivateRequest = await req.json();
    const { license_key, product_slug, machine_fingerprint, device_name, os_info, host_app_version } = body;

    if (!license_key || !product_slug || !machine_fingerprint) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: license_key, product_slug, machine_fingerprint" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize InsForge client using service environment
    const insforge = createClient({
      baseUrl: Deno.env.get("INSFORGE_URL") || "",
      anonKey: Deno.env.get("INSFORGE_ANON_KEY") || "",
      serviceRoleKey: Deno.env.get("INSFORGE_SERVICE_ROLE_KEY"),
    });

    // 1. Hash the incoming license key using SHA-256 for secure comparison
    const encoder = new TextEncoder();
    const keyData = encoder.encode(license_key.trim());
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const licenseKeyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // 2. Fetch the license record and verify product association
    const { data: license, error: licenseError } = await insforge
      .from("licenses")
      .select(`
        id,
        status,
        max_activations,
        current_activations,
        grace_period_days,
        expires_at,
        products!inner (
          id,
          slug,
          title
        )
      `)
      .eq("license_key_hash", licenseKeyHash)
      .eq("products.slug", product_slug)
      .single();

    if (licenseError || !license) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Invalid license key or product mismatch" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Verify license status and expiry
    if (license.status !== "active") {
      return new Response(
        JSON.stringify({ valid: false, reason: `License is ${license.status}` }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, reason: "License has expired" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Check existing machine activations
    const { data: existingActivation } = await insforge
      .from("license_activations")
      .select("id")
      .eq("license_id", license.id)
      .eq("machine_fingerprint", machine_fingerprint)
      .maybeSingle();

    if (!existingActivation) {
      // Machine is not yet registered: check if activation limit reached
      if (license.current_activations >= license.max_activations) {
        return new Response(
          JSON.stringify({
            valid: false,
            reason: `Activation limit reached (${license.current_activations}/${license.max_activations} machines in use)`,
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      // Register new activation
      await insforge.from("license_activations").insert({
        license_id: license.id,
        machine_fingerprint,
        device_name: device_name || "Unknown device",
        os_info: os_info || "Unknown OS",
        host_app_version: host_app_version || "Illustrator",
        last_ping_at: new Date().toISOString(),
      });

      // Increment activation count
      await insforge
        .from("licenses")
        .update({ current_activations: license.current_activations + 1 })
        .eq("id", license.id);
    } else {
      // Update heartbeat ping on existing machine
      await insforge
        .from("license_activations")
        .update({ last_ping_at: new Date().toISOString() })
        .eq("id", existingActivation.id);
    }

    // 5. Calculate validation payload and offline grace period
    const gracePeriodHours = (license.grace_period_days || 7) * 24;
    const expiresOfflineAt = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000).toISOString();

    return new Response(
      JSON.stringify({
        valid: true,
        product: product_slug,
        status: "active",
        max_activations: license.max_activations,
        grace_period_days: license.grace_period_days,
        offline_grace_until: expiresOfflineAt,
        server_time: new Date().toISOString(),
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
