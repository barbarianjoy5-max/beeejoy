// ==============================================================================
// BEEEJOY Server-Side InsForge SDK Helper
// Used strictly in server-side routes (API routes, Server Components).
// Uses INSFORGE_API_KEY for privileged operations (storage signed URLs).
// ==============================================================================

import { createClient } from "@insforge/sdk";

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_INSFORGE_URL is not configured.");
  }

  return createClient({
    baseUrl: url,
    anonKey: apiKey,
  });
}

export function getUserClient(token: string) {
  const url = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_INSFORGE_URL is not configured.");
  }

  const client = createClient({
    baseUrl: url,
    anonKey: anonKey,
  });

  client.setAccessToken(token);
  return client;
}
