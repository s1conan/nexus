-- ========================================================================================
-- AUTO-DEPOSIT ON DELIVERY ORDER SAVE
-- ========================================================================================
-- Instructions:
-- Run this SQL script in your Supabase SQL Editor.
--
-- Purpose:
-- Delivery Orders may be saved for a supplier whose active stock (from accepted deposits)
-- cannot cover the full DO quantity. Instead of blocking the save, this function creates
-- an 'Accepted' deposit automatically so the inventory ledger books the stock immediately.
--
-- Behavior:
-- - Called from the Delivery Order page AFTER the DO row is saved (insert or update).
-- - Checks the supplier's current active stock for the product (inventory_ledger, is_active).
-- - If stock already covers the DO quantity, nothing is created (idempotent on re-save).
-- - Otherwise inserts a deposit for the FULL DO quantity with:
--     price_per_liter = 0, total_amount = 0  (price is corrected later on the Deposits page)
--     status = 'Accepted'  -> existing trigger handle_deposit_inventory_v3() books the IN ledger row
--     note = 'Auto-created for DO [<do_number>]'
-- - Skipped by the caller when the DO status is 'Cancelled'.
--
-- Security:
-- - SECURITY DEFINER so users without deposit-insert permission (RLS) can still trigger it
--   from the DO page; the function only inserts a tightly-scoped deposit row.
-- - auth.uid() still resolves to the calling user (JWT), so created_by is recorded correctly.
-- ========================================================================================

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
