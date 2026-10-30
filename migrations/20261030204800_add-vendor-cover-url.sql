-- ==============================================================================
-- BEEEJOY Migration: Add cover_url to vendors and update public_vendors view
-- ==============================================================================

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Drop and recreate public_vendors view to safely include cover_url
DROP VIEW IF EXISTS public.public_vendors;

CREATE VIEW public.public_vendors AS
  SELECT 
    id,
    store_name,
    slug,
    bio,
    cover_url,
    created_at
  FROM public.vendors
  WHERE status = 'active';

GRANT SELECT ON public.public_vendors TO anon, authenticated;
