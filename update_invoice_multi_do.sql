-- Invoice: support multiple Delivery Orders and SO-direct invoicing.
--
-- Replaces the single do_id link with:
--   do_ids   UUID[]   — all linked Delivery Order ids (empty for SO-direct invoices)
--   quantity NUMERIC  — billed total quantity (Σ DO billed qty, or SO.quantity)
--   do_refs  JSONB    — ordered snapshot [{ do_id, do_number, quantity, received_quantity }]
--                       captured at save time for the PDF DO reference list + summary panel.
--
-- The single so_id column is retained and is now always set (both DO and SO modes).

ALTER TABLE public.invoices DROP COLUMN IF EXISTS do_id;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS do_ids UUID[] DEFAULT '{}';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS do_refs JSONB NOT NULL DEFAULT '[]'::jsonb;
