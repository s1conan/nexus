-- Update Quotations table to support delivery address
ALTER TABLE public.quotations 
ADD COLUMN IF NOT EXISTS delivery_address TEXT;
