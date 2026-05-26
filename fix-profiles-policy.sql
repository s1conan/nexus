-- Correcting Profile RLS Policies to use auth_id instead of id
-- This fix ensures that users can update their own preferences (like language)
-- even if their internal profile ID doesn't match their Auth UID.

-- 1. Drop old policies
DROP POLICY IF EXISTS "Profile Access Self" ON public.profiles;
DROP POLICY IF EXISTS "Profile Update Self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

-- 2. Re-create Access Policy (Self) using auth_id
CREATE POLICY "Profile Access Self" 
ON public.profiles FOR SELECT 
TO authenticated
USING (auth.uid() = auth_id);

-- 3. Re-create Update Policy (Self) using auth_id
-- We allow users to update their own preferred_language, phone, etc.
CREATE POLICY "Profile Update Self" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- 4. Ensure is_admin is also using auth_id
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
    AND role IN ('admin', 'boss')
  );
END;
$$;
