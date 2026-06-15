-- Add base_price column to store a snapshot of the product's price at the time of quotation
ALTER TABLE public.quotations 
ADD COLUMN IF NOT EXISTS base_price NUMERIC(12,2) DEFAULT 0;
