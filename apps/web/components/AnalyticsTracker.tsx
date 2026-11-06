"use client";

import { useEffect } from "react";
import { insforge } from "../lib/insforge";
import {
  TRACK_ENDPOINT,
  extractReferrerDomain,
  getVisitorId,
  normalizePagePath,
} from "../lib/analytics";

/**
 * Fire-and-forget page-view beacon.
 *
 * De-duplication happens twice on purpose:
 *  - here, per browser tab, so React re-renders / effect re-runs never double-send;
 *  - in PostgreSQL, where uq_analytics_pv_visitor_path_day keeps one row per
 *    visitor + path + Asia/Dhaka day, so refreshes cannot inflate the counts.
 *
 * Nothing here is awaited and every failure is swallowed: analytics must never
 * block rendering or surface an error to a shopper.
 */
export default function AnalyticsTracker() {
  useEffect(() => {
    const sent = new Set<string>();
    let disposed = false;

    const send = async () => {
      if (disposed || typeof window === "undefined") return;

      const path = normalizePagePath(window.location.pathname);
      if (!path || sent.has(path)) return;
      sent.add(path);

      const visitorId = getVisitorId();
      if (!visitorId) return;

      const referrerDomain = extractReferrerDomain(document.referrer, [window.location.hostname]);

      // Local token read only (no refresh round trip): anonymous visitors must
      // stay free of extra network calls. The server re-verifies this token and
      // never trusts a role claim from the browser.
      let token: string | null = null;
      try {
        token = await insforge.getHttpClient().getValidAccessToken();
      } catch {
        token = null;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token && token !== "undefined" && token !== "null") {
        headers.Authorization = `Bearer ${token}`;
      }

      const payload = JSON.stringify({ visitorId, path, referrer: referrerDomain });

      try {
        // Keep the request alive across navigation without delaying paint.
        await fetch(TRACK_ENDPOINT, {
          method: "POST",
          headers,
          body: payload,
          credentials: "omit",
          keepalive: true,
        });
      } catch {
        // Best-effort only: a lost page view must never affect the storefront.
      }
    };

    // Run off the critical path so tracking never blocks the first paint.
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => void send(), { timeout: 2000 });
      } else {
        window.setTimeout(() => void send(), 1200);
      }
    };

    schedule();

    // Capture client-side navigation (Next.js Link) without a re-mount.
    const history = window.history;
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    const onNavigate = () => schedule();
    history.pushState = function pushState(...args: Parameters<History["pushState"]>) {
      const result = originalPushState.apply(this, args);
      onNavigate();
      return result;
    };
    history.replaceState = function replaceState(...args: Parameters<History["replaceState"]>) {
      const result = originalReplaceState.apply(this, args);
      onNavigate();
      return result;
    };
    window.addEventListener("popstate", onNavigate);

    return () => {
      disposed = true;
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", onNavigate);
    };
  }, []);

  return null;
}
