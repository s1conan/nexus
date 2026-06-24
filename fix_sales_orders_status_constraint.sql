-- The do_status_update_trigger on delivery_orders uses 'Approved' (not 'Accepted').
-- The trigger sets SO status to 'Approved' when all DOs are deleted.
-- Revert constraint to correct status set (removed stale 'Accepted' workaround).
ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS sales_orders_status_check;
ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.sales_orders ADD CONSTRAINT sales_orders_status_check
  CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected', 'Partial', 'Fulfilled'));
