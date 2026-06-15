-- Update 'boss' and 'admin' role permissions to have full access to all modules, including inventory.
-- This sets all permissions (view, insert, edit, delete, print) to true for all current system modules.

UPDATE public.role_permissions
SET permissions = '{
  "companies": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "products": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "vehicles": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "funders": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "quotation": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "purchase-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "delivery-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "deposit": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "invoice": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "payments": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "shipments": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "users": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "settings": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "inventory": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "component-test": {"view": true, "insert": true, "edit": true, "delete": true, "print": true}
}'::jsonb
WHERE role IN ('admin', 'boss');

-- Also reset any specific profile-level overrides for users with 'admin' or 'boss' roles
-- to ensure they inherit the full permissions from the role.
UPDATE public.profiles
SET permissions = NULL
WHERE role IN ('admin', 'boss');
