// ==============================================================================
// BEEEJOY Client InsForge SDK Initialization
// Public anonymous access only. Never expose service role or admin secrets here.
// ==============================================================================

import { createClient } from "@insforge/sdk";

const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

if (!insforgeUrl || !insforgeAnonKey) {
  // During build time or before env is loaded
  console.warn("InsForge public credentials are not set in environment.");
}

export const insforge = createClient({
  baseUrl: insforgeUrl || "https://placeholder.insforge.app",
  anonKey: insforgeAnonKey || "placeholder-anon-key",
});
