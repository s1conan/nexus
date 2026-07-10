-- Add received_quantity column to delivery_orders
-- Stores the actual quantity received by the customer on delivery.
-- Can differ from the shipped quantity (quantity column).
-- Nullable until status is changed to 'Delivered'.
ALTER TABLE public.delivery_orders
ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(12,2);
