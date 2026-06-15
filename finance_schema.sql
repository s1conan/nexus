-- Finance Module: Invoices & Payments Schema

-- Drop existing old tables if they exist (they referenced the old 'orders' table)
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;

-- 1. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL, -- Optional link to PO
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 11, -- Standard PPN
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Partial', 'Paid', 'Cancelled')),
  note TEXT,
  is_note_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON public.invoices FOR ALL TO authenticated USING (true);
CREATE TRIGGER audit_invoices_trigger AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 2. Create Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT UNIQUE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15,2) NOT NULL,
  payment_method TEXT NOT NULL, -- e.g., 'Bank Transfer', 'Cash'
  reference_number TEXT, -- e.g., Transfer Receipt Number
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Rejected')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON public.payments FOR ALL TO authenticated USING (true);
CREATE TRIGGER audit_payments_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 3. Automation: Update Invoice Paid Amount and Status upon Payment Verification
CREATE OR REPLACE FUNCTION public.handle_payment_verification() 
RETURNS trigger AS $$
DECLARE
  v_total_paid NUMERIC;
  v_invoice_total NUMERIC;
BEGIN
  -- We only update invoice totals when a payment becomes 'Verified' or is deleted/rejected after being 'Verified'
  IF (TG_OP = 'INSERT' AND NEW.status = 'Verified') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'Verified' AND OLD.status != 'Verified') OR
     (TG_OP = 'UPDATE' AND OLD.status = 'Verified' AND NEW.status != 'Verified') OR
     (TG_OP = 'DELETE' AND OLD.status = 'Verified') THEN
     
    -- Calculate total verified payments for the invoice
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.payments
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id) AND status = 'Verified';

    -- Get the total amount of the invoice
    SELECT total_amount INTO v_invoice_total
    FROM public.invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

    -- Update the invoice
    UPDATE public.invoices
    SET 
      paid_amount = v_total_paid,
      status = CASE 
                 WHEN v_total_paid >= v_invoice_total THEN 'Paid'
                 WHEN v_total_paid > 0 THEN 'Partial'
                 ELSE 'Sent' -- Assuming if it had payments it was at least sent
               END
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id) AND status != 'Cancelled';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on payments table
DROP TRIGGER IF EXISTS trigger_payment_verification ON public.payments;
CREATE TRIGGER trigger_payment_verification 
AFTER INSERT OR UPDATE OR DELETE ON public.payments 
FOR EACH ROW EXECUTE FUNCTION handle_payment_verification();
