-- Master Data: Funders (linked to POs)
CREATE TABLE IF NOT EXISTS public.funders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  id_number TEXT UNIQUE,
  phone TEXT,
  bank_accounts JSONB DEFAULT '[]'::jsonb, -- Array of {bank_name, account_number, account_holder}
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.funders ENABLE ROW LEVEL SECURITY;

-- Add basic policy
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.funders;
CREATE POLICY "Enable all for authenticated users" ON public.funders FOR ALL TO authenticated USING (true);

-- Audit Trigger
CREATE TRIGGER audit_funders_trigger AFTER INSERT OR UPDATE OR DELETE ON funders FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Update Role Permissions to include funders
UPDATE role_permissions 
SET permissions = jsonb_set(permissions, '{funders}', '{"view": true, "insert": true, "edit": true, "delete": true, "print": true}')
WHERE role = 'admin';

UPDATE role_permissions 
SET permissions = jsonb_set(permissions, '{funders}', '{"view": true, "insert": true, "edit": true, "delete": false, "print": true}')
WHERE role = 'manager';

UPDATE role_permissions 
SET permissions = jsonb_set(permissions, '{funders}', '{"view": true, "insert": true, "edit": false, "delete": false, "print": true}')
WHERE role = 'staff';
