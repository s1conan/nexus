-- ========================================================================================
-- UPDATE DEPOSIT INVENTORY TRIGGER TO INCLUDE PBBKB IN UNIT COST (HPP)
-- ========================================================================================
-- Instructions: 
-- Please run this SQL script in your Supabase SQL Editor.
-- This will update the ledger trigger so that whenever a Deposit is marked as 'Accepted',
-- the system checks the dynamic 'tax_details', extracts the PBBKB rate, and capitalizes
-- it into the 'unit_cost' of the inventory ledger.

CREATE OR REPLACE FUNCTION public.handle_deposit_inventory_v3() 
RETURNS trigger AS $$
DECLARE
  v_pbbkb_rate NUMERIC := 0;
  v_unit_cost NUMERIC;
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

  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
