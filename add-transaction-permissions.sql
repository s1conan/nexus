-- Update role_permissions for admin and boss to include the new transaction modules
UPDATE public.role_permissions
SET permissions = permissions || '{
  "deposit": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "quotation": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "purchase-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "delivery-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "invoice": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "payments": {"view": true, "insert": true, "edit": true, "delete": true, "print": true}
}'::jsonb
WHERE role IN ('admin', 'boss');

-- Also update existing profiles for admin and boss roles
UPDATE public.profiles
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{
  "deposit": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "quotation": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "purchase-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "delivery-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "invoice": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "payments": {"view": true, "insert": true, "edit": true, "delete": true, "print": true}
}'::jsonb
WHERE role IN ('admin', 'boss');
