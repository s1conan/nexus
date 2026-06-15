-- Add unique constraint to app_settings to prevent duplicate entries for category and name
ALTER TABLE public.app_settings
ADD CONSTRAINT app_settings_category_name_key UNIQUE (category, name);
