-- Transaction Pipeline: Deposits
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_number TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'Transfer',
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected')),
  
  -- Rich Text Fields with enable/disable toggle
  note TEXT,
  is_note_enabled BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Audit Trigger
DROP TRIGGER IF EXISTS audit_deposits_trigger ON public.deposits;
CREATE TRIGGER audit_deposits_trigger AFTER INSERT OR UPDATE OR DELETE ON public.deposits FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Enable RLS
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.deposits;
CREATE POLICY "Enable read access for authenticated users" ON public.deposits
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.deposits;
CREATE POLICY "Enable insert for authenticated users" ON public.deposits
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.deposits;
CREATE POLICY "Enable update for authenticated users" ON public.deposits
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.deposits;
CREATE POLICY "Enable delete for authenticated users" ON public.deposits
  FOR DELETE TO authenticated USING (true);

-- Seed Example Data
DO $$
DECLARE
  comp_id UUID;
BEGIN
  SELECT id INTO comp_id FROM public.companies LIMIT 1;

  IF comp_id IS NOT NULL THEN
    INSERT INTO public.deposits (deposit_number, company_id, deposit_date, amount, payment_method, status, note) 
    VALUES ('DEP/2026/001', comp_id, CURRENT_DATE, 5000000, 'Transfer', 'Accepted', '<p>Initial security deposit for fuel delivery.</p>')
    ON CONFLICT (deposit_number) DO NOTHING;
  END IF;
END $$;
