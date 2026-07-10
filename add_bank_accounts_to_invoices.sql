-- Migration to add bank_accounts and details columns to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS bank_accounts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
