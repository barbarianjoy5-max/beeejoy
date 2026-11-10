-- ==============================================================================
-- BEEEJOY Migration: Create site_settings table with hardened security
-- ==============================================================================

-- 1. Create site_settings key-value table
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 3. Remove any previous broad or legacy policies
DROP POLICY IF EXISTS "Allow public read on site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow public read on homepage animation setting" ON public.site_settings;

-- 4. Public Read: STRICTLY restricted to 'homepage_hero_animation' only
CREATE POLICY "Allow public read on homepage animation setting"
  ON public.site_settings
  FOR SELECT
  USING (key = 'homepage_hero_animation');

-- 5. Admin Full Access: Reuses BEEEJOY's canonical is_admin() function
DROP POLICY IF EXISTS "Allow admin full access on site_settings" ON public.site_settings;
CREATE POLICY "Allow admin full access on site_settings"
  ON public.site_settings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. Grant explicit table permissions (RLS strictly filters all row operations)
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
