-- Add Advanced Quotation Fields
ALTER TABLE public.quotations 
ADD COLUMN IF NOT EXISTS shrinkage_tolerance NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bank_accounts JSONB DEFAULT '[]'::jsonb;
