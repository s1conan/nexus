-- Transaction Pipeline: Sales Orders
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_number TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  so_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected')),
  
  -- Rich Text Fields with enable/disable toggle
  note TEXT,
  is_note_enabled BOOLEAN DEFAULT TRUE,
  
  terms_conditions TEXT,
  is_terms_enabled BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.sales_orders;
CREATE POLICY "Enable all for authenticated users" ON public.sales_orders FOR ALL TO authenticated USING (true);

-- Audit Trigger
DROP TRIGGER IF EXISTS audit_sales_orders_trigger ON public.sales_orders;
CREATE TRIGGER audit_sales_orders_trigger AFTER INSERT OR UPDATE OR DELETE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Seed Example Data
DO $$
DECLARE
  comp_id UUID;
  prod_id UUID;
BEGIN
  SELECT id INTO comp_id FROM public.companies LIMIT 1;
  SELECT id INTO prod_id FROM public.products LIMIT 1;

  IF comp_id IS NOT NULL AND prod_id IS NOT NULL THEN
    INSERT INTO public.sales_orders (so_number, company_id, product_id, so_date, delivery_date, quantity, unit_price, status, note) 
    VALUES ('PO/2026/001', comp_id, prod_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 1000, 15000, 'Approved', '<p>Initial PO for Q3 fuel supply.</p>')
    ON CONFLICT (so_number) DO NOTHING;
  END IF;
END $$;
