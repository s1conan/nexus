-- Add sales-order setting and remove purchase-order
UPDATE public.app_settings 
SET name = 'sales-order', value = '"SO/{YYYY}/{SEQ:3}"', description = 'Format for Sales Order numbers'
WHERE category = 'numbering' AND name = 'purchase-order';

-- Also ensure 'sales-order' exists if it didn't
INSERT INTO public.app_settings (category, name, value, description)
VALUES ('numbering', 'sales-order', '"SO/{YYYY}/{SEQ:3}"', 'Format for Sales Order numbers')
ON CONFLICT (category, name) DO NOTHING;
