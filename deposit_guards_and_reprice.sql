-- ========================================================================================
-- DEPOSIT GUARDS & REPRICE
-- ========================================================================================
-- Instructions:
-- Run this SQL script in your Supabase SQL Editor.
--
-- Purpose (4 parts):
-- 1. reprice_delivery_out(): re-costs all OUT ledger rows (Delivery Order) for a
--    supplier+product to the current weighted-average cost. Called whenever a deposit's
--    cost contribution changes, so COGS / Profit & Loss stay correct after a deposit
--    price correction. Only unit_cost is touched — created_at is preserved so the
--    correction stays in the delivery's original reporting period.
--
-- 2. handle_deposit_inventory_v3() updated:
--    a. NEGATIVE-STOCK GUARD — blocks deposit changes that would drive the
--       supplier+product balance negative (qty reduction below consumed stock,
--       un-accepting or deleting a used deposit). Computed BEFORE any ledger
--       mutation; excluding the deposit's own IN row keeps the math correct even
--       when rows were deactivated by reset_inventory_on_zero(). Only blocks
--       changes that REDUCE the balance, so edits fixing an already-negative
--       anomaly remain possible. RAISE EXCEPTION rolls back deposit + ledger atomically.
--    b. RE-PRICE — after the existing IN delete/re-book, reprice OUT rows for the
--       affected pair(s), gated to cost-affecting changes (status / qty_liter /
--       price_per_liter / tax_details / company / product).
--
-- 3. deposits.auto_source_do_number + create_do_auto_deposit() updated:
--    tags auto-created deposits with their source DO number and skips creation when
--    an Accepted auto-deposit already exists for the same DO + product. Prevents
--    duplicate deposits (stock inflation) when re-saving an already-Shipped DO.
--
-- 4. handle_do_inventory() updated:
--    when an already-Shipped DO has its quantity / supplier / product edited, the
--    OUT ledger row is deleted and re-booked with the current weighted-average cost
--    (previously the OUT row went stale — same snapshot bug class as the reprice).
-- ========================================================================================

-- ----------------------------------------------------------------------------------------
-- 1. Re-price helper
-- ----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reprice_delivery_out(
  p_supplier_id uuid,
  p_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_wac NUMERIC;
BEGIN
  IF p_supplier_id IS NULL OR p_product_id IS NULL THEN
    RETURN;
  END IF;

  SELECT weighted_average_cost
  INTO v_wac
  FROM public.supplier_stock_summary
  WHERE supplier_id = p_supplier_id
    AND product_id = p_product_id;

  UPDATE public.inventory_ledger
  SET unit_cost = COALESCE(v_wac, 0)
  WHERE supplier_id = p_supplier_id
    AND product_id = p_product_id
    AND transaction_type = 'OUT'
    AND reference_type = 'Delivery Order';
END;
$$;

-- ----------------------------------------------------------------------------------------
-- 2. Deposit inventory trigger: negative-stock guard + reprice
-- ----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_deposit_inventory_v3()
RETURNS trigger AS $$
DECLARE
  v_pbbkb_rate NUMERIC := 0;
  v_unit_cost NUMERIC;
  v_balance_excl NUMERIC;
  v_old_in_qty NUMERIC;
  v_new_in_qty NUMERIC;
BEGIN
  -- ======================================================================
  -- GUARD: block changes that would drive the balance negative.
  -- ======================================================================
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
    IF OLD.status = 'Accepted' AND OLD.product_id IS NOT NULL THEN
      -- Active balance for the OLD pair, excluding this deposit's own IN row
      SELECT COALESCE(SUM(
        CASE WHEN transaction_type = 'IN' THEN quantity ELSE -quantity END
      ), 0)
      INTO v_balance_excl
      FROM public.inventory_ledger
      WHERE supplier_id = OLD.company_id
        AND product_id = OLD.product_id
        AND is_active = true
        AND NOT (reference_type = 'Deposit' AND reference_id = OLD.id);

      -- This deposit's current active IN contribution (0 if none/inactive)
      SELECT COALESCE(SUM(quantity), 0)
      INTO v_old_in_qty
      FROM public.inventory_ledger
      WHERE reference_type = 'Deposit' AND reference_id = OLD.id
        AND transaction_type = 'IN'
        AND is_active = true;

      -- What this deposit will contribute after the change
      IF TG_OP = 'DELETE'
         OR NEW.company_id IS DISTINCT FROM OLD.company_id
         OR NEW.product_id IS DISTINCT FROM OLD.product_id
         OR NEW.status IS DISTINCT FROM 'Accepted' THEN
        v_new_in_qty := 0;
      ELSE
        v_new_in_qty := COALESCE(NEW.qty_liter, 0);
      END IF;

      -- Block only when the change would create/increase a negative balance
      IF (v_balance_excl + v_new_in_qty) < 0 AND v_new_in_qty < v_old_in_qty THEN
        RAISE EXCEPTION 'DEPOSIT_NEGATIVE_STOCK: Cannot change deposit [%]. Delivery orders have already consumed inventory from this supplier/product; this change would drive the stock balance negative.',
          OLD.deposit_number;
        RETURN NULL;
      END IF;
    END IF;
  END IF;

  -- ======================================================================
  -- CLEAN UP: If it WAS 'Accepted', remove the old ledger entry.
  -- ======================================================================
  IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.status = 'Accepted')) THEN
    DELETE FROM public.inventory_ledger
    WHERE reference_type = 'Deposit' AND reference_id = OLD.id;
  END IF;

  -- ======================================================================
  -- ADD: If the current status IS 'Accepted', add the data to the ledger.
  -- ======================================================================
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF (NEW.status = 'Accepted') THEN
      IF NEW.product_id IS NOT NULL AND NEW.qty_liter > 0 THEN

        -- Extract PBBKB rate dynamically if it's enabled
        IF NEW.tax_details IS NOT NULL AND jsonb_typeof(NEW.tax_details) = 'array' THEN
          SELECT COALESCE(
            (SELECT (elem->>'rate')::NUMERIC
             FROM jsonb_array_elements(NEW.tax_details) elem
             WHERE (elem->>'name') = 'PBBKB' AND (elem->>'enabled')::BOOLEAN = true
             LIMIT 1
            ), 0) INTO v_pbbkb_rate;
        END IF;

        -- Capitalize PBBKB into the unit cost
        v_unit_cost := NEW.price_per_liter * (1 + (v_pbbkb_rate / 100));

        INSERT INTO public.inventory_ledger (
          supplier_id,
          product_id,
          transaction_type,
          quantity,
          unit_cost,
          reference_type,
          reference_id,
          created_by
        )
        VALUES (
          NEW.company_id,
          NEW.product_id,
          'IN',
          NEW.qty_liter,
          v_unit_cost,
          'Deposit',
          NEW.id,
          NEW.created_by
        );
      END IF;
    END IF;
  END IF;

  -- ======================================================================
  -- RE-PRICE: keep OUT cost snapshots in sync with the (possibly changed)
  -- IN costs. Gated to cost-affecting changes to avoid pointless writes.
  -- ======================================================================
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'Accepted' THEN
      PERFORM public.reprice_delivery_out(OLD.company_id, OLD.product_id);
    END IF;
  ELSE
    IF NEW.status = 'Accepted' OR (TG_OP = 'UPDATE' AND OLD.status = 'Accepted') THEN
      IF TG_OP = 'INSERT'
         OR OLD.status IS DISTINCT FROM NEW.status
         OR OLD.qty_liter IS DISTINCT FROM NEW.qty_liter
         OR OLD.price_per_liter IS DISTINCT FROM NEW.price_per_liter
         OR OLD.tax_details IS DISTINCT FROM NEW.tax_details
         OR OLD.company_id IS DISTINCT FROM NEW.company_id
         OR OLD.product_id IS DISTINCT FROM NEW.product_id THEN
        PERFORM public.reprice_delivery_out(NEW.company_id, NEW.product_id);
        IF TG_OP = 'UPDATE'
           AND (OLD.company_id IS DISTINCT FROM NEW.company_id
                OR OLD.product_id IS DISTINCT FROM NEW.product_id) THEN
          PERFORM public.reprice_delivery_out(OLD.company_id, OLD.product_id);
        END IF;
      END IF;
    END IF;
  END IF;

  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================================================================
-- 3. Auto-deposit: tag with source DO + duplicate guard
-- ========================================================================================
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS auto_source_do_number TEXT;

CREATE OR REPLACE FUNCTION public.create_do_auto_deposit(
  p_supplier_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_deposit_number text,   -- generated client-side via generate_document_number; may be NULL
  p_do_number text,
  p_do_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock NUMERIC := 0;
  v_deposit_number TEXT;
  v_deposit_date DATE;
  v_deposit_id uuid;
BEGIN
  IF p_supplier_id IS NULL OR p_product_id IS NULL
     OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('created', false, 'reason', 'invalid_params');
  END IF;

  -- Skip when an auto-deposit already exists for this DO + product
  -- (prevents duplicates when re-saving an already-Shipped DO)
  IF p_do_number IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.deposits
    WHERE auto_source_do_number = p_do_number
      AND product_id = p_product_id
      AND status = 'Accepted'
  ) THEN
    RETURN jsonb_build_object('created', false, 'reason', 'already_auto_created');
  END IF;

  -- Current active balance for this supplier + product
  SELECT COALESCE(SUM(
    CASE WHEN transaction_type = 'IN' THEN quantity ELSE -quantity END
  ), 0)
  INTO v_current_stock
  FROM public.inventory_ledger
  WHERE supplier_id = p_supplier_id
    AND product_id = p_product_id
    AND is_active = true;

  -- Stock already covers the DO quantity: nothing to do (safe to call on every save)
  IF v_current_stock >= p_quantity THEN
    RETURN jsonb_build_object('created', false, 'reason', 'sufficient_stock');
  END IF;

  v_deposit_date := COALESCE(p_do_date, CURRENT_DATE);

  v_deposit_number := COALESCE(
    NULLIF(p_deposit_number, ''),
    'DO-' || COALESCE(NULLIF(p_do_number, ''), to_char(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS'))
  );

  INSERT INTO public.deposits (
    deposit_number,
    company_id,
    product_id,
    deposit_date,
    qty_liter,
    price_per_liter,
    total_amount,
    payment_method,
    payment_bank_account,
    status,
    note,
    is_note_enabled,
    tax_details,
    auto_source_do_number,
    created_by
  ) VALUES (
    v_deposit_number,
    p_supplier_id,
    p_product_id,
    v_deposit_date,
    p_quantity,
    0,
    0,
    'Transfer',
    NULL,
    'Accepted',
    'Auto-created for DO [' || COALESCE(p_do_number, '') || ']',
    true,
    '[]'::jsonb,
    p_do_number,
    auth.uid()
  )
  RETURNING id INTO v_deposit_id;

  RETURN jsonb_build_object(
    'created', true,
    'deposit_id', v_deposit_id,
    'deposit_number', v_deposit_number,
    'quantity', p_quantity
  );
END;
$$;

-- Only authenticated users may execute it; keep it out of reach for anon
REVOKE ALL ON FUNCTION public.create_do_auto_deposit(uuid, uuid, numeric, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_do_auto_deposit(uuid, uuid, numeric, text, text, date) TO authenticated;

-- ========================================================================================
-- 4. DO inventory trigger: re-book OUT when an already-Shipped DO is edited
-- ========================================================================================
CREATE OR REPLACE FUNCTION public.handle_do_inventory()
RETURNS trigger AS $$
DECLARE
  v_hpp NUMERIC;
  v_has_out BOOLEAN;
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

  -- Transition into 'Shipped': book OUT with the current weighted-average cost
  IF NEW.status = 'Shipped' AND (OLD.status IS NULL OR OLD.status != 'Shipped') THEN
    SELECT weighted_average_cost INTO v_hpp
    FROM public.supplier_stock_summary
    WHERE supplier_id = NEW.supplier_id AND product_id = NEW.product_id;

    INSERT INTO public.inventory_ledger (supplier_id, product_id, transaction_type, quantity, unit_cost, reference_type, reference_id, created_by)
    VALUES (NEW.supplier_id, NEW.product_id, 'OUT', NEW.quantity, COALESCE(v_hpp, 0), 'Delivery Order', NEW.id, NEW.created_by);

  -- Already-Shipped DO edited (qty / supplier / product changed):
  -- re-book the OUT row so COGS stays in sync
  ELSIF v_has_out AND (
    OLD.quantity IS DISTINCT FROM NEW.quantity
    OR OLD.supplier_id IS DISTINCT FROM NEW.supplier_id
    OR OLD.product_id IS DISTINCT FROM NEW.product_id
  ) THEN
    DELETE FROM public.inventory_ledger
    WHERE reference_type = 'Delivery Order' AND reference_id = NEW.id;

    SELECT weighted_average_cost INTO v_hpp
    FROM public.supplier_stock_summary
    WHERE supplier_id = NEW.supplier_id AND product_id = NEW.product_id;

    INSERT INTO public.inventory_ledger (supplier_id, product_id, transaction_type, quantity, unit_cost, reference_type, reference_id, created_by)
    VALUES (NEW.supplier_id, NEW.product_id, 'OUT', NEW.quantity, COALESCE(v_hpp, 0), 'Delivery Order', NEW.id, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;