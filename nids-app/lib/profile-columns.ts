// Columns of `public.profiles` that are safe to expose to the browser.
// `setup_token` and `setup_token_expires` are deliberately excluded: they are
// server-only credentials consumed by the auth API routes.
export const PROFILE_COLUMNS =
  "id, auth_id, username, email, full_name, phone, role, permissions, is_active, last_login, preferred_language, created_at"
