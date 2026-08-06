-- Add delivery_taxable column to quotations, sales_orders, and invoices
-- This flag determines whether delivery fee is included in PPN (VAT) tax calculation
-- Default is false (delivery NOT included in tax) for backward compatibility

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS delivery_taxable BOOLEAN DEFAULT false;

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS delivery_taxable BOOLEAN DEFAULT false;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS delivery_taxable BOOLEAN DEFAULT false;
