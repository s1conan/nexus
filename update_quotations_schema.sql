-- Update Quotations table to support delivery price
ALTER TABLE public.quotations 
ADD COLUMN IF NOT EXISTS delivery_price NUMERIC(15,2) DEFAULT 0;
