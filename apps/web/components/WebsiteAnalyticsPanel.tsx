"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getClientAccessToken } from "../lib/auth-context";
import {
  ANALYTICS_RANGE_PRESETS,
  AnalyticsRangePreset,
  REPORTING_TZ_LABEL,
  formatDateRangeLabel,
  resolveAnalyticsRange,
} from "../lib/analytics";
import {
  AlertCircle,
  BarChart3,
  Eye,
  Globe,
  Loader2,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";

// ==============================================================================
// Website Analytics — Admin Dashboard panel
// Every number below comes from /api/admin/analytics, i.e. from PostgreSQL.
// Nothing is simulated, and an empty range renders as zero.
// ==============================================================================

interface DailyPoint {
  date: string;
  visits: number;
  uniqueVisitors: number;
}

interface PageRow {
  path: string;
  visits: number;
  visitors: number;
}

interface ProductRow {
  slug: string;
  title: string;
  visits: number;
  visitors: number;
}

interface SourceRow {
  referrer: string;
  visits: number;
  visitors: number;
}

interface AnalyticsReport {
  range: { from: string; to: string; today: string; timezone?: string };
  totalVisitsToday: number;
  uniqueVisitorsToday: number;
  totalVisits: number;
  uniqueVisitors: number;
  newVisitors: number;
  returningVisitors: number;
  newVisitorsReturning: number;
  daily: DailyPoint[];
  topPages: PageRow[];
  topProducts: ProductRow[];
  sources: SourceRow[];
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString("en-US") : "0";
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
        <span className="text-amber-400">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">{formatNumber(value)}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}

/** Plain SVG bars — no chart library is added for this feature. */
function DailyChart({ points }: { points: DailyPoint[] }) {
  const width = 720;
  const height = 180;
  const padding = 8;
  const max = Math.max(1, ...points.map((p) => p.visits));
  const slot = points.length ? (width - padding * 2) / points.length : 0;
  const barWidth = Math.max(2, slot * 0.42);

  const labelEvery = points.length > 14 ? Math.ceil(points.length / 7) : 1;

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full"
        role="img"
        aria-label="Daily visits and unique visitors"
      >
        <line
          x1={padding}
          y1={height - 22}
          x2={width - padding}
          y2={height - 22}
          stroke="rgb(39 39 42)"
          strokeWidth="1"
        />
        {points.map((point, index) => {
          const x = padding + slot * index + slot / 2;
          const visitHeight = Math.round(((height - 40) * point.visits) / max);
          const visitorHeight = Math.round(((height - 40) * point.uniqueVisitors) / max);
          return (
            <g key={point.date}>
              <title>{`${point.date}: ${point.visits} visits, ${point.uniqueVisitors} visitors`}</title>
              <rect
                x={x - barWidth}
                y={height - 22 - visitHeight}
                width={barWidth}
                height={Math.max(point.visits > 0 ? 2 : 0, visitHeight)}
                rx="2"
                className="fill-amber-500/80"
              />
              <rect
                x={x + 1}
                y={height - 22 - visitorHeight}
                width={barWidth}
                height={Math.max(point.uniqueVisitors > 0 ? 2 : 0, visitorHeight)}
                rx="2"
                className="fill-zinc-600"
              />
            </g>
          );
        })}
        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text
              key={`label-${point.date}`}
              x={padding + slot * index + slot / 2}
              y={height - 6}
              textAnchor="middle"
              className="fill-zinc-500 text-[9px]"
            >
              {point.date.slice(5)}
            </text>
          ) : null
        )}
      </svg>
      <div className="flex items-center gap-5 text-[11px] text-zinc-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/80" /> Deduplicated daily page visits
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-zinc-600" /> Unique visitors
        </span>
        <span className="ml-auto text-zinc-500">Peak day: {formatNumber(max)}</span>
      </div>
    </div>
  );
}

function RankedList({
  title,
  icon,
  rows,
  emptyLabel,
  primaryLabel,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { label: string; href?: string; visits: number; visitors: number }[];
  emptyLabel: string;
  primaryLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <span className="text-amber-400">{icon}</span>
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">{title}</h3>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row, index) => (
            <li
              key={`${row.label}-${index}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3 py-2"
            >
              <div className="min-w-0">
                <span className="mr-2 text-[10px] font-bold text-zinc-600">{index + 1}</span>
                {row.href ? (
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-xs font-semibold text-zinc-200 hover:text-amber-400"
                  >
                    {row.label}
                  </a>
                ) : (
                  <span className="break-all text-xs font-semibold text-zinc-200">{row.label}</span>
                )}
                <p className="mt-0.5 text-[10px] text-zinc-500">{formatNumber(row.visitors)} unique visitors</p>
              </div>
              <span className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                {formatNumber(row.visits)} {primaryLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WebsiteAnalyticsPanel() {
  const [preset, setPreset] = useState<AnalyticsRangePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getClientAccessToken();
      const resolved = resolveAnalyticsRange(preset, customFrom, customTo);
      if ("error" in resolved) {
        setError(resolved.error);
        setReport(null);
        return;
      }

      const params = new URLSearchParams({ range: preset, from: resolved.from, to: resolved.to });
      const res = await fetch(`/api/admin/analytics?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setReport(null);
        setError(data?.error || "Failed to load analytics data");
        return;
      }

      setReport((data?.report as AnalyticsReport) || null);
    } catch (err: any) {
      setReport(null);
      setError(err?.message || "Could not reach the analytics service");
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(() => {
    const empty = {
      totalVisitsToday: 0,
      uniqueVisitorsToday: 0,
      newVisitors: 0,
      returningVisitors: 0,
      newVisitorsReturning: 0,
    };
    return { ...empty, ...(report || {}) } as typeof empty;
  }, [report]);

  const rangeLabel = report?.range
    ? formatDateRangeLabel(report.range.from, report.range.to)
    : "";
  // Reporting-day label comes from the SQL response when present, so the UI can
  // never advertise a timezone the database did not actually use.
  const reportingTz = report?.range?.timezone || REPORTING_TZ_LABEL;
  const hasTraffic = Boolean(report && report.totalVisits > 0);

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-400">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Customer traffic only</span>
          </div>
          <h2 className="mt-2 text-lg font-bold text-white">Website Analytics</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Admin and own-catalog seller activity is excluded server-side. Days are {REPORTING_TZ_LABEL} (UTC+6).
            {rangeLabel ? ` • Showing ${rangeLabel}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-wrap gap-2">
            {ANALYTICS_RANGE_PRESETS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreset(option.value)}
                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                  preset === option.value
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex items-end gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                From
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="mt-1 block rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/40 focus:outline-none"
                />
              </label>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                To
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="mt-1 block rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/40 focus:outline-none"
                />
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-all hover:border-zinc-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {loading && !report && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-xs text-zinc-500">Loading analytics…</p>
        </div>
      )}

      {!loading && !report && !error && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-zinc-700" />
          <p className="mt-3 text-sm font-semibold text-zinc-300">No analytics data available</p>
          <p className="mt-1 text-xs text-zinc-500">
            Traffic statistics appear once visitors start browsing the storefront.
          </p>
        </div>
      )}

      {report && (
        <>
          {/* Overview cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Eye className="h-4 w-4" />}
              label="Total Visits Today"
              value={cards.totalVisitsToday}
              hint={`Deduplicated daily page visits · ${report.range.today} ${reportingTz}`}
            />
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Unique Visitors Today"
              value={cards.uniqueVisitorsToday}
              hint={`Distinct visitors today (${reportingTz})`}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="New Visitors"
              value={cards.newVisitors}
              hint={`First seen within ${rangeLabel}`}
            />
            <StatCard
              icon={<Globe className="h-4 w-4" />}
              label="Returning Visitors"
              value={cards.returningVisitors}
              hint={
                cards.newVisitorsReturning > 0
                  ? `Seen before the range or revisited · ${formatNumber(cards.newVisitorsReturning)} of them are also new`
                  : "Seen before the range, or revisited on another day"
              }
            />
          </div>

          {/* Daily traffic */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Daily Traffic
              </h3>
              <span className="text-[11px] text-zinc-500">
                {formatNumber(report.totalVisits)} visits · {formatNumber(report.uniqueVisitors)} unique
                visitors in range
              </span>
            </div>
            <div className="pt-4">
              {hasTraffic ? (
                <DailyChart points={report.daily} />
              ) : (
                <p className="py-8 text-center text-xs text-zinc-500">
                  No traffic recorded for this range yet.
                </p>
              )}
            </div>
          </div>

          {/* Reports */}
          <div className="grid gap-4 lg:grid-cols-3">
            <RankedList
              title="Top Viewed Pages"
              icon={<BarChart3 className="h-4 w-4" />}
              primaryLabel="visits"
              emptyLabel="No page views recorded for this range yet."
              rows={report.topPages.map((row) => ({
                label: row.path,
                visits: row.visits,
                visitors: row.visitors,
              }))}
            />
            <RankedList
              title="Top Viewed Products"
              icon={<Package className="h-4 w-4" />}
              primaryLabel="views"
              emptyLabel="No product pages viewed for this range yet."
              rows={report.topProducts.map((row) => ({
                label: row.title,
                href: `/products/${row.slug}`,
                visits: row.visits,
                visitors: row.visitors,
              }))}
            />
            <RankedList
              title="Traffic Sources"
              icon={<Globe className="h-4 w-4" />}
              primaryLabel="visits"
              emptyLabel="No referring traffic recorded for this range yet."
              rows={report.sources.map((row) => ({
                label: row.referrer,
                visits: row.visits,
                visitors: row.visitors,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
