-- Transaction Pipeline: Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
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
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.purchase_orders;
CREATE POLICY "Enable all for authenticated users" ON public.purchase_orders FOR ALL TO authenticated USING (true);

-- Audit Trigger
DROP TRIGGER IF EXISTS audit_purchase_orders_trigger ON public.purchase_orders;
CREATE TRIGGER audit_purchase_orders_trigger AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Seed Example Data
DO $$
DECLARE
  comp_id UUID;
  prod_id UUID;
BEGIN
  SELECT id INTO comp_id FROM public.companies LIMIT 1;
  SELECT id INTO prod_id FROM public.products LIMIT 1;

  IF comp_id IS NOT NULL AND prod_id IS NOT NULL THEN
    INSERT INTO public.purchase_orders (po_number, company_id, product_id, po_date, delivery_date, quantity, unit_price, status, note) 
    VALUES ('PO/2026/001', comp_id, prod_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 1000, 15000, 'Approved', '<p>Initial PO for Q3 fuel supply.</p>')
    ON CONFLICT (po_number) DO NOTHING;
  END IF;
END $$;
