-- Add "In Price" shrinkage toggle columns
-- When enabled, the shrinkage tolerance percentage is deducted from the base price
-- and shown as a separate row in the quotation / sales order PDF.
ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS shrinkage_in_price BOOLEAN DEFAULT false;

ALTER TABLE public.sales_orders
ADD COLUMN IF NOT EXISTS shrinkage_in_price BOOLEAN DEFAULT false;