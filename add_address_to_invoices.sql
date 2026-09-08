-- Add the customer address (selected from the company's saved addresses)
-- to invoices. The chosen address is stored per invoice and displayed
-- on the invoice PDF header.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS address TEXT;
