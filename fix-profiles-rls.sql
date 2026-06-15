-- Update RLS policies for profiles to allow managers to also update user data
-- This fixes the issue where "Update succeeded but no rows were affected"

-- 1. Update is_admin function to include 'manager'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE auth_id = auth.uid() 
    AND role IN ('admin', 'boss', 'manager')
  );
END;
$$;

-- 2. Ensure policies use this function or explicitly include manager
DROP POLICY IF EXISTS "Profile Access Admin" ON public.profiles;
CREATE POLICY "Profile Access Admin" 
ON public.profiles FOR SELECT 
USING (public.is_admin());

DROP POLICY IF EXISTS "Profile Update Admin" ON public.profiles;
CREATE POLICY "Profile Update Admin" 
ON public.profiles FOR UPDATE 
USING (public.is_admin());

-- Also verify handles_new_user and other logic that might depend on role
