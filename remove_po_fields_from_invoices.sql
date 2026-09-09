-- Remove the customer PO reference columns from invoices. The PO number and
-- date are read from the linked Sales Order (via do_id -> delivery_orders.so_id,
-- or the invoice's own so_id) instead of being stored on the invoice row.
--
-- WARNING: document-hash verification hashes the full invoice row (`select *`
-- in /api/verify-document). For legacy invoices where po_number/po_date were
-- NOT NULL, dropping these columns changes the canonical shape and their QR
-- verification will report "Authenticity Not Confirmed". Check first:
--   SELECT count(*) FROM invoices WHERE po_number IS NOT NULL OR po_date IS NOT NULL;
ALTER TABLE public.invoices
  DROP COLUMN IF EXISTS po_number,
  DROP COLUMN IF EXISTS po_date;
