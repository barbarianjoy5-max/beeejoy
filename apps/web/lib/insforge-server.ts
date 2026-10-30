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

  // Pass accessToken directly in config so the SDK sets isServerMode correctly
  // and auth.getCurrentUser() can validate the token on the server.
  return createClient({
    baseUrl: url,
    anonKey: anonKey,
    accessToken: token,
    isServerMode: true,
  });
}

export const SINGLE_ADMIN_UUID = "e2f6c2a3-a0e4-46bf-a13f-5b6d088f839d";

export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  let token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Reject obviously invalid tokens (e.g. "undefined" / "null" stringified)
  if (!token || token === "undefined" || token === "null") {
    // Fallback: check cookie header (same-origin requests include credentials)
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/insforge_access_token=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (!token || token === "undefined" || token === "null") return null;

  try {
    const userClient = getUserClient(token);
    const { data, error } = await userClient.auth.getCurrentUser();
    if (error || !data?.user) return null;
    return { user: data.user, token };
  } catch {
    return null;
  }
}

export async function getAuthenticatedAdmin(req: Request) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return null;

  if (auth.user.id !== SINGLE_ADMIN_UUID) {
    return null;
  }

  const adminDb = getAdminClient();
  const { data: profile, error } = await adminDb.database
    .from("profiles")
    .select("role")
    .eq("id", SINGLE_ADMIN_UUID)
    .maybeSingle();

  if (error || profile?.role !== "admin") {
    return null;
  }

  return { user: auth.user, token: auth.token, adminDb };
}

export async function getAuthenticatedSeller(req: Request) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return null;

  const adminDb = getAdminClient();

  // Query vendor record owned by this user
  const { data: vendor, error } = await adminDb.database
    .from("vendors")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error || !vendor || vendor.status !== "active") {
    return null;
  }

  return { user: auth.user, vendor, token: auth.token, adminDb };
}
