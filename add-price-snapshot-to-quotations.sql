-- Add Base Price Snapshot to Quotations
ALTER TABLE public.quotations 
ADD COLUMN IF NOT EXISTS base_price NUMERIC(12,2) DEFAULT 0;
