-- ==============================================================================
-- BEEEJOY Membership Duration, Expiry & Free Basic Entitlement Migration
-- Safe, additive, non-breaking schema update.
-- ==============================================================================

-- 1. Vendors table: Add duration timestamps and free basic entitlement status
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS membership_activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS free_basic_status TEXT NOT NULL DEFAULT 'inherit';

-- Enforce valid entitlement states
ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS chk_vendors_free_basic_status;

ALTER TABLE public.vendors
  ADD CONSTRAINT chk_vendors_free_basic_status
  CHECK (free_basic_status IN ('inherit', 'granted', 'revoked'));

-- High-performance partial index: Only indexes active timed plans (excludes permanent NULLs)
CREATE INDEX IF NOT EXISTS idx_vendors_membership_expiry
  ON public.vendors (membership_plan, membership_expires_at)
  WHERE membership_expires_at IS NOT NULL;

-- 2. Membership Payments table: Add duration snapshots and activation timestamps
ALTER TABLE public.membership_payments
  ADD COLUMN IF NOT EXISTS duration_value INTEGER,
  ADD COLUMN IF NOT EXISTS duration_unit TEXT,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
