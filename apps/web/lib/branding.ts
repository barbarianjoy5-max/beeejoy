// ==============================================================================
// BEEEJOY Site Branding Helpers
// Shared constants and URL resolution for the site_branding setting.
// ==============================================================================

import { SiteBrandingConfig } from "./types";

export const SITE_BRANDING_KEY = "site_branding";
export const BRANDING_BUCKET = "public-assets";
export const BRANDING_ASSET_ROUTE = "/api/site/branding/asset";

export type BrandingTarget = "icon" | "wordmark";
export type BrandingTheme = "dark" | "light";

export function isBrandingTarget(value: unknown): value is BrandingTarget {
  return value === "icon" || value === "wordmark";
}

export function isBrandingTheme(value: unknown): value is BrandingTheme {
  return value === "dark" || value === "light";
}

// ----------------------------------------------------------------------------
// Global display sizes
//
// Three slider-driven values that live inside the existing `site_branding`
// JSONB setting, so no extra table or key is needed. They change only how the
// already-uploaded assets are rendered; the stored SVG and avatar files are
// never resized, re-encoded or replaced.
// ----------------------------------------------------------------------------

export const BRANDING_SIZE_KEYS = [
  "icon_size_px",
  "wordmark_size_px",
  "seller_avatar_size_px",
] as const;

export type BrandingSizeKey = (typeof BRANDING_SIZE_KEYS)[number];

export type BrandingSizes = Record<BrandingSizeKey, number>;

/** Reproduces the header/profile geometry that shipped before these controls. */
export const DEFAULT_BRANDING_SIZES: BrandingSizes = {
  icon_size_px: 40,
  wordmark_size_px: 24,
  seller_avatar_size_px: 112,
};

export const BRANDING_SIZE_LIMITS: Record<
  BrandingSizeKey,
  { min: number; max: number; label: string }
> = {
  icon_size_px: { min: 24, max: 72, label: "Square Icon Logo" },
  wordmark_size_px: { min: 14, max: 48, label: "Site Name / Wordmark" },
  seller_avatar_size_px: { min: 64, max: 176, label: "Seller Profile Picture" },
};

/**
 * Wordmark width guard rail: the shipped header caps the SVG at 160px while it
 * is 24px tall. Scaling that ratio keeps very wide wordmarks inside the header
 * at every size without distorting them.
 */
export const WORDMARK_MAX_WIDTH_RATIO = 160 / 24;

/**
 * The built-in 'BEEEJOY' fallback is text, not an image, so its font-size is
 * derived from the same stored height. 20/24 keeps the default pixel-perfectly
 * identical to the previous `text-xl` sizing.
 */
export const WORDMARK_TEXT_HEIGHT_RATIO = 20 / 24;

export function isBrandingSizeKey(value: string): value is BrandingSizeKey {
  return (BRANDING_SIZE_KEYS as readonly string[]).includes(value);
}

/**
 * Clamps one value into its documented range. Anything unparseable falls back
 * to the shipped default so a corrupted setting can never break the header.
 */
export function clampBrandingSize(
  key: BrandingSizeKey,
  value: unknown,
  fallback: number = DEFAULT_BRANDING_SIZES[key]
): number {
  const { min, max } = BRANDING_SIZE_LIMITS[key];
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/** Reads every stored size out of a partial/raw setting value. */
export function normalizeBrandingSizes(value: unknown): BrandingSizes {
  const raw = (value ?? {}) as Partial<BrandingSizes>;
  return {
    icon_size_px: clampBrandingSize("icon_size_px", raw.icon_size_px),
    wordmark_size_px: clampBrandingSize("wordmark_size_px", raw.wordmark_size_px),
    seller_avatar_size_px: clampBrandingSize(
      "seller_avatar_size_px",
      raw.seller_avatar_size_px
    ),
  };
}

/**
 * Coerces a stored/partial `site_branding` value into one complete shape. Only
 * the display sizes are defaulted; asset URLs and storage paths are passed
 * through untouched so replacements keep working.
 */
export function normalizeSiteBranding(value: unknown): SiteBrandingConfig {
  const raw = (value ?? {}) as SiteBrandingConfig;
  return {
    ...raw,
    icon_url: typeof raw.icon_url === "string" ? raw.icon_url : null,
    wordmark_url: typeof raw.wordmark_url === "string" ? raw.wordmark_url : null,
    icon_light_url:
      typeof raw.icon_light_url === "string" ? raw.icon_light_url : null,
    icon_light_storage_path:
      typeof raw.icon_light_storage_path === "string"
        ? raw.icon_light_storage_path
        : null,
    wordmark_light_url:
      typeof raw.wordmark_light_url === "string" ? raw.wordmark_light_url : null,
    wordmark_light_storage_path:
      typeof raw.wordmark_light_storage_path === "string"
        ? raw.wordmark_light_storage_path
        : null,
    ...normalizeBrandingSizes(raw),
  };
}

/**
 * Keeps a chosen size usable on narrow screens: past a viewport-relative
 * budget the browser shrinks the asset instead of pushing the header or the
 * seller profile out of alignment. Never clamps the shipped defaults.
 */
export function iconSizeCss(px: number): string {
  return `min(${px}px, 12vw + 20px)`;
}

export function wordmarkSizeCss(px: number): string {
  return `min(${px}px, 7vw + 12px)`;
}

export function avatarSizeCss(px: number): string {
  return `min(${px}px, 55vw)`;
}

export function wordmarkMaxWidthCss(px: number): string {
  return `${Math.round(px * WORDMARK_MAX_WIDTH_RATIO)}px`;
}

export function wordmarkTextSizeCss(px: number): string {
  return `calc(${wordmarkSizeCss(px)} * ${WORDMARK_TEXT_HEIGHT_RATIO.toFixed(4)})`;
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
  storagePath?: string | null,
  theme: BrandingTheme = "dark"
): string | null {
  if (!storagePath) return null;
  const themeParam = theme === "light" ? "&theme=light" : "";
  return `${BRANDING_ASSET_ROUTE}?target=${target}&v=${assetVersion(storagePath)}${themeParam}`;
}

/**
 * Maps the stored configuration to display URLs usable by <img> tags.
 * Storage paths stay untouched: they remain the canonical record used for
 * replacement and deletion. Sizes are normalized so every consumer reads the
 * same bounded numbers.
 */
export function toDisplayBranding(
  config: SiteBrandingConfig
): SiteBrandingConfig {
  const normalized = normalizeSiteBranding(config);
  return {
    ...normalized,
    icon_url:
      brandingAssetUrl("icon", normalized.icon_storage_path) ||
      normalized.icon_url ||
      null,
    wordmark_url:
      brandingAssetUrl("wordmark", normalized.wordmark_storage_path) ||
      normalized.wordmark_url ||
      null,
    // Light-theme assets resolve through the same route with theme=light.
    // They stay null when no light upload exists so consumers can fall back
    // to the dark asset (or the built-in default).
    icon_light_url: brandingAssetUrl(
      "icon",
      normalized.icon_light_storage_path,
      "light"
    ),
    wordmark_light_url: brandingAssetUrl(
      "wordmark",
      normalized.wordmark_light_storage_path,
      "light"
    ),
  };
}

// ----------------------------------------------------------------------------
// Public read helper (client components)
// ----------------------------------------------------------------------------

export interface PublicSiteBranding extends BrandingSizes {
  icon_url: string | null;
  wordmark_url: string | null;
  icon_light_url: string | null;
  wordmark_light_url: string | null;
}

/**
 * Reads the published branding for any public page. Returns null when the
 * endpoint is unreachable so callers fall back to the shipped defaults instead
 * of rendering a zero-sized logo.
 */
export async function fetchPublicSiteBranding(): Promise<PublicSiteBranding | null> {
  try {
    const res = await fetch("/api/site/branding");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object") return null;
    return {
      icon_url: typeof data.icon_url === "string" ? data.icon_url : null,
      wordmark_url: typeof data.wordmark_url === "string" ? data.wordmark_url : null,
      icon_light_url:
        typeof data.icon_light_url === "string" ? data.icon_light_url : null,
      wordmark_light_url:
        typeof data.wordmark_light_url === "string" ? data.wordmark_light_url : null,
      ...normalizeBrandingSizes(data),
    };
  } catch (err) {
    console.warn("Public branding fetch warning:", err);
    return null;
  }
}
