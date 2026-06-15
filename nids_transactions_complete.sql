-- ==========================================
-- NIDS TRANSACTION SYSTEM INFRASTRUCTURE
-- ==========================================

-- 1. Ensure Audit Logs Table exists
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID, -- References auth.users(id) but kept flexible for setup
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure Audit Trigger Function exists
CREATE OR REPLACE FUNCTION public.audit_trigger_func() RETURNS trigger 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
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

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System can insert logs" ON public.audit_logs;
CREATE POLICY "System can insert logs" ON public.audit_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can view logs" ON public.audit_logs;
CREATE POLICY "Admins can view logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);


-- 3. Setup QUOTATIONS
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
  content TEXT,
  is_content_enabled BOOLEAN DEFAULT TRUE,
  note TEXT,
  is_note_enabled BOOLEAN DEFAULT TRUE,
  terms_conditions TEXT,
  is_terms_enabled BOOLEAN DEFAULT TRUE,
  closing_remarks TEXT,
  is_closing_enabled BOOLEAN DEFAULT TRUE,
  discounts JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.quotations;
CREATE POLICY "Allow all for authenticated users" ON public.quotations FOR ALL TO authenticated USING (true);

DROP TRIGGER IF EXISTS audit_quotations_trigger ON public.quotations;
CREATE TRIGGER audit_quotations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.quotations FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 4. Setup DEPOSITS
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_number TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'Transfer',
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected')),
  note TEXT,
  is_note_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.deposits;
CREATE POLICY "Allow all for authenticated users" ON public.deposits FOR ALL TO authenticated USING (true);

DROP TRIGGER IF EXISTS audit_deposits_trigger ON public.deposits;
CREATE TRIGGER audit_deposits_trigger AFTER INSERT OR UPDATE OR DELETE ON public.deposits FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 5. Seed Data
DO $$
DECLARE
  comp_id UUID;
  prod_id UUID;
BEGIN
  SELECT id INTO comp_id FROM public.companies LIMIT 1;
  SELECT id INTO prod_id FROM public.products LIMIT 1;

  IF comp_id IS NOT NULL THEN
    -- Quotation Seed
    IF prod_id IS NOT NULL THEN
      INSERT INTO public.quotations (quotation_number, company_id, product_id, quotation_date, expiry_date, expiry_days, minimum_order, status, content) 
      VALUES ('QTN/2026/001', comp_id, prod_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 30, 100, 'Draft', '<p>Initial Fuel Supply Quotation</p>')
      ON CONFLICT (quotation_number) DO NOTHING;
    END IF;

    -- Deposit Seed
    INSERT INTO public.deposits (deposit_number, company_id, amount, status, note) 
    VALUES ('DEP/2026/001', comp_id, 5000000, 'Accepted', '<p>Initial security deposit.</p>')
    ON CONFLICT (deposit_number) DO NOTHING;
  END IF;
END $$;
