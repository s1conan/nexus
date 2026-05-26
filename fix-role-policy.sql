-- Fix for role visibility in the User Management dropdown
-- The previous policy restricted users to only seeing their own role.

-- 1. Drop the restrictive policy
DROP POLICY IF EXISTS "Allow users to read only their own role permissions" ON "public"."role_permissions";

-- 2. Create a new policy that allows authorized roles to see the full list of roles
CREATE POLICY "Allow authorized users to view all roles"
ON "public"."role_permissions"
FOR SELECT
TO authenticated
USING (
  (SELECT profiles.role FROM profiles WHERE profiles.auth_id = auth.uid()) IN ('admin', 'manager', 'boss')
);

-- Alternatively, if you want all logged-in users to be able to see the list of roles (but not modify them):
-- CREATE POLICY "Allow all authenticated to see role names" ON "public"."role_permissions" FOR SELECT TO authenticated USING (true);
