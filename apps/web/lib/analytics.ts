// ==============================================================================
// BEEEJOY Website Analytics — shared, runtime-agnostic helpers
// Imported by the browser tracker, the public ingest route and the admin report
// route, so path/referrer/date rules live in exactly one place.
// No Node-only APIs here: it must load in both the browser and the server.
// ==============================================================================

/** Opaque, random, per-browser id. Never derived from or linked to an account. */
export const VISITOR_ID_STORAGE_KEY = "beeejoy_visitor_id";

/** Format enforced by the database CHECK constraints. */
export const VISITOR_ID_PATTERN = /^[0-9a-f]{32}$/;

export const TRACK_ENDPOINT = "/api/analytics/track";

/** Product detail pages: /products/<slug> */
const PRODUCT_PATH_RE = /^\/products\/([a-z0-9][a-z0-9-]{0,199})$/;

/**
 * Areas that must never be measured or stored:
 * privileged surfaces, machine endpoints and member-only pages.
 */
const NON_TRACKABLE_PREFIXES = ["/admin", "/api", "/account", "/seller/dashboard", "/_next"];

export type AnalyticsRangePreset = "today" | "7d" | "30d" | "custom";

/** The date filter offered in the Admin Dashboard. */
export const ANALYTICS_RANGE_PRESETS: { value: AnalyticsRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
];

/** True when the path is a public page we are allowed to record. */
export function isTrackablePath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (NON_TRACKABLE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return false;
  }
  // Skip asset-like requests (e.g. /robots.txt, /logo.svg)
  const lastSegment = path.split("/").filter(Boolean).pop() || "";
  if (/\.[a-z0-9]{1,8}$/i.test(lastSegment)) return false;
  return true;
}

/** Product slug when the path is a product detail page, otherwise null. */
export function parseProductSlug(path: string): string | null {
  const match = PRODUCT_PATH_RE.exec(path);
  return match ? match[1] : null;
}

/**
 * Normalise a pathname into the value we persist: same-origin-stripped, no query
 * string, no hash, no control characters, lower-cased, max 200 chars.
 * Returns null when the input is not a safe public page path.
 */
export function normalizePagePath(rawPath: string | null | undefined): string | null {
  if (!rawPath || typeof rawPath !== "string") return null;

  let path = rawPath.trim();

  // Accept both "/products/x" and "https://host/products/x"
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch {
      return null;
    }
  }

  path = path.split("?")[0].split("#")[0].toLowerCase();
  if (!path.startsWith("/")) return null;

  // Collapse duplicate slashes, drop a trailing slash (except the site root)
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";

  if (path.length > 200) return null;
  if (/[^\x21-\x7e]/.test(path)) return null;
  if (path.includes("..")) return null;
  if (!isTrackablePath(path)) return null;

  return path;
}

/**
 * Reduce a referrer to its hostname only (the path is never kept) and drop
 * same-site self-referrals so that "(direct)" stays meaningful.
 */
export function extractReferrerDomain(
  referrer: string | null | undefined,
  ownHosts: string[] = []
): string | null {
  if (!referrer || typeof referrer !== "string") return null;

  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (!host || host.length > 253) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;

  const normalisedOwn = ownHosts
    .map((h) => h.toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);

  const bare = host.replace(/^www\./, "");
  if (normalisedOwn.includes(bare) || normalisedOwn.some((root) => bare.endsWith(`.${root}`))) {
    return null;
  }

  return host;
}

/** Random 128-bit hex id. Falls back to Math.random where CSPRNG is missing. */
export function createVisitorId(): string {
  const bytes = new Uint8Array(16);
  const webCrypto = typeof crypto !== "undefined" ? crypto : undefined;

  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Read the persisted visitor id, creating and storing one on first call. */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing && VISITOR_ID_PATTERN.test(existing)) return existing;

    const fresh = createVisitorId();
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Private mode / storage disabled: keep a stable in-memory id for the tab
    const memory = (window as unknown as { __beeejoyVisitorId?: string }).__beeejoyVisitorId;
    if (memory) return memory;
    const fresh = createVisitorId();
    (window as unknown as { __beeejoyVisitorId?: string }).__beeejoyVisitorId = fresh;
    return fresh;
  }
}

/**
 * Reporting timezone: Asia/Dhaka (UTC+6 year-round, no DST observed since 2009).
 * Timestamps are stored in UTC; the reporting day is the UTC instant shifted by
 * six hours, which is byte-for-byte the rule the database applies to derive its
 * view_date bucket, so the filter a browser sends can never land on a different
 * day than the rows it selects.
 */
export const REPORTING_TZ_LABEL = "Asia/Dhaka";
const REPORTING_TZ_OFFSET_MS = 6 * 60 * 60 * 1000;

/** yyyy-mm-dd in the Asia/Dhaka reporting day that contains `value`. */
export function toReportingDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + REPORTING_TZ_OFFSET_MS).toISOString().slice(0, 10);
}

export function formatDateRangeLabel(from: string, to: string): string {
  if (from === to) return from;
  return `${from} → ${to}`;
}

/**
 * Resolve the dashboard date filter to an Asia/Dhaka [from, to] pair (inclusive).
 * Returns an error string instead of guessing when a custom range is invalid.
 */
export function resolveAnalyticsRange(
  preset: AnalyticsRangePreset,
  customFrom?: string,
  customTo?: string,
  now: Date = new Date()
): { from: string; to: string } | { error: string } {
  const today = toReportingDate(now);
  const dayMs = 24 * 60 * 60 * 1000;
  const shift = (days: number) => toReportingDate(new Date(now.getTime() - days * dayMs));

  if (preset === "today") return { from: today, to: today };
  if (preset === "7d") return { from: shift(6), to: today };
  if (preset === "30d") return { from: shift(29), to: today };

  const from = /^\d{4}-\d{2}-\d{2}$/.test(customFrom || "") ? (customFrom as string) : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(customTo || "") ? (customTo as string) : "";
  if (!from || !to) return { error: "Select both a start and an end date." };
  if (from > to) return { error: "The start date must be on or before the end date." };
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs > 366) {
    return { error: "The custom range cannot be longer than 366 days." };
  }
  return { from, to };
}

/** SHA-256 hex of a short-lived rate-limit key (never the raw value itself). */
export async function hashForRateLimit(value: string, salt: string): Promise<string> {
  const payload = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
