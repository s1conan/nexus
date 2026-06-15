ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS tax_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS tax_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS tax_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_details JSONB DEFAULT '[]'::jsonb;

INSERT INTO public.app_settings (category, name, value, description)
VALUES 
  ('tax', 'PPN', '11'::jsonb, 'Pajak Pertambahan Nilai'),
  ('tax', 'PBBKB', '5'::jsonb, 'Pajak Bahan Bakar Kendaraan Bermotor'),
  ('tax', 'PPh 22', '0.3'::jsonb, 'Pajak Penghasilan Pasal 22')
ON CONFLICT ON CONSTRAINT app_settings_category_name_key 
DO UPDATE SET value = EXCLUDED.value;
