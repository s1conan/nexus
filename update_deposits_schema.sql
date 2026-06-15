-- Update Deposits Schema for Stock Tracking and Detailed Pricing
ALTER TABLE public.deposits
RENAME COLUMN amount TO total_amount;

ALTER TABLE public.deposits
ADD COLUMN IF NOT EXISTS qty_liter NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_per_liter NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_qty_liter NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_bank_account JSONB;

-- Comment for clarity
COMMENT ON COLUMN public.deposits.remaining_qty_liter IS 'Remaining stock from this deposit in Liters. Reduced when DO is created.';

-- Ensure newly created deposits initialize remaining_qty_liter
CREATE OR REPLACE FUNCTION public.sync_deposit_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    NEW.remaining_qty_liter := NEW.qty_liter;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_deposit_stock_trigger ON public.deposits;
CREATE TRIGGER sync_deposit_stock_trigger
BEFORE INSERT ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.sync_deposit_stock();
