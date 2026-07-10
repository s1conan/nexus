-- ========================================================================================
-- PROTECT DEPOSIT INVENTORY: Prevent delete/un-accept when inventory is already used
-- ========================================================================================
-- Instructions:
-- Run this SQL script in your Supabase SQL Editor.
-- This creates a BEFORE trigger that blocks deleting or un-accepting a deposit
-- if any outbound (OUT) inventory ledger entries exist for the same supplier + product.
-- This fires BEFORE the existing handle_deposit_inventory_v3() AFTER trigger,
-- preventing the ledger cleanup from ever running when it would cause negative stock.

CREATE OR REPLACE FUNCTION public.protect_deposit_inventory()
RETURNS trigger AS $$
DECLARE
  v_out_qty NUMERIC := 0;
BEGIN
  -- Only guard when an 'Accepted' deposit is being modified or deleted
  IF (TG_OP = 'DELETE' AND OLD.status = 'Accepted') 
     OR (TG_OP = 'UPDATE' AND OLD.status = 'Accepted' AND NEW.status != 'Accepted') THEN

    -- Check: does an IN ledger entry exist for this specific deposit?
    -- (If no ledger entry exists, there's nothing to protect)
    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_ledger
      WHERE reference_type = 'Deposit' AND reference_id = OLD.id
    ) THEN
      -- No ledger entry for this deposit, safe to proceed
      IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- Check: are there any OUT transactions for this supplier + product?
    SELECT COALESCE(SUM(quantity), 0) INTO v_out_qty
    FROM public.inventory_ledger
    WHERE supplier_id = OLD.company_id
      AND product_id = OLD.product_id
      AND transaction_type = 'OUT';

    IF v_out_qty > 0 THEN
      RAISE EXCEPTION 'DEPOSIT_INVENTORY_IN_USE: Cannot modify deposit [%]. % L of inventory from this supplier/product has been used in delivery orders.',
        OLD.deposit_number, v_out_qty;
    END IF;
  END IF;

  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

-- Install the BEFORE trigger (fires before the existing AFTER trigger)
DROP TRIGGER IF EXISTS trigger_protect_deposit_inventory ON public.deposits;
CREATE TRIGGER trigger_protect_deposit_inventory
BEFORE UPDATE OR DELETE ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.protect_deposit_inventory();
