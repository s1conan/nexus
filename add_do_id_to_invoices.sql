-- Add do_id column to invoices for linking to Delivery Orders
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS do_id UUID REFERENCES public.delivery_orders(id) ON DELETE SET NULL;
