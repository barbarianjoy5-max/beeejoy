-- ==============================================================================
-- BEEEJOY Production-Hardened Database Schema, Atomic Procedures & Strict RLS
-- Target: InsForge Managed PostgreSQL (ap-southeast / Singapore)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. HARDENED RBAC HELPER FUNCTIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.is_vendor()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('vendor', 'admin')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_vendor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_vendor() TO authenticated;

-- ==============================================================================
-- 3. PROFILES TABLE, SIGNUP TRIGGER & IMMUTABLE ROLE GUARD
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'vendor', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: Ensure every new user starts strictly as 'customer'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.profile->>'name', NEW.metadata->>'name', ''),
    'customer' -- Role is hardcoded to customer; metadata cannot escalate privileges
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Guard against role escalation, email change, or id mutation
CREATE OR REPLACE FUNCTION public.enforce_profile_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.role := OLD.role;
    NEW.id := OLD.id;
    NEW.email := OLD.email;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_update_guard ON public.profiles;
CREATE TRIGGER trg_profile_update_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_update_guard();

-- ==============================================================================
-- 4. VENDORS TABLE, VENDOR GUARD & PUBLIC VIEW (Hides payout_info)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  store_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  payout_info JSONB NOT NULL DEFAULT '{}'::jsonb, -- Sensitive bank/mobile payout details
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public view exposing only non-sensitive vendor information
CREATE OR REPLACE VIEW public.public_vendors AS
  SELECT 
    id,
    store_name,
    slug,
    bio,
    created_at
  FROM public.vendors
  WHERE status = 'active';

GRANT SELECT ON public.public_vendors TO anon, authenticated;

-- Trigger: Guard against vendor self-elevation of status or commission_rate
CREATE OR REPLACE FUNCTION public.enforce_vendor_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.status := OLD.status;
    NEW.commission_rate := OLD.commission_rate;
    NEW.user_id := OLD.user_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_update_guard ON public.vendors;
CREATE TRIGGER trg_vendor_update_guard
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_update_guard();

-- ==============================================================================
-- 5. CATEGORIES TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO anon, authenticated;

-- ==============================================================================
-- 6. PRODUCTS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT,
  description TEXT,
  product_type TEXT NOT NULL DEFAULT 'cep_extension' CHECK (product_type IN ('cep_extension', 'script', 'standalone', 'plugin')),
  price_cents INT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'archived')),
  thumbnail_url TEXT,
  screenshots JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.products TO anon, authenticated;

-- ==============================================================================
-- 7. SOFTWARE RELEASES & PUBLIC SECURE VIEW (Hides storage_path)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.software_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version_str TEXT NOT NULL,
  changelog TEXT,
  storage_path TEXT NOT NULL, -- Private S3 key: NEVER accessible directly by public
  file_checksum_sha256 TEXT,
  file_size_bytes BIGINT,
  min_host_version TEXT,
  max_host_version TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_release_version UNIQUE (product_id, version_str)
);

-- Public view that exposes only safe release metadata for published products
CREATE OR REPLACE VIEW public.public_software_releases AS
  SELECT 
    sr.id,
    sr.product_id,
    sr.version_str,
    sr.changelog,
    sr.file_checksum_sha256,
    sr.file_size_bytes,
    sr.min_host_version,
    sr.max_host_version,
    sr.is_active,
    sr.created_at
  FROM public.software_releases sr
  INNER JOIN public.products p ON p.id = sr.product_id
  WHERE sr.is_active = true AND p.status = 'published';

GRANT SELECT ON public.public_software_releases TO anon, authenticated;

-- ==============================================================================
-- 8. ORDERS TABLE, ORDER GUARD & STATUS TRANSITIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  total_amount_cents INT NOT NULL DEFAULT 0 CHECK (total_amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BDT',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bkash_manual', 'nagad_manual', 'bank_manual', 'gateway_modular')),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'under_review', 'completed', 'cancelled', 'refunded')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guard: Customers cannot mark orders completed or alter order totals
CREATE OR REPLACE FUNCTION public.enforce_order_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF OLD.customer_id = auth.uid() AND OLD.status = 'pending_payment' AND NEW.status = 'cancelled' THEN
      NEW.status := 'cancelled';
    ELSE
      NEW.status := OLD.status;
      NEW.total_amount_cents := OLD.total_amount_cents;
      NEW.customer_id := OLD.customer_id;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_update_guard ON public.orders;
CREATE TRIGGER trg_order_update_guard
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_update_guard();

-- ==============================================================================
-- 9. ORDER ITEMS TABLE & SERVER-SIDE VALIDATION + COMPREHENSIVE RECALCULATION
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  release_id UUID REFERENCES public.software_releases(id) ON DELETE SET NULL,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  unit_price_cents INT NOT NULL CHECK (unit_price_cents >= 0),
  vendor_payout_cents INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guard: Enforces immutability of order_id on order_items to prevent hijacking items between orders
CREATE OR REPLACE FUNCTION public.enforce_order_item_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.order_id := OLD.order_id;
    NEW.product_id := OLD.product_id;
    NEW.unit_price_cents := OLD.unit_price_cents;
    NEW.vendor_id := OLD.vendor_id;
    NEW.vendor_payout_cents := OLD.vendor_payout_cents;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_item_guard ON public.order_items;
CREATE TRIGGER trg_order_item_guard
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_guard();

-- Trigger: Enforces server-authoritative pricing and vendor ownership on insert
CREATE OR REPLACE FUNCTION public.validate_order_item_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_order_status TEXT;
  v_comm NUMERIC(5,2);
BEGIN
  -- 1. Ensure parent order exists, is owned by auth.uid(), and is pending_payment
  SELECT status INTO v_order_status
  FROM public.orders
  WHERE id = NEW.order_id AND (customer_id = auth.uid() OR public.is_admin());

  IF v_order_status IS NULL OR v_order_status != 'pending_payment' THEN
    RAISE EXCEPTION 'Order item insertion denied: order does not exist or is not in pending_payment state';
  END IF;

  -- 2. Fetch authoritative product details from database
  SELECT * INTO v_product
  FROM public.products
  WHERE id = NEW.product_id AND status = 'published';

  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Referenced product is not published or does not exist';
  END IF;

  -- 3. Overwrite client payload with authoritative server price and vendor
  NEW.unit_price_cents := v_product.price_cents;
  NEW.vendor_id := v_product.vendor_id;

  SELECT COALESCE(commission_rate, 15.00) INTO v_comm
  FROM public.vendors
  WHERE id = v_product.vendor_id;

  NEW.vendor_payout_cents := ROUND(v_product.price_cents * (1 - (v_comm / 100.0)));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_item ON public.order_items;
CREATE TRIGGER trg_validate_order_item
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_item_data();

-- Trigger: Comprehensive order total recalculation handling INSERT, UPDATE, and DELETE (including order_id shifts)
CREATE OR REPLACE FUNCTION public.recalculate_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If UPDATE modified order_id, recalculate BOTH the old and new orders
  IF TG_OP = 'UPDATE' AND OLD.order_id IS DISTINCT FROM NEW.order_id THEN
    UPDATE public.orders
    SET total_amount_cents = (
      SELECT COALESCE(SUM(unit_price_cents), 0) FROM public.order_items WHERE order_id = OLD.order_id
    ), updated_at = now()
    WHERE id = OLD.order_id;

    UPDATE public.orders
    SET total_amount_cents = (
      SELECT COALESCE(SUM(unit_price_cents), 0) FROM public.order_items WHERE order_id = NEW.order_id
    ), updated_at = now()
    WHERE id = NEW.order_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.orders
    SET total_amount_cents = (
      SELECT COALESCE(SUM(unit_price_cents), 0) FROM public.order_items WHERE order_id = OLD.order_id
    ), updated_at = now()
    WHERE id = OLD.order_id;

  ELSE
    -- INSERT or normal UPDATE (unit_price_cents modified without order_id change)
    UPDATE public.orders
    SET total_amount_cents = (
      SELECT COALESCE(SUM(unit_price_cents), 0) FROM public.order_items WHERE order_id = NEW.order_id
    ), updated_at = now()
    WHERE id = NEW.order_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_order_total ON public.order_items;
CREATE TRIGGER trg_recalculate_order_total
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_order_total();

-- ==============================================================================
-- 10. MANUAL PAYMENT SUBMISSIONS & DUPLICATE TRANSACTION PREVENTION
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.manual_payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_channel TEXT NOT NULL CHECK (payment_channel IN ('bkash', 'nagad', 'bank')),
  sender_identifier TEXT NOT NULL,
  transaction_ref TEXT NOT NULL,
  receipt_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index prevents duplicate active or verified transaction IDs within the same channel
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_payment_channel_trx 
  ON public.manual_payment_submissions (payment_channel, UPPER(TRIM(transaction_ref))) 
  WHERE status IN ('submitted', 'verified');

-- ==============================================================================
-- 11. LICENSES TABLE (Server-issued entitlements)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  license_key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  max_activations INT NOT NULL DEFAULT 2 CHECK (max_activations >= 1),
  current_activations INT NOT NULL DEFAULT 0 CHECK (current_activations >= 0),
  grace_period_days INT NOT NULL DEFAULT 7 CHECK (grace_period_days >= 0),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_order_product_license UNIQUE (order_id, product_id)
);

-- ==============================================================================
-- 12. LICENSE ACTIVATIONS (Machine tracking)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.license_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  machine_fingerprint TEXT NOT NULL,
  device_name TEXT,
  os_info TEXT,
  host_app_version TEXT,
  last_ping_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_license_machine UNIQUE (license_id, machine_fingerprint)
);

-- ==============================================================================
-- 13. ATOMIC & CONCURRENCY-SAFE STORED PROCEDURES
-- ==============================================================================

-- Atomic, Concurrency-Safe License Activation (Row-level locking with FOR UPDATE)
CREATE OR REPLACE FUNCTION public.activate_license_machine(
  p_license_key_hash TEXT,
  p_product_slug TEXT,
  p_machine_fingerprint TEXT,
  p_device_name TEXT DEFAULT 'Unknown device',
  p_os_info TEXT DEFAULT 'Unknown OS',
  p_host_app_version TEXT DEFAULT 'Illustrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_license RECORD;
  v_activation_id UUID;
  v_grace_hours INT;
  v_grace_until TIMESTAMPTZ;
BEGIN
  -- 1. Exclusively lock the target license row to eliminate activation race conditions
  SELECT 
    l.id,
    l.status,
    l.max_activations,
    l.current_activations,
    l.grace_period_days,
    l.expires_at,
    p.slug AS product_slug
  INTO v_license
  FROM public.licenses l
  INNER JOIN public.products p ON p.id = l.product_id
  WHERE l.license_key_hash = p_license_key_hash
    AND p.slug = p_product_slug
  FOR UPDATE OF l;

  IF v_license.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Invalid license key or product mismatch');
  END IF;

  IF v_license.status != 'active' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'License status is ' || v_license.status);
  END IF;

  IF v_license.expires_at IS NOT NULL AND v_license.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'License has expired');
  END IF;

  -- 2. Check if this machine is already registered
  SELECT id INTO v_activation_id
  FROM public.license_activations
  WHERE license_id = v_license.id AND machine_fingerprint = p_machine_fingerprint;

  IF v_activation_id IS NOT NULL THEN
    -- Existing activation: update heartbeat ping
    UPDATE public.license_activations
    SET last_ping_at = now()
    WHERE id = v_activation_id;
  ELSE
    -- New activation: enforce serialized quota check
    IF v_license.current_activations >= v_license.max_activations THEN
      RETURN jsonb_build_object(
        'valid', false, 
        'reason', format('Activation quota exceeded (%s/%s machines in use)', v_license.current_activations, v_license.max_activations)
      );
    END IF;

    -- Register activation
    INSERT INTO public.license_activations (
      license_id,
      machine_fingerprint,
      device_name,
      os_info,
      host_app_version,
      last_ping_at
    ) VALUES (
      v_license.id,
      p_machine_fingerprint,
      p_device_name,
      p_os_info,
      p_host_app_version,
      now()
    );

    -- Increment count
    UPDATE public.licenses
    SET current_activations = current_activations + 1,
        updated_at = now()
    WHERE id = v_license.id;

    v_license.current_activations := v_license.current_activations + 1;
  END IF;

  v_grace_hours := COALESCE(v_license.grace_period_days, 7) * 24;
  v_grace_until := now() + (v_grace_hours || ' hours')::INTERVAL;

  RETURN jsonb_build_object(
    'valid', true,
    'product', v_license.product_slug,
    'status', 'active',
    'current_activations', v_license.current_activations,
    'max_activations', v_license.max_activations,
    'offline_grace_until', v_grace_until,
    'server_time', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_license_machine(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_license_machine(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Atomic, Idempotent Payment Review & License Minter (Admin only)
CREATE OR REPLACE FUNCTION public.verify_manual_payment(
  p_submission_id UUID,
  p_decision TEXT,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub RECORD;
  v_item RECORD;
  v_raw_key TEXT;
  v_key_hash TEXT;
  v_prefix TEXT;
  v_licenses_count INT := 0;
BEGIN
  -- Strict Admin Check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  IF p_decision NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: must be verified or rejected';
  END IF;

  -- Exclusively lock submission row
  SELECT * INTO v_sub
  FROM public.manual_payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'Payment submission not found';
  END IF;

  -- Idempotency check: if already processed, return existing state
  IF v_sub.status = p_decision THEN
    RETURN jsonb_build_object('success', true, 'status', v_sub.status, 'order_id', v_sub.order_id, 'idempotent', true);
  END IF;

  IF p_decision = 'rejected' THEN
    UPDATE public.manual_payment_submissions
    SET status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        admin_notes = p_admin_notes
    WHERE id = p_submission_id;

    UPDATE public.orders
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = v_sub.order_id;

    RETURN jsonb_build_object('success', true, 'status', 'rejected', 'order_id', v_sub.order_id);
  END IF;

  -- DECISION = 'verified': Lock and update order
  UPDATE public.manual_payment_submissions
  SET status = 'verified',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = p_admin_notes
  WHERE id = p_submission_id;

  UPDATE public.orders
  SET status = 'completed',
      updated_at = now()
  WHERE id = v_sub.order_id;

  -- Mint unique licenses for each order item (idempotent ON CONFLICT DO NOTHING)
  FOR v_item IN (SELECT * FROM public.order_items WHERE order_id = v_sub.order_id) LOOP
    v_raw_key := 'BEEE-' || upper(encode(gen_random_bytes(2), 'hex')) || '-' ||
                            upper(encode(gen_random_bytes(2), 'hex')) || '-' ||
                            upper(encode(gen_random_bytes(2), 'hex')) || '-' ||
                            upper(encode(gen_random_bytes(2), 'hex'));
    v_key_hash := encode(digest(v_raw_key, 'sha256'), 'hex');
    v_prefix := substring(v_raw_key from 1 for 9);

    INSERT INTO public.licenses (
      order_id,
      customer_id,
      product_id,
      license_key_hash,
      key_prefix,
      status,
      max_activations,
      current_activations,
      grace_period_days
    ) VALUES (
      v_sub.order_id,
      (SELECT customer_id FROM public.orders WHERE id = v_sub.order_id),
      v_item.product_id,
      v_key_hash,
      v_prefix,
      'active',
      2,
      0,
      7
    )
    ON CONFLICT (order_id, product_id) DO NOTHING;

    v_licenses_count := v_licenses_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'status', 'verified', 
    'order_id', v_sub.order_id, 
    'licenses_issued', v_licenses_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_manual_payment(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_manual_payment(UUID, TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- 14. PERFORMANCE & FOREIGN KEY INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON public.vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_slug ON public.vendors(slug);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_software_releases_product ON public.software_releases(product_id);
CREATE INDEX IF NOT EXISTS idx_software_releases_active ON public.software_releases(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_vendor ON public.order_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_order ON public.manual_payment_submissions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON public.manual_payment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_licenses_customer ON public.licenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_licenses_product ON public.licenses(product_id);
CREATE INDEX IF NOT EXISTS idx_licenses_hash ON public.licenses(license_key_hash);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_activations_license ON public.license_activations(license_id);
CREATE INDEX IF NOT EXISTS idx_activations_machine ON public.license_activations(machine_fingerprint);

-- ==============================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.software_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_activations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Profiles Policies (Non-recursive)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins full access on profiles" ON public.profiles;
CREATE POLICY "Admins full access on profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users can update own non-role fields" ON public.profiles;
CREATE POLICY "Users can update own non-role fields" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Vendors Policies (Base table protects payout_info; public uses public_vendors)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendors and admins read base vendor record" ON public.vendors;
CREATE POLICY "Vendors and admins read base vendor record" ON public.vendors
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users apply to be vendor" ON public.vendors;
CREATE POLICY "Users apply to be vendor" ON public.vendors
  FOR INSERT WITH CHECK (
    user_id = auth.uid() 
    AND status = 'pending' 
    AND commission_rate = 15.00
  );

DROP POLICY IF EXISTS "Vendors update own store" ON public.vendors;
CREATE POLICY "Vendors update own store" ON public.vendors
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage all vendors" ON public.vendors;
CREATE POLICY "Admins manage all vendors" ON public.vendors
  FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- Categories Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories" ON public.categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories" ON public.categories
  FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- Products Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read published products" ON public.products;
CREATE POLICY "Public read published products" ON public.products
  FOR SELECT USING (
    status = 'published' 
    OR vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()) 
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Active vendors insert products" ON public.products;
CREATE POLICY "Active vendors insert products" ON public.products
  FOR INSERT WITH CHECK (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid() AND status = 'active')
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Vendors update own products" ON public.products;
CREATE POLICY "Vendors update own products" ON public.products
  FOR UPDATE USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()) 
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins delete products" ON public.products;
CREATE POLICY "Admins delete products" ON public.products
  FOR DELETE USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- Software Releases Policies (Restricts base table; public uses public_software_releases)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendors and admins manage releases" ON public.software_releases;
CREATE POLICY "Vendors and admins manage releases" ON public.software_releases
  FOR ALL USING (
    product_id IN (SELECT id FROM public.products WHERE vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())) 
    OR public.is_admin()
  );

-- ------------------------------------------------------------------------------
-- Orders Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers view own orders" ON public.orders;
CREATE POLICY "Customers view own orders" ON public.orders
  FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Customers insert pending orders" ON public.orders;
CREATE POLICY "Customers insert pending orders" ON public.orders
  FOR INSERT WITH CHECK (customer_id = auth.uid() AND status = 'pending_payment');

DROP POLICY IF EXISTS "Customers update own pending orders" ON public.orders;
CREATE POLICY "Customers update own pending orders" ON public.orders
  FOR UPDATE USING (customer_id = auth.uid() AND status = 'pending_payment');

DROP POLICY IF EXISTS "Admins manage all orders" ON public.orders;
CREATE POLICY "Admins manage all orders" ON public.orders
  FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- Order Items Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers view own order items" ON public.order_items;
CREATE POLICY "Customers view own order items" ON public.order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
    OR vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Customers insert own order items" ON public.order_items;
CREATE POLICY "Customers insert own order items" ON public.order_items
  FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid() AND status = 'pending_payment')
  );

DROP POLICY IF EXISTS "Customers delete own pending order items" ON public.order_items;
CREATE POLICY "Customers delete own pending order items" ON public.order_items
  FOR DELETE USING (
    order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid() AND status = 'pending_payment')
  );

DROP POLICY IF EXISTS "Admins manage order items" ON public.order_items;
CREATE POLICY "Admins manage order items" ON public.order_items
  FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- Manual Payment Submissions Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers view own payment submissions" ON public.manual_payment_submissions;
CREATE POLICY "Customers view own payment submissions" ON public.manual_payment_submissions
  FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Customers submit payment proof" ON public.manual_payment_submissions;
CREATE POLICY "Customers submit payment proof" ON public.manual_payment_submissions
  FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
    AND status = 'submitted'
  );

DROP POLICY IF EXISTS "Admins review payment submissions" ON public.manual_payment_submissions;
CREATE POLICY "Admins review payment submissions" ON public.manual_payment_submissions
  FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- Licenses Policies (Entitlements are strictly managed server-side)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers view own active licenses" ON public.licenses;
CREATE POLICY "Customers view own active licenses" ON public.licenses
  FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage licenses" ON public.licenses;
CREATE POLICY "Admins manage licenses" ON public.licenses
  FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- License Activations Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers view own activations" ON public.license_activations;
CREATE POLICY "Customers view own activations" ON public.license_activations
  FOR SELECT USING (
    license_id IN (SELECT id FROM public.licenses WHERE customer_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins manage activations" ON public.license_activations;
CREATE POLICY "Admins manage activations" ON public.license_activations
  FOR ALL USING (public.is_admin());
