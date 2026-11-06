// ==============================================================================
// BEEEJOY Site Branding Helpers
// Shared constants and URL resolution for the site_branding setting.
// ==============================================================================

import { SiteBrandingConfig } from "./types";

export const SITE_BRANDING_KEY = "site_branding";
export const BRANDING_BUCKET = "public-assets";
export const BRANDING_ASSET_ROUTE = "/api/site/branding/asset";

export type BrandingTarget = "icon" | "wordmark";

export function isBrandingTarget(value: unknown): value is BrandingTarget {
  return value === "icon" || value === "wordmark";
}

/**
 * Cache-busting token for a stored asset. Uploads always create a new
 * uniquely named object (branding/<target>-<timestamp>.svg), so the token
 * changes every time the logo is replaced.
 */
function assetVersion(storagePath: string): string {
  const timestamp = storagePath.match(/(\d{6,})/);
  return timestamp ? timestamp[1] : encodeURIComponent(storagePath);
}

/**
 * Builds the same-origin URL that serves a stored SVG.
 *
 * InsForge storage returns every object as `application/octet-stream`, which
 * browsers refuse to decode inside <img>. The asset route re-serves the same
 * already-sanitized file with `image/svg+xml`, so the logo renders in the
 * header without re-uploading or redeploying anything.
 */
export function brandingAssetUrl(
  target: BrandingTarget,
  storagePath?: string | null
): string | null {
  if (!storagePath) return null;
  return `${BRANDING_ASSET_ROUTE}?target=${target}&v=${assetVersion(storagePath)}`;
}

/**
 * Maps the stored configuration to display URLs usable by <img> tags.
 * Storage paths stay untouched: they remain the canonical record used for
 * replacement and deletion.
 */
export function toDisplayBranding(
  config: SiteBrandingConfig
): SiteBrandingConfig {
  return {
    ...config,
    icon_url:
      brandingAssetUrl("icon", config.icon_storage_path) ||
      config.icon_url ||
      null,
    wordmark_url:
      brandingAssetUrl("wordmark", config.wordmark_storage_path) ||
      config.wordmark_url ||
      null,
  };
}
