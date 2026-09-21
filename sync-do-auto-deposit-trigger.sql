-- ========================================================================================
-- DO <-> AUTO-DEPOSIT SYNC (trigger-based)
-- ========================================================================================
-- Instructions:
-- Run this SQL script in your Supabase SQL Editor (or via the Supabase MCP).
--
-- Purpose:
-- The auto-deposit created for a Delivery Order must mirror the DO through its whole
-- lifecycle. All logic lives in handle_do_inventory() (SECURITY DEFINER) so EVERY write
-- path is covered: the DO form (handleSave), the Shipped/Delivered/Cancelled status
-- buttons (updateStatus), DO deletion (confirmDelete), and any future API/import path.
--
-- Rules:
-- 1. DO INSERT (non-cancelled): if the supplier's active stock cannot cover the DO
--    quantity and no Accepted auto-deposit exists for this DO + pair, create one
--    (full DO quantity, price 0, numbered via generate_document_number).
-- 2. DO UPDATE, quantity changed: mirror the new quantity on the linked auto-deposit.
--    If the negative-stock guard blocks a reduction (stock already consumed), the
--    deposit is kept as-is and the DO save still succeeds.
-- 3. DO UPDATE, supplier/product changed: release the old pair's auto-deposit
--    (guard-protected), then the coverage check creates one for the new pair if needed.
-- 4. DO UPDATE to 'Cancelled': delete the auto-deposit (guard-protected — kept when its
--    stock was already consumed by deliveries).
-- 5. DO DELETE: delete the OUT ledger row (existing) and release the auto-deposit
--    (guard-protected).
-- 6. OUT booking (existing behavior, extended): booked when the DO enters
--    'Shipped'/'Delivered'/'Invoiced' (whichever comes first), re-booked when an
--    already-out DO's qty/supplier/product changes, removed on DO delete.
--
-- Notes:
-- - The negative-stock guard (handle_deposit_inventory_v3) is respected everywhere:
--   blocked deposit changes are skipped silently (subtransaction), never abort the DO write.
-- - Deposit numbering is generated inside the trigger, so sequence numbers are only
--   burned when a deposit is actually created.
-- - create_do_auto_deposit() is superseded by this trigger and can be dropped later;
--   it is left in place for rollback safety.
-- - Idempotent/safe to re-run (CREATE OR REPLACE).
-- ========================================================================================

-- ----------------------------------------------------------------------------------------
-- 0. Drop the zero-reset trigger (applied separately via MCP before this script's logic
--    could work correctly). reset_inventory_on_zero() deactivated ALL ledger rows for a
--    supplier+product whenever the balance crossed zero, which:
--    - blinded the negative-stock guard (it only sums is_active rows, so a consumed
--      deposit could be deleted once history was deactivated), and
--    - wiped the WAC basis in supplier_stock_summary after every zero crossing.
--    The ledger is now a permanent append-only history; all rows stay active.
-- ----------------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_inventory_reset ON public.inventory_ledger;

-- ----------------------------------------------------------------------------------------
-- 1. handle_do_inventory() with full auto-deposit sync
-- ----------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_do_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hpp NUMERIC;
  v_has_out BOOLEAN;
  v_new_is_out_status BOOLEAN;
  v_old_was_out_status BOOLEAN;
  v_dep RECORD;
  v_stock NUMERIC;
  v_deposit_number TEXT;
BEGIN
  -- ======================================================================
  -- DELETE: remove the OUT ledger entry and release the auto-deposit
  -- ======================================================================
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.inventory_ledger
    WHERE reference_type = 'Delivery Order' AND reference_id = OLD.id;

    FOR v_dep IN
      SELECT id FROM public.deposits
      WHERE auto_source_do_number = OLD.do_number
        AND company_id = OLD.supplier_id
        AND product_id = OLD.product_id
        AND status = 'Accepted'
    LOOP
      BEGIN
        DELETE FROM public.deposits WHERE id = v_dep.id;
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'DEPOSIT_NEGATIVE_STOCK%' THEN
          NULL; -- stock already consumed by other deliveries; keep the deposit
        ELSE
          RAISE;
        END IF;
      END;
    END LOOP;

    RETURN OLD;
  END IF;

  v_new_is_out_status := NEW.status IN ('Shipped', 'Delivered', 'Invoiced');
  v_old_was_out_status := OLD.status IN ('Shipped', 'Delivered', 'Invoiced');

  -- ======================================================================
  -- AUTO-DEPOSIT SYNC: the deposit mirrors the DO (create / qty / pair / cancel)
  -- ======================================================================
  IF NEW.status = 'Cancelled' AND OLD.status IS DISTINCT FROM 'Cancelled' THEN
    -- DO cancelled: release its auto-deposit (kept if stock already consumed)
    FOR v_dep IN
      SELECT id FROM public.deposits
      WHERE auto_source_do_number = NEW.do_number
        AND company_id = NEW.supplier_id
        AND product_id = NEW.product_id
        AND status = 'Accepted'
    LOOP
      BEGIN
        DELETE FROM public.deposits WHERE id = v_dep.id;
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'DEPOSIT_NEGATIVE_STOCK%' THEN
          NULL; -- consumed; keep the deposit
        ELSE
          RAISE;
        END IF;
      END;
    END LOOP;

  ELSIF NEW.status <> 'Cancelled' THEN
    -- Pair moved: release the old pair's auto-deposit
    IF OLD.id IS NOT NULL AND (
      OLD.supplier_id IS DISTINCT FROM NEW.supplier_id
      OR OLD.product_id IS DISTINCT FROM NEW.product_id
    ) THEN
      FOR v_dep IN
        SELECT id FROM public.deposits
        WHERE auto_source_do_number = NEW.do_number
          AND status = 'Accepted'
          AND (company_id = OLD.supplier_id OR product_id = OLD.product_id)
          AND NOT (company_id = NEW.supplier_id AND product_id = NEW.product_id)
      LOOP
        BEGIN
          DELETE FROM public.deposits WHERE id = v_dep.id;
        EXCEPTION WHEN raise_exception THEN
          IF SQLERRM LIKE 'DEPOSIT_NEGATIVE_STOCK%' THEN
            NULL; -- consumed; keep the deposit
          ELSE
            RAISE;
          END IF;
        END;
      END LOOP;
    END IF;

    -- Quantity edited: mirror the change on the linked auto-deposit
    IF OLD.id IS NOT NULL
       AND OLD.quantity IS DISTINCT FROM NEW.quantity
       AND NEW.quantity > 0 THEN
      FOR v_dep IN
        SELECT id FROM public.deposits
        WHERE auto_source_do_number = NEW.do_number
          AND company_id = NEW.supplier_id
          AND product_id = NEW.product_id
          AND status = 'Accepted'
          AND qty_liter IS DISTINCT FROM NEW.quantity
      LOOP
        BEGIN
          UPDATE public.deposits SET qty_liter = NEW.quantity WHERE id = v_dep.id;
        EXCEPTION WHEN raise_exception THEN
          IF SQLERRM LIKE 'DEPOSIT_NEGATIVE_STOCK%' THEN
            NULL; -- reduction blocked (stock consumed); keep current quantity
          ELSE
            RAISE;
          END IF;
        END;
      END LOOP;
    END IF;

    -- Coverage: DO (new, re-activated, or pair-moved) without a covering auto-deposit.
    -- Creates one only when the supplier's active stock cannot cover the DO quantity.
    IF NEW.quantity > 0 AND NOT EXISTS (
      SELECT 1 FROM public.deposits
      WHERE auto_source_do_number = NEW.do_number
        AND company_id = NEW.supplier_id
        AND product_id = NEW.product_id
        AND status = 'Accepted'
    ) THEN
      SELECT COALESCE(SUM(
        CASE WHEN transaction_type = 'IN' THEN quantity ELSE -quantity END
      ), 0)
      INTO v_stock
      FROM public.inventory_ledger
      WHERE supplier_id = NEW.supplier_id
        AND product_id = NEW.product_id
        AND is_active = true;

      IF v_stock < NEW.quantity THEN
        v_deposit_number := public.generate_document_number('deposit', NEW.supplier_id);

        INSERT INTO public.deposits (
          deposit_number, company_id, product_id, deposit_date,
          qty_liter, price_per_liter, total_amount,
          payment_method, payment_bank_account, status,
          note, is_note_enabled, tax_details,
          auto_source_do_number, created_by
        ) VALUES (
          v_deposit_number, NEW.supplier_id, NEW.product_id, COALESCE(NEW.do_date, CURRENT_DATE),
          NEW.quantity, 0, 0,
          'Transfer', NULL, 'Accepted',
          'Auto-created for DO [' || COALESCE(NEW.do_number, '') || ']',
          true, '[]'::jsonb,
          NEW.do_number, NEW.created_by
        );
      END IF;
    END IF;
  END IF;

  -- ======================================================================
  -- OUT LEDGER BOOKING
  -- ======================================================================
  -- Does an OUT entry already exist for this DO?
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_ledger
    WHERE reference_type = 'Delivery Order' AND reference_id = NEW.id
  )
  INTO v_has_out;

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
$$;
