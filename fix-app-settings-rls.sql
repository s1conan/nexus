-- Fix for app_settings RLS policies to ensure system-wide accessibility
-- This ensures that even users without "settings" module access can read company info and tax parameters.

-- 1. Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 2. Allow all authenticated users to SELECT from app_settings
-- This is critical for retrieving company info, tax rates, and email settings.
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON public.app_settings;
CREATE POLICY "Allow read access to all authenticated users" 
ON public.app_settings FOR SELECT 
TO authenticated 
USING (true);

-- 3. Allow only admins/managers to modify app_settings
DROP POLICY IF EXISTS "Allow modify access to admins/managers only" ON public.app_settings;
CREATE POLICY "Allow modify access to admins/managers only" 
ON public.app_settings FOR ALL 
TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());
