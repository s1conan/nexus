-- ========================================================================================
-- RENAME 'purchase-order' TO 'sales-order' IN PERMISSIONS AND SETTINGS
-- ========================================================================================
-- Instructions: 
-- Please run this SQL script in your Supabase SQL Editor.
-- This updates the permission keys in your database to match the new 'sales-order' module name
-- so that you and your users do not lose access to the page.

-- 1. Update the document numbering settings key
UPDATE public.app_settings
SET name = 'sales-order'
WHERE category = 'numbering' AND name = 'purchase-order';

-- 2. Migrate the JSON permissions for Roles
UPDATE public.role_permissions
SET permissions = permissions - 'purchase-order' || jsonb_build_object('sales-order', permissions->'purchase-order')
WHERE permissions ? 'purchase-order';

-- 3. Migrate the JSON permissions for specific Profiles (Customized User Permissions)
UPDATE public.profiles
SET permissions = permissions - 'purchase-order' || jsonb_build_object('sales-order', permissions->'purchase-order')
WHERE permissions ? 'purchase-order';
