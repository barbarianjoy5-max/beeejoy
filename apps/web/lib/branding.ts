// ==============================================================================
// BEEEJOY Site Branding Helpers
// Shared constants and URL resolution for the site_branding setting.
// ==============================================================================

import { SiteBrandingConfig, SiteThemeColors, SiteThemeFonts } from "./types";

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
    colors: normalizeThemeColors(raw.colors),
    fonts: normalizeThemeFonts(raw.fonts),
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
  colors?: SiteThemeColors | null;
  fonts?: SiteThemeFonts | null;
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
      colors: data.colors ? normalizeThemeColors(data.colors) : undefined,
      fonts: data.fonts ? normalizeThemeFonts(data.fonts) : undefined,
      ...normalizeBrandingSizes(data),
    };
  } catch (err) {
    console.warn("Public branding fetch warning:", err);
    return null;
  }
}


// ==============================================================================
// Theme Colors & Fonts
// ==============================================================================

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHex(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v);
}

export const THEME_COLOR_KEYS = [
  "primary",
  "secondary",
  "accent",
  "page_bg",
  "surface_bg",
  "text_primary",
  "text_muted",
  "button_bg",
  "button_text",
  "border",
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

export const THEME_COLOR_LABELS: Record<ThemeColorKey, string> = {
  primary: "Primary Color",
  secondary: "Secondary Color",
  accent: "Accent Color",
  page_bg: "Page Background",
  surface_bg: "Surface / Card Background",
  text_primary: "Primary Text",
  text_muted: "Muted Text",
  button_bg: "Button Background",
  button_text: "Button Text",
  border: "Border Color",
};

export const DEFAULT_THEME_COLORS: SiteThemeColors = {
  primary: "#fbbf24",   // amber-400
  secondary: "#f59e0b", // amber-500
  accent: "#d97706",    // amber-600
  page_bg: "#09090b",   // zinc-950
  surface_bg: "#18181b", // zinc-900
  text_primary: "#f4f4f5", // zinc-100
  text_muted: "#71717a",   // zinc-500
  button_bg: "#f59e0b",    // amber-500
  button_text: "#09090b",  // zinc-950
  border: "#27272a",       // zinc-800
};

export const FONT_PRESETS = [
  { value: "system-ui, -apple-system, sans-serif", label: "System Default" },
  { value: "'Inter', sans-serif", label: "Inter", google: "Inter" },
  { value: "'Poppins', sans-serif", label: "Poppins", google: "Poppins" },
  { value: "'Roboto', sans-serif", label: "Roboto", google: "Roboto" },
  { value: "'Open Sans', sans-serif", label: "Open Sans", google: "Open+Sans" },
  { value: "'Montserrat', sans-serif", label: "Montserrat", google: "Montserrat" },
  { value: "'Lato', sans-serif", label: "Lato", google: "Lato" },
  { value: "'Nunito', sans-serif", label: "Nunito", google: "Nunito" },
  { value: "'Raleway', sans-serif", label: "Raleway", google: "Raleway" },
  { value: "'Source Sans 3', sans-serif", label: "Source Sans 3", google: "Source+Sans+3" },
  { value: "'DM Sans', sans-serif", label: "DM Sans", google: "DM+Sans" },
  { value: "'Space Grotesk', sans-serif", label: "Space Grotesk", google: "Space+Grotesk" },
  { value: "'Outfit', sans-serif", label: "Outfit", google: "Outfit" },
  { value: "'Plus Jakarta Sans', sans-serif", label: "Plus Jakarta Sans", google: "Plus+Jakarta+Sans" },
  { value: "'JetBrains Mono', monospace", label: "JetBrains Mono", google: "JetBrains+Mono" },
] as const;

export const DEFAULT_THEME_FONTS: SiteThemeFonts = {
  heading: "system-ui, -apple-system, sans-serif",
  body: "system-ui, -apple-system, sans-serif",
  button: "system-ui, -apple-system, sans-serif",
};

export const THEME_FONT_KEYS = ["heading", "body", "button"] as const;
export type ThemeFontKey = (typeof THEME_FONT_KEYS)[number];

export const THEME_FONT_LABELS: Record<ThemeFontKey, string> = {
  heading: "Heading Font",
  body: "Body Font",
  button: "Button Font",
};

/**
 * Validates and normalizes stored colors. Invalid hex values are stripped.
 */
export function normalizeThemeColors(raw: unknown): SiteThemeColors {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const result: SiteThemeColors = {};
  for (const key of THEME_COLOR_KEYS) {
    if (isValidHex(obj[key])) {
      (result as any)[key] = obj[key];
    }
  }
  return result;
}

/**
 * Validates stored font selections. Only values in the preset list are accepted.
 */
export function normalizeThemeFonts(raw: unknown): SiteThemeFonts {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const validValues = new Set<string>(FONT_PRESETS.map((p) => p.value));
  const result: SiteThemeFonts = {};
  for (const key of THEME_FONT_KEYS) {
    if (typeof obj[key] === "string" && validValues.has(obj[key] as string)) {
      (result as any)[key] = obj[key];
    }
  }
  return result;
}

/**
 * Builds the CSS variable assignments for injection into <html> style.
 * Only set variables for explicitly configured values (not defaults)
 * so the shipped Tailwind/CSS classes work unchanged when no customization exists.
 */
export function buildThemeCssVars(
  colors?: SiteThemeColors | null,
  fonts?: SiteThemeFonts | null
): Record<string, string> {
  const vars: Record<string, string> = {};
  if (colors) {
    const map: Record<ThemeColorKey, string> = {
      primary: "--bj-primary",
      secondary: "--bj-secondary",
      accent: "--bj-accent",
      page_bg: "--bj-page-bg",
      surface_bg: "--bj-surface-bg",
      text_primary: "--bj-text-primary",
      text_muted: "--bj-text-muted",
      button_bg: "--bj-button-bg",
      button_text: "--bj-button-text",
      border: "--bj-border",
    };
    for (const key of THEME_COLOR_KEYS) {
      if (isValidHex(colors[key])) {
        vars[map[key]] = colors[key]!;
      }
    }
  }
  if (fonts) {
    if (fonts.heading) vars["--bj-font-heading"] = fonts.heading;
    if (fonts.body) vars["--bj-font-body"] = fonts.body;
    if (fonts.button) vars["--bj-font-button"] = fonts.button;
  }
  return vars;
}

/**
 * Returns the set of Google Font family names that need to be loaded.
 */
export function getGoogleFontFamilies(fonts?: SiteThemeFonts | null): string[] {
  if (!fonts) return [];
  const families = new Set<string>();
  for (const key of THEME_FONT_KEYS) {
    const val = fonts[key];
    if (!val) continue;
    const preset = FONT_PRESETS.find((p) => p.value === val);
    if (preset && "google" in preset && preset.google) {
      families.add(preset.google);
    }
  }
  return Array.from(families);
}

/**
 * Builds a Google Fonts stylesheet URL for the given families.
 */
export function buildGoogleFontsUrl(families: string[]): string | null {
  if (families.length === 0) return null;
  const params = families.map((f) => `family=${f}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}


export function hexToRgbChannels(hex: string): string | null {
  if (!isValidHex(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

/**
 * Builds the complete CSS variable declaration string for injection into <head>.
 * Maps both hex variables and rgb channels for Tailwind opacity modifiers.
 */
export function generateThemeCss(
  colors?: SiteThemeColors | null,
  fonts?: SiteThemeFonts | null
): string {
  const lines: string[] = [];

  if (colors) {
    if (colors.primary && isValidHex(colors.primary)) {
      const rgb = hexToRgbChannels(colors.primary);
      lines.push(`--bj-primary: ${colors.primary};`);
      if (rgb) lines.push(`--amber-400: ${rgb};`);
    }
    if (colors.secondary && isValidHex(colors.secondary)) {
      const rgb = hexToRgbChannels(colors.secondary);
      lines.push(`--bj-secondary: ${colors.secondary};`);
      if (rgb) lines.push(`--amber-500: ${rgb};`);
    }
    if (colors.accent && isValidHex(colors.accent)) {
      const rgb = hexToRgbChannels(colors.accent);
      lines.push(`--bj-accent: ${colors.accent};`);
      if (rgb) lines.push(`--amber-600: ${rgb};`);
    }
    if (colors.page_bg && isValidHex(colors.page_bg)) {
      const rgb = hexToRgbChannels(colors.page_bg);
      lines.push(`--bj-page-bg: ${colors.page_bg};`);
      lines.push(`--background: ${colors.page_bg};`);
      if (rgb) lines.push(`--zinc-950: ${rgb};`);
    }
    if (colors.surface_bg && isValidHex(colors.surface_bg)) {
      const rgb = hexToRgbChannels(colors.surface_bg);
      lines.push(`--bj-surface-bg: ${colors.surface_bg};`);
      if (rgb) lines.push(`--zinc-900: ${rgb};`);
    }
    if (colors.border && isValidHex(colors.border)) {
      const rgb = hexToRgbChannels(colors.border);
      lines.push(`--bj-border: ${colors.border};`);
      if (rgb) lines.push(`--zinc-800: ${rgb};`);
    }
    if (colors.text_primary && isValidHex(colors.text_primary)) {
      const rgb = hexToRgbChannels(colors.text_primary);
      lines.push(`--bj-text-primary: ${colors.text_primary};`);
      lines.push(`--foreground: ${colors.text_primary};`);
      if (rgb) lines.push(`--zinc-100: ${rgb};`);
    }
    if (colors.text_muted && isValidHex(colors.text_muted)) {
      const rgb = hexToRgbChannels(colors.text_muted);
      lines.push(`--bj-text-muted: ${colors.text_muted};`);
      if (rgb) {
        lines.push(`--zinc-400: ${rgb};`);
        lines.push(`--zinc-500: ${rgb};`);
      }
    }
    if (colors.button_bg && isValidHex(colors.button_bg)) {
      const rgb = hexToRgbChannels(colors.button_bg);
      lines.push(`--bj-button-bg: ${colors.button_bg};`);
      if (rgb) lines.push(`--amber-500: ${rgb};`);
    }
    if (colors.button_text && isValidHex(colors.button_text)) {
      lines.push(`--bj-button-text: ${colors.button_text};`);
    }
  }

  if (fonts) {
    if (fonts.heading) lines.push(`--bj-font-heading: ${fonts.heading};`);
    if (fonts.body) lines.push(`--bj-font-body: ${fonts.body};`);
    if (fonts.button) lines.push(`--bj-font-button: ${fonts.button};`);
  }

  if (lines.length === 0) return "";
  return `:root {\n  ${lines.join("\n  ")}\n}`;
}
