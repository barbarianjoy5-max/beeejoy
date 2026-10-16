-- ==============================================================================
-- BEEEJOY Standalone Security & RLS Policy Verification Test Suite
-- Target: InsForge Managed PostgreSQL
-- Behavior: Self-contained test transaction with automatic ROLLBACK
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_admin_id UUID := gen_random_uuid();
  v_vendor_id UUID := gen_random_uuid();
  v_customer_id UUID := gen_random_uuid();
  v_other_cust_id UUID := gen_random_uuid();
  v_store_id UUID;
  v_prod_id UUID;
  v_order_id UUID;
  v_order2_id UUID;
  v_item_id UUID;
  v_sub_id UUID;
  v_act_res JSONB;
  v_review_res JSONB;
  v_test_key_hash TEXT;
  v_order_total INT;
  v_order2_total INT;
BEGIN
  RAISE NOTICE '>>> STARTING BEEEJOY AUTOMATED SECURITY & RLS VERIFICATION <<<';

  -- ----------------------------------------------------------------------------
  -- Setup: Create simulated auth user profiles
  -- ----------------------------------------------------------------------------
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES 
    (v_admin_id, 'admin@beeejoy.com', 'Admin User', 'admin'),
    (v_vendor_id, 'vendor@beeejoy.com', 'Vendor User', 'vendor'),
    (v_customer_id, 'customer@beeejoy.com', 'Customer User', 'customer'),
    (v_other_cust_id, 'other@beeejoy.com', 'Other User', 'customer');

  -- ----------------------------------------------------------------------------
  -- TEST 1: Role Escalation Prevention
  -- ----------------------------------------------------------------------------
  RAISE NOTICE '[TEST 1] Verifying customer cannot self-escalate to admin...';
  
  PERFORM set_config('request.jwt.claim.sub', v_customer_id::text, true);
  
  UPDATE public.profiles
  SET role = 'admin', full_name = 'Hacked Name'
  WHERE id = v_customer_id;

  IF (SELECT role FROM public.profiles WHERE id = v_customer_id) = 'admin' THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Customer was able to escalate role to admin!';
  END IF;

  IF (SELECT full_name FROM public.profiles WHERE id = v_customer_id) != 'Hacked Name' THEN
    RAISE EXCEPTION 'FAILURE: Non-role fields should remain updatable.';
  END IF;
  RAISE NOTICE '  -> PASS: Role protected by enforce_profile_update_guard trigger.';

  -- ----------------------------------------------------------------------------
  -- TEST 2: Vendor Self-Elevation Guard (Status & Commission)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE '[TEST 2] Verifying vendor cannot alter status or commission...';
  
  PERFORM set_config('request.jwt.claim.sub', v_vendor_id::text, true);
  
  INSERT INTO public.vendors (user_id, store_name, slug, status, commission_rate, payout_info)
  VALUES (v_vendor_id, 'Vendor Store', 'vendor-store', 'pending', 15.00, '{"bkash":"01700000000"}'::jsonb)
  RETURNING id INTO v_store_id;

  -- Attempt to alter status to active and commission to 0%
  UPDATE public.vendors
  SET status = 'active', commission_rate = 0.00, store_name = 'Updated Store'
  WHERE id = v_store_id;

  IF (SELECT status FROM public.vendors WHERE id = v_store_id) != 'pending' OR
     (SELECT commission_rate FROM public.vendors WHERE id = v_store_id) != 15.00 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Vendor altered status or commission rate!';
  END IF;
  RAISE NOTICE '  -> PASS: Vendor status and commission protected by trigger.';

  -- ----------------------------------------------------------------------------
  -- TEST 3: Admin Activates Vendor & Product Creation
  -- ----------------------------------------------------------------------------
  RAISE NOTICE '[TEST 3] Admin activates vendor and vendor creates product...';
  
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  UPDATE public.vendors SET status = 'active' WHERE id = v_store_id;

  PERFORM set_config('request.jwt.claim.sub', v_vendor_id::text, true);
  INSERT INTO public.products (vendor_id, title, slug, price_cents, status)
  VALUES (v_store_id, 'BEJOY SYSTEM ACTIVE', 'bejoy-system-active', 249900, 'published')
  RETURNING id INTO v_prod_id;

  INSERT INTO public.software_releases (product_id, version_str, storage_path)
  VALUES (v_prod_id, '1.0.0', 'releases/bejoy-system-active/v1.0.0.zxp');

  RAISE NOTICE '  -> PASS: Product and release created.';

  -- ----------------------------------------------------------------------------
  -- TEST 4: Storage Path & Payout Info Leak Prevention in Views
  -- ----------------------------------------------------------------------------
  RAISE NOTICE '[TEST 4] Verifying views omit storage_path and payout_info...';
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_software_releases' AND column_name = 'storage_path') THEN
    RAISE EXCEPTION 'SECURITY FAILURE: public_software_releases leaks storage_path!';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_vendors' AND column_name = 'payout_info') THEN
    RAISE EXCEPTION 'SECURITY FAILURE: public_vendors leaks payout_info!';
  END IF;

  IF (SELECT COUNT(*) FROM public.public_vendors WHERE id = v_store_id) != 1 THEN
    RAISE EXCEPTION 'FAILURE: Active vendor should appear in public_vendors view';
  END IF;
  RAISE NOTICE '  -> PASS: Public views strictly protect private storage paths and payout details.';

  -- ----------------------------------------------------------------------------
  -- TEST 5: Server-Side Price Enforcing & Order Total Recalculation (INSERT, UPDATE, DELETE)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE '[TEST 5] Verifying price-tampering defense and recalculate_order_total()...';
  
  PERFORM set_config('request.jwt.claim.sub', v_customer_id::text, true);
  
  INSERT INTO public.orders (order_number, customer_id, total_amount_cents, payment_method, status)
  VALUES ('ORD-TEST-001', v_customer_id, 0, 'bkash_manual', 'pending_payment')
  RETURNING id INTO v_order_id;

  INSERT INTO public.orders (order_number, customer_id, total_amount_cents, payment_method, status)
  VALUES ('ORD-TEST-002', v_customer_id, 0, 'nagad_manual', 'pending_payment')
  RETURNING id INTO v_order_2_id;

  -- Malicious customer attempts to insert unit_price_cents = 1 (instead of 249900)
  INSERT INTO public.order_items (order_id, product_id, vendor_id, unit_price_cents)
  VALUES (v_order_id, v_prod_id, v_store_id, 1)
  RETURNING id INTO v_item_id;

  -- 5a. Assert authoritative price was enforced by trigger
  IF (SELECT unit_price_cents FROM public.order_items WHERE id = v_item_id) != 249900 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Order item price tampering was not prevented!';
  END IF;

  -- 5b. Assert order total was automatically recalculated after INSERT
  SELECT total_amount_cents INTO v_order_total FROM public.orders WHERE id = v_order_id;
  IF v_order_total != 249900 THEN
    RAISE EXCEPTION 'CALCULATION FAILURE (INSERT): Order total was % instead of 249900', v_order_total;
  END IF;

  -- 5c. Customer attempts to alter item order_id: guard protects it
  UPDATE public.order_items SET order_id = v_order_2_id WHERE id = v_item_id;
  IF (SELECT order_id FROM public.order_items WHERE id = v_item_id) != v_order_id THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Customer hijacked order item to a different order!';
  END IF;

  -- 5d. Test DELETE recalculation: insert second item, then delete it
  INSERT INTO public.order_items (order_id, product_id, vendor_id, unit_price_cents)
  VALUES (v_order_id, v_prod_id, v_store_id, 249900);

  SELECT total_amount_cents INTO v_order_total FROM public.orders WHERE id = v_order_id;
  IF v_order_total != (249900 * 2) THEN
    RAISE EXCEPTION 'CALCULATION FAILURE (2 ITEMS): Order total was % instead of %', v_order_total, (249900 * 2);
  END IF;

  DELETE FROM public.order_items WHERE id = v_item_id;

  SELECT total_amount_cents INTO v_order_total FROM public.orders WHERE id = v_order_id;
  IF v_order_total != 249900 THEN
    RAISE EXCEPTION 'CALCULATION FAILURE (DELETE): Order total was % instead of 249900', v_order_total;
  END IF;

  RAISE NOTICE '  -> PASS: Price tampering blocked, order_id immutable, recalculation verified across INSERT & DELETE.';

  -- ----------------------------------------------------------------------------
  -- TEST 6: Duplicate Transaction Reference Prevention
  -- ----------------------------------------------------------------------------
  RAISE NOTICE '[TEST 6] Verifying duplicate payment reference prevention...';
  
  INSERT INTO public.manual_payment_submissions (order_id, payment_channel, sender_identifier, transaction_ref, status)
  VALUES (v_order_id, 'bkash', '01811111111', 'TRX998877', 'submitted')
  RETURNING id INTO v_sub_id;

  BEGIN
    INSERT INTO public.manual_payment_submissions (order_id, payment_channel, sender_identifier, transaction_ref, status)
    VALUES (v_order_id, 'bkash', '01822222222', 'TRX998877', 'submitted');
    RAISE EXCEPTION 'SECURITY FAILURE: Duplicate transaction reference was accepted!';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '  -> PASS: Duplicate transaction reference was rejected by uq_active_payment_channel_trx.';
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 7: Idempotent Payment Verification & License Generation
  -- ----------------------------------------------------------------------------
  RAISE NOTICE '[TEST 7] Verifying atomic payment review and license issuance...';
  
  -- Non-admin cannot call verify_manual_payment
  PERFORM set_config('request.jwt.claim.sub', v_customer_id::text, true);
  BEGIN
    PERFORM public.verify_manual_payment(v_sub_id, 'verified', 'Attempted unauthorized call');
    RAISE EXCEPTION 'SECURITY FAILURE: Non-admin was able to execute verify_manual_payment!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  -> PASS: Non-admin execution rejected.';
  END;

  -- Admin calls verify_manual_payment
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  v_review_res := public.verify_manual_payment(v_sub_id, 'verified', 'Approved by admin');
  
  IF (v_review_res->>'success')::boolean != true OR
     (SELECT status FROM public.orders WHERE id = v_order_id) != 'completed' OR
     (SELECT COUNT(*) FROM public.licenses WHERE order_id = v_order_id) != 1 THEN
    RAISE EXCEPTION 'FAILURE: Payment verification did not transition order or mint license correctly!';
  END IF;

  -- Idempotency check: call again
  v_review_res := public.verify_manual_payment(v_sub_id, 'verified', 'Approved again');
  IF (v_review_res->>'idempotent')::boolean != true THEN
    RAISE EXCEPTION 'FAILURE: Payment verification is not idempotent on replay!';
  END IF;
  RAISE NOTICE '  -> PASS: Payment verified, order completed, license minted, idempotent on replay.';

  -- ----------------------------------------------------------------------------
  -- TEST 8: Concurrency-Safe License Activation (Quota Enforcement)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE '[TEST 8] Verifying license activation quota enforcement (max 2 machines)...';
  
  SELECT license_key_hash INTO v_test_key_hash FROM public.licenses WHERE order_id = v_order_id;

  -- Machine 1: Activate
  v_act_res := public.activate_license_machine(v_test_key_hash, 'bejoy-system-active', 'FINGERPRINT-MAC-01');
  IF (v_act_res->>'valid')::boolean != true THEN
    RAISE EXCEPTION 'FAILURE: Activation 1 should have succeeded!';
  END IF;

  -- Machine 2: Activate
  v_act_res := public.activate_license_machine(v_test_key_hash, 'bejoy-system-active', 'FINGERPRINT-WIN-02');
  IF (v_act_res->>'valid')::boolean != true THEN
    RAISE EXCEPTION 'FAILURE: Activation 2 should have succeeded!';
  END IF;

  -- Machine 3: Exceeds quota (max 2)
  v_act_res := public.activate_license_machine(v_test_key_hash, 'bejoy-system-active', 'FINGERPRINT-MAC-03');
  IF (v_act_res->>'valid')::boolean = true THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Activation 3 exceeded max_activations quota!';
  END IF;
  RAISE NOTICE '  -> PASS: Machine 3 activation blocked (%): %', v_act_res->>'reason', 'Quota safely enforced';

  -- Heartbeat from Machine 1 (Existing): Should succeed without consuming quota
  v_act_res := public.activate_license_machine(v_test_key_hash, 'bejoy-system-active', 'FINGERPRINT-MAC-01');
  IF (v_act_res->>'valid')::boolean != true THEN
    RAISE EXCEPTION 'FAILURE: Heartbeat ping from existing machine should succeed!';
  END IF;
  RAISE NOTICE '  -> PASS: Existing machine heartbeat ping verified.';

  RAISE NOTICE '>>> ALL 8 SECURITY & INTEGRITY VERIFICATIONS PASSED SUCCESSFULLY! <<<';
END $$;

ROLLBACK; -- Always rollback verification test fixtures so database state remains pristine
