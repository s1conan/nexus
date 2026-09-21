-- ========================================================================================
-- FIX: Delivery Orders never booked OUT rows on the inventory ledger
-- ========================================================================================
-- Instructions:
-- Run this SQL script in your Supabase SQL Editor (or via the Supabase MCP).
--
-- Root cause:
-- handle_do_inventory() only booked the OUT ledger row when a DO transitioned into
-- 'Shipped'. The real workflow goes Draft -> Delivered directly, so no OUT row was ever
-- booked. With no OUT consumption, create_do_auto_deposit() always saw "sufficient
-- stock" and skipped creating deposits, and COGS / Profit & Loss had no data.
--
-- Purpose (3 parts):
-- 1. handle_do_inventory() updated:
--    - Books the OUT row when a DO enters 'Shipped' OR 'Delivered' OR 'Invoiced'
--      (whichever transition happens first: INSERT with a non-Draft status, or
--      UPDATE Draft -> Delivered / Shipped / Invoiced).
--    - Keeps: DELETE cleanup, re-book on qty/supplier/product edit of an already-OUT DO.
--    - Re-activates the pair's ledger rows before booking OUT (the
--      reset_inventory_on_zero trigger deactivates all rows when balance hits 0,
--      which would otherwise leave the pair stuck with inactive history).
-- 2. create_do_auto_deposit() unchanged in behavior; already tagged with
--    auto_source_do_number and the duplicate guard.
-- 3. BACKFILL for existing delivered/invoiced DOs (per-DO style, ordered qty):
--    - One auto-deposit per Delivered/Invoiced DO that has no covering deposit yet
--      (price_per_liter = 0, to be corrected on the Deposits page).
--    - One OUT ledger row per Delivered/Invoiced DO at the pair's WAC (currently 0;
--      reprice_delivery_out() corrects these when deposit prices are fixed).
--    - Re-activates is_active on all rows for affected pairs (the zero-reset trigger
--      deactivates rows mid-backfill when the running balance hits 0).
--
-- Idempotency:
-- - Backfill deposits are guarded by auto_source_do_number + product + status.
-- - Backfill OUT rows are guarded by NOT EXISTS on reference_id.
-- - Running the script twice inserts nothing new.
-- ========================================================================================

-- ----------------------------------------------------------------------------------------
-- 1. Fixed DO inventory trigger
-- ----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_do_inventory()
RETURNS trigger AS $$
DECLARE
  v_hpp NUMERIC;
  v_has_out BOOLEAN;
  v_new_is_out_status BOOLEAN;
  v_old_was_out_status BOOLEAN;
BEGIN
  -- Handle DELETE: Remove the inventory ledger entry
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.inventory_ledger
    WHERE reference_type = 'Delivery Order' AND reference_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Does an OUT entry already exist for this DO?
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_ledger
    WHERE reference_type = 'Delivery Order' AND reference_id = NEW.id
  )
  INTO v_has_out;

  v_new_is_out_status := NEW.status IN ('Shipped', 'Delivered', 'Invoiced');
  v_old_was_out_status := OLD.status IN ('Shipped', 'Delivered', 'Invoiced');

  -- Transition into an inventory-consuming status ('Shipped'/'Delivered'/'Invoiced',
  -- whichever comes first): book OUT with the current weighted-average cost
  IF v_new_is_out_status AND (OLD.id IS NULL OR NOT v_old_was_out_status) THEN
    -- Re-activate the pair's ledger rows: the zero-reset trigger deactivates them
    -- when the balance hits 0, and WAC in supplier_stock_summary only sees active rows.
    UPDATE public.inventory_ledger
    SET is_active = true
    WHERE supplier_id = NEW.supplier_id
      AND product_id = NEW.product_id
      AND is_active = false;

    SELECT weighted_average_cost INTO v_hpp
    FROM public.supplier_stock_summary
    WHERE supplier_id = NEW.supplier_id AND product_id = NEW.product_id;

    INSERT INTO public.inventory_ledger (supplier_id, product_id, transaction_type, quantity, unit_cost, reference_type, reference_id, created_by)
    VALUES (NEW.supplier_id, NEW.product_id, 'OUT', NEW.quantity, COALESCE(v_hpp, 0), 'Delivery Order', NEW.id, NEW.created_by);

  -- Already-out DO edited (qty / supplier / product changed):
  -- re-book the OUT row so COGS stays in sync
  ELSIF v_has_out AND (
    OLD.quantity IS DISTINCT FROM NEW.quantity
    OR OLD.supplier_id IS DISTINCT FROM NEW.supplier_id
    OR OLD.product_id IS DISTINCT FROM NEW.product_id
  ) THEN
    DELETE FROM public.inventory_ledger
    WHERE reference_type = 'Delivery Order' AND reference_id = NEW.id;

    UPDATE public.inventory_ledger
    SET is_active = true
    WHERE supplier_id = NEW.supplier_id
      AND product_id = NEW.product_id
      AND is_active = false;

    SELECT weighted_average_cost INTO v_hpp
    FROM public.supplier_stock_summary
    WHERE supplier_id = NEW.supplier_id AND product_id = NEW.product_id;

    INSERT INTO public.inventory_ledger (supplier_id, product_id, transaction_type, quantity, unit_cost, reference_type, reference_id, created_by)
    VALUES (NEW.supplier_id, NEW.product_id, 'OUT', NEW.quantity, COALESCE(v_hpp, 0), 'Delivery Order', NEW.id, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------------------
-- 3. BACKFILL: per-DO deposits + OUT ledger rows for existing Delivered/Invoiced DOs
-- ----------------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_supplier uuid;
  v_product uuid;
  v_stock NUMERIC;
  v_wac NUMERIC;
  v_deposit_number TEXT;
  v_deposit_id uuid;
  v_seq INT;
BEGIN
  FOR r IN
    SELECT id, do_number, supplier_id, product_id, quantity, do_date, created_by, created_at
    FROM public.delivery_orders
    WHERE status IN ('Delivered', 'Invoiced')
    ORDER BY supplier_id, product_id, created_at
  LOOP
    v_supplier := r.supplier_id;
    v_product  := r.product_id;

    ------------------------------------------------------------------
    -- A. Per-DO auto deposit (skip if one already exists for this DO)
    ------------------------------------------------------------------
    IF NOT EXISTS (
      SELECT 1 FROM public.deposits
      WHERE auto_source_do_number = r.do_number
        AND product_id = r.product_id
        AND status = 'Accepted'
    ) THEN
      -- Number: DO-<do_number>, or a timestamp fallback if do_number is NULL
      v_deposit_number := 'DO-' || COALESCE(r.do_number, to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'));

      -- (Defensive) avoid colliding with an existing deposit number
      IF EXISTS (SELECT 1 FROM public.deposits WHERE deposit_number = v_deposit_number) THEN
        v_deposit_number := v_deposit_number || '-' || to_char(clock_timestamp(), 'HH24MISS');
      END IF;

      INSERT INTO public.deposits (
        deposit_number, company_id, product_id, deposit_date,
        qty_liter, price_per_liter, total_amount,
        payment_method, payment_bank_account, status,
        note, is_note_enabled, tax_details,
        auto_source_do_number, created_by
      ) VALUES (
        v_deposit_number, r.supplier_id, r.product_id, COALESCE(r.do_date, CURRENT_DATE),
        r.quantity, 0, 0,
        'Transfer', NULL, 'Accepted',
        'Auto-created for DO [' || COALESCE(r.do_number, '') || '] (backfill)',
        true, '[]'::jsonb,
        r.do_number, r.created_by
      )
      RETURNING id INTO v_deposit_id;

      RAISE NOTICE 'BACKFILL deposit % for DO % (%)', v_deposit_number, r.do_number, r.quantity;
    ELSE
      SELECT id INTO v_deposit_id FROM public.deposits
      WHERE auto_source_do_number = r.do_number
        AND product_id = r.product_id
        AND status = 'Accepted'
      LIMIT 1;
      RAISE NOTICE 'SKIP deposit (exists) for DO %', r.do_number;
    END IF;

    ------------------------------------------------------------------
    -- B. OUT ledger row (skip if one already exists for this DO)
    ------------------------------------------------------------------
    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_ledger
      WHERE reference_type = 'Delivery Order' AND reference_id = r.id
    ) THEN
      -- Re-activate the pair's rows first, then read the WAC
      UPDATE public.inventory_ledger
      SET is_active = true
      WHERE supplier_id = v_supplier AND product_id = v_product AND is_active = false;

      SELECT weighted_average_cost INTO v_wac
      FROM public.supplier_stock_summary
      WHERE supplier_id = v_supplier AND product_id = v_product;

      INSERT INTO public.inventory_ledger (
        supplier_id, product_id, transaction_type, quantity, unit_cost,
        reference_type, reference_id, created_by, created_at
      ) VALUES (
        v_supplier, v_product, 'OUT', r.quantity, COALESCE(v_wac, 0),
        'Delivery Order', r.id, r.created_by, r.created_at
      );

      RAISE NOTICE 'BACKFILL OUT % for DO %', r.quantity, r.do_number;
    ELSE
      RAISE NOTICE 'SKIP OUT (exists) for DO %', r.do_number;
    END IF;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------------------
-- Final consistency pass: re-activate any rows left inactive by the zero-reset trigger
-- (so WAC/stock summaries and reprice_delivery_out() see the full history)
-- ----------------------------------------------------------------------------------------
UPDATE public.inventory_ledger
SET is_active = true
WHERE is_active = false;
