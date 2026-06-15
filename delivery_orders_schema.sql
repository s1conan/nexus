-- Transaction Pipeline: Delivery Orders
CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  do_number TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  do_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shipment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  driver_name TEXT,
  vehicle_number TEXT,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Shipped', 'Delivered', 'Cancelled')),
  
  -- Rich Text Fields with enable/disable toggle
  note TEXT,
  is_note_enabled BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.delivery_orders;
CREATE POLICY "Enable all for authenticated users" ON public.delivery_orders FOR ALL TO authenticated USING (true);

-- Audit Trigger
DROP TRIGGER IF EXISTS audit_delivery_orders_trigger ON public.delivery_orders;
CREATE TRIGGER audit_delivery_orders_trigger AFTER INSERT OR UPDATE OR DELETE ON public.delivery_orders FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Seed Example Data
DO $$
DECLARE
  comp_id UUID;
  prod_id UUID;
BEGIN
  SELECT id INTO comp_id FROM public.companies LIMIT 1;
  SELECT id INTO prod_id FROM public.products LIMIT 1;

  IF comp_id IS NOT NULL AND prod_id IS NOT NULL THEN
    INSERT INTO public.delivery_orders (do_number, company_id, product_id, do_date, shipment_date, quantity, driver_name, vehicle_number, status, note) 
    VALUES ('DO/2026/001', comp_id, prod_id, CURRENT_DATE, CURRENT_DATE, 500, 'Budi Santoso', 'B 1234 XYZ', 'Shipped', '<p>Urgent delivery for site A.</p>')
    ON CONFLICT (do_number) DO NOTHING;
  END IF;
END $$;
