-- Add content_hash column for QR-based cryptographic document verification
-- Stores SHA-256 hash of canonical document data at PDF generation time

-- Add content_hash to quotations table
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add content_hash to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS content_hash TEXT;
