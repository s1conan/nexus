-- Migration: Add funders JSONB column to sales_orders
-- Stores funder assignments as array: [{funder_id, funder_name, amount}]

ALTER TABLE public.sales_orders
ADD COLUMN IF NOT EXISTS funders JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.sales_orders.funders IS 'JSONB array of funder assignments: [{funder_id, funder_name, amount}]';

-- RLS is already enabled on sales_orders, no policy changes needed
-- Audit trigger is already configured on sales_orders
