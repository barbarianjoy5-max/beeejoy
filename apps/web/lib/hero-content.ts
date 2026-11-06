// ==============================================================================
// BEEEJOY Hero Content Defaults, Limits & Normalization
// Stored in the existing site_settings key/value table (no migration needed).
// ==============================================================================

import { HeroContentConfig } from "./types";

export const HERO_CONTENT_KEY = "homepage_hero_content";

export const HERO_LIMITS = {
  heading: { max: 120 },
  description: { max: 600 },
  phrases: { min: 1, max: 8, length: 48 },
  typingSpeedMs: { min: 20, max: 200 },
  deletingSpeedMs: { min: 10, max: 150 },
  pauseMs: { min: 400, max: 6000 },
} as const;

/**
 * Current Hero copy, used as the fallback whenever the setting is missing,
 * unreachable or partially stored.
 */
export const DEFAULT_HERO_CONTENT: HeroContentConfig = {
  heading: "Fast, Reliable Software Downloads by",
  description:
    "Download verified free software directly with one click, or contact product sellers to purchase premium creator tools with manual bKash & Nagad support.",
  phrases: ["BEEEJOY", "Trusted Creators", "Verified Developers"],
  typewriter_enabled: true,
  cursor_enabled: true,
  typing_speed_ms: 65,
  deleting_speed_ms: 35,
  pause_ms: 1800,
  updated_at: null,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/**
 * Coerces a stored/partial payload into a complete, bounded config.
 * Every consumer (public API, admin API, homepage) shares this shape.
 */
export function normalizeHeroContent(value: unknown): HeroContentConfig {
  const raw = (value ?? {}) as Partial<HeroContentConfig>;

  const heading =
    typeof raw.heading === "string" && raw.heading.trim()
      ? raw.heading.trim().slice(0, HERO_LIMITS.heading.max)
      : DEFAULT_HERO_CONTENT.heading;

  const description =
    typeof raw.description === "string"
      ? raw.description.trim().slice(0, HERO_LIMITS.description.max)
      : DEFAULT_HERO_CONTENT.description;

  const phrases = Array.isArray(raw.phrases)
    ? raw.phrases
        .map((phrase) => String(phrase ?? "").trim().slice(0, HERO_LIMITS.phrases.length))
        .filter(Boolean)
        .slice(0, HERO_LIMITS.phrases.max)
    : [];

  return {
    heading,
    description,
    phrases: phrases.length ? phrases : [...DEFAULT_HERO_CONTENT.phrases],
    typewriter_enabled:
      typeof raw.typewriter_enabled === "boolean"
        ? raw.typewriter_enabled
        : DEFAULT_HERO_CONTENT.typewriter_enabled,
    cursor_enabled:
      typeof raw.cursor_enabled === "boolean"
        ? raw.cursor_enabled
        : DEFAULT_HERO_CONTENT.cursor_enabled,
    typing_speed_ms: clampNumber(
      raw.typing_speed_ms,
      HERO_LIMITS.typingSpeedMs.min,
      HERO_LIMITS.typingSpeedMs.max,
      DEFAULT_HERO_CONTENT.typing_speed_ms
    ),
    deleting_speed_ms: clampNumber(
      raw.deleting_speed_ms,
      HERO_LIMITS.deletingSpeedMs.min,
      HERO_LIMITS.deletingSpeedMs.max,
      DEFAULT_HERO_CONTENT.deleting_speed_ms
    ),
    pause_ms: clampNumber(
      raw.pause_ms,
      HERO_LIMITS.pauseMs.min,
      HERO_LIMITS.pauseMs.max,
      DEFAULT_HERO_CONTENT.pause_ms
    ),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}
