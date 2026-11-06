-- ==============================================================================
-- BEEEJOY Migration: Lightweight Website Analytics (privacy-conscious)
-- ==============================================================================
-- What it creates (nothing is dropped, no existing object is modified):
--   1. public.analytics_dhaka_day(timestamptz)  -- IMMUTABLE reporting-day bucket
--   2. public.analytics_visitors     -- one row per pseudonymous visitor id (first-seen record)
--   3. public.analytics_page_views   -- one row per (visitor, page path, Asia/Dhaka day)
--   4. public.analytics_report(date, date) -- admin-only aggregated report (JSONB)
--
-- Privacy model:
--   * No IP address, user agent, cookie value, query string or account id is stored.
--   * visitor_id is an opaque 128-bit random value generated in the browser and
--     never linked to auth.users / profiles.
--
-- Time model (single source of truth):
--   * occurred_at is written by PostgreSQL (DEFAULT now()); the application never
--     supplies a timestamp, and view_date is a STORED GENERATED column, so no
--     caller can back-date or future-date a row. Historical and future reports
--     cannot be poisoned from the browser.
--   * The reporting day is Asia/Dhaka. Bangladesh has observed no DST since 2009,
--     so the day is defined as the UTC day containing (instant + 6 hours). That is
--     implemented with epoch arithmetic only (extract/floor/date+int), because
--     AT TIME ZONE '...' and timestamptz::date are STABLE and therefore illegal in
--     a generated column. analytics_dhaka_day() is the one definition used by both
--     the stored bucket and every report query, so they cannot drift apart.
--
-- Anti-inflation model:
--   * uq_analytics_pv_visitor_path_day keeps one row per visitor + page path +
--     Dhaka day, so refreshes and repeat views of the same page collapse into a
--     single record. The metric is therefore DEDUPLICATED DAILY PAGE VISITS --
--     it is neither a raw page-view stream nor a session count. Enforced by the
--     database, not by application code, so it cannot be bypassed by a client.
--
-- Security model:
--   * RLS is enabled on both tables and NO insert/update/delete policy exists.
--   * Table privileges are revoked from anon/authenticated and only SELECT is
--     re-granted (further filtered by the admin-only policies).
--   * Browsers only ever hold NEXT_PUBLIC_INSFORGE_ANON_KEY, so a visitor cannot
--     insert or modify analytics records directly. All writes go through the
--     server-side ingest route, which uses the server-only INSFORGE_API_KEY and
--     verifies identity against the database first.
--   * analytics_report runs with INVOKER rights and therefore also obeys those
--     RLS policies; it additionally hard-fails unless public.is_admin() is true.
--
-- Metric definitions produced by analytics_report(p_from, p_to), all over Dhaka
-- days in the inclusive range, each visitor counted at most once per metric:
--   totalVisitsToday    -- deduplicated daily page visits on the current Dhaka day
--   uniqueVisitorsToday -- distinct visitors with >=1 visit on the current Dhaka day
--   totalVisits         -- deduplicated daily page visits in range
--   uniqueVisitors      -- distinct visitors active in range
--   newVisitors         -- distinct active visitors whose FIRST-EVER Dhaka day
--                          (analytics_visitors.first_seen_at) falls inside the range
--   returningVisitors   -- distinct active visitors who either had been seen before
--                          the range (first-seen day < p_from) OR visited on at least
--                          two different Dhaka days inside the range. This is the
--                          corrected definition: a visitor who first arrived during
--                          the range and came back later in the same range now counts.
--   newVisitorsReturning-- the overlap between the two cohorts above, reported so the
--                          relationship is explicit instead of implying that
--                          new + returning partitions uniqueVisitors
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REPORTING-DAY BUCKET (Asia/Dhaka = UTC+6, year-round)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_dhaka_day(p_instant timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT DATE '1970-01-01' + FLOOR((EXTRACT(EPOCH FROM p_instant) + 21600) / 86400)::int;
$$;

COMMENT ON FUNCTION public.analytics_dhaka_day(timestamptz) IS 'Asia/Dhaka (UTC+6) calendar day of an instant; immutable so it can back a generated column';

-- ------------------------------------------------------------------------------
-- 2. VISITOR REGISTRY (first-seen record used for new vs returning)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_visitors (
  visitor_id TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_referrer_domain TEXT,
  CONSTRAINT ck_analytics_visitor_id CHECK (visitor_id ~ '^[0-9a-f]{32}$'),
  CONSTRAINT ck_analytics_visitor_referrer CHECK (first_referrer_domain IS NULL OR first_referrer_domain ~ '^[a-z0-9.-]{1,253}$')
);

COMMENT ON TABLE public.analytics_visitors IS 'Pseudonymous visitor registry; first-seen timestamp only, no PII';

-- ------------------------------------------------------------------------------
-- 3. PAGE VIEWS (deduplicated per visitor + path + Asia/Dhaka day)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_page_views (
  id BIGSERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  product_slug TEXT,
  referrer_domain TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  view_date DATE GENERATED ALWAYS AS (public.analytics_dhaka_day(occurred_at)) STORED,
  CONSTRAINT ck_analytics_pv_visitor_id CHECK (visitor_id ~ '^[0-9a-f]{32}$'),
  CONSTRAINT ck_analytics_pv_page_path CHECK (page_path ~ '^/[^[:cntrl:][:space:]]{0,199}$'),
  CONSTRAINT ck_analytics_pv_product_slug CHECK (product_slug IS NULL OR product_slug ~ '^[a-z0-9-]{1,200}$'),
  CONSTRAINT ck_analytics_pv_referrer_domain CHECK (referrer_domain IS NULL OR referrer_domain ~ '^[a-z0-9.-]{1,253}$'),
  CONSTRAINT ck_analytics_pv_view_date CHECK (view_date BETWEEN DATE '2020-01-01' AND DATE '2100-12-31'),
  CONSTRAINT uq_analytics_pv_visitor_path_day UNIQUE (visitor_id, page_path, view_date)
);

COMMENT ON TABLE public.analytics_page_views IS 'Deduplicated daily page visits (visitor + path + Asia/Dhaka day); no IP, no user agent, no PII';
COMMENT ON COLUMN public.analytics_page_views.view_date IS 'STORED generated Asia/Dhaka day of occurred_at; not writable by any client';

-- Indexes (each one backs a specific report query, nothing speculative):
--   * range scans over view_date for every report block
CREATE INDEX IF NOT EXISTS idx_analytics_pv_view_date
  ON public.analytics_page_views (view_date);
--   * "Top Viewed Products" for a date range (partial: only product rows)
CREATE INDEX IF NOT EXISTS idx_analytics_pv_product_by_date
  ON public.analytics_page_views (view_date, product_slug)
  WHERE product_slug IS NOT NULL;
--   * "New Visitors" over a date range
CREATE INDEX IF NOT EXISTS idx_analytics_visitors_first_seen
  ON public.analytics_visitors (first_seen_at);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY: read for the single admin only, no client writes
-- ------------------------------------------------------------------------------
ALTER TABLE public.analytics_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_page_views ENABLE ROW LEVEL SECURITY;

-- DROP/CREATE keeps the migration re-runnable, matching the IF NOT EXISTS style above.
DROP POLICY IF EXISTS "Allow admin read on analytics_visitors" ON public.analytics_visitors;
CREATE POLICY "Allow admin read on analytics_visitors"
  ON public.analytics_visitors
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Allow admin read on analytics_page_views" ON public.analytics_page_views;
CREATE POLICY "Allow admin read on analytics_page_views"
  ON public.analytics_page_views
  FOR SELECT
  USING (public.is_admin());

-- No INSERT / UPDATE / DELETE policy is created on purpose.
-- Privilege floor first, then the narrow re-grant of SELECT only.
REVOKE ALL ON public.analytics_visitors FROM anon, authenticated;
REVOKE ALL ON public.analytics_page_views FROM anon, authenticated;
GRANT SELECT ON public.analytics_visitors TO authenticated;
GRANT SELECT ON public.analytics_page_views TO authenticated;

-- The ingest route writes through the server-only INSFORGE_API_KEY client. Grant
-- the service role the write access it needs if that role exists in this project;
-- the DO block keeps the migration safe where it does not.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT ON public.analytics_visitors, public.analytics_page_views TO service_role;
    GRANT USAGE ON SEQUENCE public.analytics_page_views_id_seq TO service_role;
  END IF;
END
$do$;

-- ------------------------------------------------------------------------------
-- 5. ADMIN REPORT FUNCTION (single round trip, aggregation stays in PostgreSQL)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_report(p_from date, p_to date)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := public.analytics_dhaka_day(now());
  v_visits_today int := 0;
  v_unique_today int := 0;
  v_visits_range int := 0;
  v_unique_range int := 0;
  v_new int := 0;
  v_returning int := 0;
  v_overlap int := 0;
BEGIN
  -- Defence in depth: the RLS policies above already hide everything, but a
  -- non-admin must get an explicit refusal rather than an empty report.
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR (p_to - p_from) > 366 THEN
    RAISE EXCEPTION 'Invalid analytics date range' USING ERRCODE = '22023';
  END IF;

  -- Today (Asia/Dhaka) overview cards 1 and 2.
  SELECT count(*), count(DISTINCT visitor_id)
    INTO v_visits_today, v_unique_today
  FROM analytics_page_views
  WHERE view_date = v_today;

  -- Range totals.
  SELECT count(*), count(DISTINCT visitor_id)
    INTO v_visits_range, v_unique_range
  FROM analytics_page_views
  WHERE view_date BETWEEN p_from AND p_to;

  -- New / returning cohorts, computed over one grouped pass so each visitor is
  -- evaluated exactly once. days_in_range >= 2 is what recognises a visitor who
  -- arrived inside the range and came back inside the same range.
  -- LEFT JOIN keeps a visitor counted even if their registry row is missing
  -- (COALESCE then treats them as first seen on their earliest range day, i.e. new).
  SELECT
    count(*) FILTER (WHERE j.first_seen_day BETWEEN p_from AND p_to),
    count(*) FILTER (WHERE j.first_seen_day < p_from OR j.days_in_range >= 2),
    count(*) FILTER (WHERE j.first_seen_day BETWEEN p_from AND p_to AND j.days_in_range >= 2)
  INTO v_new, v_returning, v_overlap
  FROM (
    SELECT
      pv.visitor_id,
      count(DISTINCT pv.view_date) AS days_in_range,
      COALESCE(
        public.analytics_dhaka_day(MIN(v.first_seen_at)),
        MIN(pv.view_date)
      ) AS first_seen_day
    FROM analytics_page_views pv
    LEFT JOIN analytics_visitors v ON v.visitor_id = pv.visitor_id
    WHERE pv.view_date BETWEEN p_from AND p_to
    GROUP BY pv.visitor_id
  ) j;

  RETURN jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'today', v_today, 'timezone', 'Asia/Dhaka'),

    'totalVisitsToday', v_visits_today,
    'uniqueVisitorsToday', v_unique_today,
    'totalVisits', v_visits_range,
    'uniqueVisitors', v_unique_range,
    'newVisitors', v_new,
    'returningVisitors', v_returning,
    'newVisitorsReturning', v_overlap,

    -- Daily visitor + page-view statistics, zero-filled across the whole range.
    'daily', COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object(
                 'date', (p_from + gs.n)::text,
                 'visits', COALESCE(x.visits, 0),
                 'uniqueVisitors', COALESCE(x.unique_visitors, 0)
               )
               ORDER BY gs.n
             )
      FROM generate_series(0, (p_to - p_from)::int) AS gs(n)
      LEFT JOIN (
        SELECT view_date, count(*) AS visits, count(DISTINCT visitor_id) AS unique_visitors
        FROM analytics_page_views
        WHERE view_date BETWEEN p_from AND p_to
        GROUP BY view_date
      ) x ON x.view_date = p_from + gs.n
    ), '[]'::jsonb),

    -- Top viewed pages (product detail pages are reported separately).
    'topPages', COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object('path', y.path, 'visits', y.visits, 'visitors', y.visitors)
               ORDER BY y.rn
             )
      FROM (
        SELECT page_path AS path,
               count(*) AS visits,
               count(DISTINCT visitor_id) AS visitors,
               row_number() OVER (ORDER BY count(*) DESC, page_path) AS rn
        FROM analytics_page_views
        WHERE view_date BETWEEN p_from AND p_to
          AND product_slug IS NULL
        GROUP BY page_path
        ORDER BY rn
        LIMIT 10
      ) y
    ), '[]'::jsonb),

    -- Top viewed products.
    'topProducts', COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object('slug', y.slug, 'title', y.title, 'visits', y.visits, 'visitors', y.visitors)
               ORDER BY y.rn
             )
      FROM (
        SELECT pv.product_slug AS slug,
               COALESCE(NULLIF(TRIM(p.title), ''), pv.product_slug) AS title,
               count(*) AS visits,
               count(DISTINCT pv.visitor_id) AS visitors,
               row_number() OVER (ORDER BY count(*) DESC, pv.product_slug) AS rn
        FROM analytics_page_views pv
        LEFT JOIN products p ON p.slug = pv.product_slug
        WHERE pv.view_date BETWEEN p_from AND p_to
          AND pv.product_slug IS NOT NULL
        GROUP BY pv.product_slug, p.title
        ORDER BY rn
        LIMIT 10
      ) y
    ), '[]'::jsonb),

    -- Traffic sources (referral hostname only; '(direct)' when absent).
    'sources', COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object('referrer', y.referrer, 'visits', y.visits, 'visitors', y.visitors)
               ORDER BY y.rn
             )
      FROM (
        SELECT COALESCE(NULLIF(referrer_domain, ''), '(direct)') AS referrer,
               count(*) AS visits,
               count(DISTINCT visitor_id) AS visitors,
               row_number() OVER (ORDER BY count(*) DESC, COALESCE(NULLIF(referrer_domain, ''), '(direct)')) AS rn
        FROM analytics_page_views
        WHERE view_date BETWEEN p_from AND p_to
        GROUP BY COALESCE(NULLIF(referrer_domain, ''), '(direct)')
        ORDER BY rn
        LIMIT 10
      ) y
    ), '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.analytics_report(date, date) IS 'Admin-only aggregated website analytics over Asia/Dhaka reporting days';

REVOKE ALL ON FUNCTION public.analytics_report(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analytics_report(date, date) TO authenticated;
