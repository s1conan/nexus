-- Add new columns to delivery_orders
ALTER TABLE public.delivery_orders 
ADD COLUMN transporter_id UUID REFERENCES public.companies(id),
ADD COLUMN driver_phone TEXT,
ADD COLUMN delivery_address TEXT;
