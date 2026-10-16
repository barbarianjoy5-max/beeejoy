// ==============================================================================
// InsForge Edge Function: generate-download-url
// Runtime: Deno / TypeScript
// Purpose: Validates user authorization for software packages and generates
//          time-limited signed S3 URLs. Never exposes raw bucket keys.
// ==============================================================================

import { createClient } from "npm:@insforge/sdk@^0.1.0";

interface DownloadUrlRequest {
  product_slug: string;
  version_str?: string;
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

    const body: DownloadUrlRequest = await req.json();
    const { product_slug, version_str } = body;

    if (!product_slug) {
      return new Response(JSON.stringify({ error: "Missing product_slug" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Authenticate user via incoming JWT
    const insforge = createClient({
      baseUrl: Deno.env.get("INSFORGE_URL") || "",
      anonKey: Deno.env.get("INSFORGE_ANON_KEY") || "",
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await insforge.auth.getUser(token);

    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Service client for privileged queries
    const adminClient = createClient({
      baseUrl: Deno.env.get("INSFORGE_URL") || "",
      anonKey: Deno.env.get("INSFORGE_ANON_KEY") || "",
      serviceRoleKey: Deno.env.get("INSFORGE_SERVICE_ROLE_KEY"),
    });

    // 1. Verify user entitlement via active license or completed order
    const { data: entitlement } = await adminClient
      .from("licenses")
      .select(`
        id,
        status,
        products!inner (
          id,
          slug,
          title
        )
      `)
      .eq("customer_id", userId)
      .eq("products.slug", product_slug)
      .eq("status", "active")
      .maybeSingle();

    if (!entitlement) {
      return new Response(
        JSON.stringify({ error: "You do not hold an active license for this software product" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch target software release
    let releaseQuery = adminClient
      .from("software_releases")
      .select("id, version_str, storage_path, file_checksum_sha256")
      .eq("product_id", entitlement.products.id)
      .eq("is_active", true);

    if (version_str) {
      releaseQuery = releaseQuery.eq("version_str", version_str);
    } else {
      releaseQuery = releaseQuery.order("created_at", { ascending: false }).limit(1);
    }

    const { data: releases, error: releaseError } = await releaseQuery;

    if (releaseError || !releases || releases.length === 0) {
      return new Response(JSON.stringify({ error: "No active release found for this product" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const targetRelease = releases[0];

    // 3. Generate a signed URL valid for 15 minutes (900 seconds)
    const { data: signedData, error: signedError } = await adminClient.storage
      .from("software-packages")
      .createSignedUrl(targetRelease.storage_path, 900);

    if (signedError || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: "Could not generate download link" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        product: product_slug,
        version: targetRelease.version_str,
        download_url: signedData.signedUrl,
        checksum_sha256: targetRelease.file_checksum_sha256,
        expires_in_seconds: 900,
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
