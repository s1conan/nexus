-- Migration: Add 'Invoiced' to delivery_orders status check constraint
ALTER TABLE public.delivery_orders DROP CONSTRAINT IF EXISTS delivery_orders_status_check;
ALTER TABLE public.delivery_orders ADD CONSTRAINT delivery_orders_status_check CHECK (status IN ('Draft', 'Shipped', 'Delivered', 'Cancelled', 'Invoiced'));
