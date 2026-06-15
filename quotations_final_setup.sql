-- 0. Ensure Audit Logic Exists
CREATE OR REPLACE FUNCTION public.audit_trigger_func() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), NULL, auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, NULL, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 1. Create Quotations Table
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  expiry_days INTEGER NOT NULL,
  minimum_order NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected')),
  
  -- Rich Text Fields with enable/disable toggle
  content TEXT,
  is_content_enabled BOOLEAN DEFAULT TRUE,
  
  note TEXT,
  is_note_enabled BOOLEAN DEFAULT TRUE,
  
  terms_conditions TEXT,
  is_terms_enabled BOOLEAN DEFAULT TRUE,
  
  closing_remarks TEXT,
  is_closing_enabled BOOLEAN DEFAULT TRUE,
  
  -- Array of discounts: JSONB array of {label: string, value: number, terms: string}
  discounts JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Add Audit Trigger
DROP TRIGGER IF EXISTS audit_quotations_trigger ON public.quotations;
CREATE TRIGGER audit_quotations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.quotations FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 3. Enable RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for Authenticated Users
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.quotations;
CREATE POLICY "Enable read access for authenticated users" ON public.quotations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.quotations;
CREATE POLICY "Enable insert for authenticated users" ON public.quotations
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.quotations;
CREATE POLICY "Enable update for authenticated users" ON public.quotations
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.quotations;
CREATE POLICY "Enable delete for authenticated users" ON public.quotations
  FOR DELETE TO authenticated USING (true);

-- 5. Seed Example Data
DO $$
DECLARE
  comp_id UUID;
  prod_id UUID;
BEGIN
  SELECT id INTO comp_id FROM public.companies LIMIT 1;
  SELECT id INTO prod_id FROM public.products LIMIT 1;

  IF comp_id IS NOT NULL AND prod_id IS NOT NULL THEN
    INSERT INTO public.quotations (
      quotation_number, 
      company_id, 
      product_id, 
      quotation_date, 
      expiry_date, 
      expiry_days, 
      minimum_order, 
      status, 
      content,
      discounts
    ) VALUES (
      'QTN/2026/001', 
      comp_id, 
      prod_id, 
      CURRENT_DATE, 
      CURRENT_DATE + INTERVAL '30 days', 
      30, 
      100, 
      'Draft', 
      '<p>Initial Quotation for Fuel Supply</p>',
      '[{"label": "Volume Discount", "value": 5, "terms": "For orders above 1000 units"}]'::jsonb
    ) ON CONFLICT (quotation_number) DO NOTHING;

    INSERT INTO public.quotations (
      quotation_number, 
      company_id, 
      product_id, 
      quotation_date, 
      expiry_date, 
      expiry_days, 
      minimum_order, 
      status, 
      content
    ) VALUES (
      'QTN/2026/002', 
      comp_id, 
      prod_id, 
      CURRENT_DATE, 
      CURRENT_DATE + INTERVAL '14 days', 
      14, 
      50, 
      'Sent', 
      '<p>Revised Pricing for Lubricants</p>'
    ) ON CONFLICT (quotation_number) DO NOTHING;
  END IF;
END $$;
