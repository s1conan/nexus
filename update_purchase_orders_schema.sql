-- Update Purchase Orders table to support new fields
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS term_of_payment TEXT,
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS discount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_price_per_litre NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_tax_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 11; -- Default 11% for VAT in Indonesia
