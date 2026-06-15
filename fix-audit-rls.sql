-- 1. Fix Audit Trigger Function (Security Definer is key here)
-- This allows the function to write to audit_logs even if the user doesn't have direct access.
CREATE OR REPLACE FUNCTION public.audit_trigger_func() 
RETURNS trigger 
SECURITY DEFINER -- Runs with privileges of the owner (postgres)
SET search_path = public, auth -- Security best practice for security definer
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

-- 2. Ensure audit_logs is writable
-- Even with security definer, we'll ensure RLS is handled.
-- If RLS is enabled, we need a policy or to rely entirely on Security Definer.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can insert logs" ON public.audit_logs;
CREATE POLICY "System can insert logs" ON public.audit_logs 
  FOR INSERT WITH CHECK (true); -- Trigger handles the data, policy allows the write

DROP POLICY IF EXISTS "Admins can view logs" ON public.audit_logs;
CREATE POLICY "Admins can view logs" ON public.audit_logs 
  FOR SELECT TO authenticated USING (true);
