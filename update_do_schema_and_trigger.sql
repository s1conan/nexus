ALTER TABLE public.delivery_orders DROP COLUMN IF EXISTS driver_name;
ALTER TABLE public.delivery_orders DROP COLUMN IF EXISTS driver_phone;
ALTER TABLE public.delivery_orders ADD COLUMN IF NOT EXISTS driver_info JSONB DEFAULT '{}'::jsonb;
