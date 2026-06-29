-- Migration: Add delivered_date column to delivery_orders
-- This is used by invoices to calculate due dates based on
-- actual delivery completion date

ALTER TABLE public.delivery_orders
ADD COLUMN IF NOT EXISTS delivered_date DATE;
