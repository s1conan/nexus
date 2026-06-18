-- ==========================================
-- PHASE 1: INVENTORY & MULTI-TAX MIGRATION
-- ==========================================

-- 1. Ledger Performance & Accuracy Update
ALTER TABLE public.inventory_ledger ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Add Dynamic Tax Storage to all relevant tables
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS tax_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS tax_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS tax_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_details JSONB DEFAULT '[]'::jsonb;

-- 3. Update Summary View to respect the 'is_active' status
CREATE OR REPLACE VIEW public.supplier_stock_summary AS
WITH active_stock AS (
  SELECT 
    supplier_id,
    product_id,
    SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE -quantity END) as current_stock,
    SUM(CASE WHEN transaction_type = 'IN' THEN quantity * unit_cost ELSE 0 END) as total_in_value,
    SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE 0 END) as total_in_qty
  FROM public.inventory_ledger
  WHERE is_active = true
  GROUP BY supplier_id, product_id
)
SELECT 
  s.supplier_id,
  s.product_id,
  s.current_stock,
  CASE 
    WHEN s.total_in_qty > 0 THEN s.total_in_value / s.total_in_qty 
    ELSE 0 
  END as weighted_average_cost,
  (s.current_stock * (CASE WHEN s.total_in_qty > 0 THEN s.total_in_value / s.total_in_qty ELSE 0 END)) as total_inventory_value
FROM active_stock s;

-- 4. Create 'Zero-Reset' Logic (Removes price baggage when stock is empty)
CREATE OR REPLACE FUNCTION public.reset_inventory_on_zero() 
RETURNS trigger AS $$
DECLARE
  v_current_balance NUMERIC;
BEGIN
  -- Calculate current balance for this specific item at this specific warehouse
  SELECT SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE -quantity END)
  INTO v_current_balance
  FROM public.inventory_ledger
  WHERE supplier_id = NEW.supplier_id 
    AND product_id = NEW.product_id
    AND is_active = true;

  -- If balance is 0 or less, deactivate all current active rows for this item/warehouse
  IF v_current_balance <= 0.01 THEN
    UPDATE public.inventory_ledger 
    SET is_active = false 
    WHERE supplier_id = NEW.supplier_id 
      AND product_id = NEW.product_id 
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Apply the Reset Trigger
DROP TRIGGER IF EXISTS trigger_inventory_reset ON public.inventory_ledger;
CREATE TRIGGER trigger_inventory_reset
AFTER INSERT ON public.inventory_ledger
FOR EACH ROW EXECUTE FUNCTION public.reset_inventory_on_zero();

-- 6. Robust Inventory Trigger for Deposits (v3)
-- Handles Status Changes, Deletions, and Value Edits
CREATE OR REPLACE FUNCTION public.handle_deposit_inventory_v3() 
RETURNS trigger AS $$
BEGIN
  -- CLEAN UP: If it WAS 'Accepted', remove the old ledger entry.
  IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.status = 'Accepted')) THEN
    DELETE FROM public.inventory_ledger 
    WHERE reference_type = 'Deposit' AND reference_id = OLD.id;
  END IF;

  -- ADD: If the current status IS 'Accepted', add the data to the ledger.
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF (NEW.status = 'Accepted') THEN
      IF NEW.product_id IS NOT NULL AND NEW.qty_liter > 0 THEN
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
          NEW.price_per_liter, 
          'Deposit', 
          NEW.id, 
          NEW.created_by
        );
      END IF;
    END IF;
  END IF;

  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deposit_inventory ON public.deposits;
CREATE TRIGGER trigger_deposit_inventory 
AFTER INSERT OR UPDATE OR DELETE ON public.deposits 
FOR EACH ROW EXECUTE FUNCTION handle_deposit_inventory_v3();

-- 7. Initialize default tax parameters in app_settings
INSERT INTO public.app_settings (category, name, value, description)
VALUES 
  ('tax', 'PPN', '11'::jsonb, 'Pajak Pertambahan Nilai (VAT)'),
  ('tax', 'PBBKB', '5'::jsonb, 'Pajak Bahan Bakar Kendaraan Bermotor'),
  ('tax', 'PPh 22', '0.3'::jsonb, 'Pajak Penghasilan Pasal 22')
ON CONFLICT ON CONSTRAINT app_settings_category_name_key 
DO UPDATE SET value = EXCLUDED.value;
