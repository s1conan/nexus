-- 1. Fix the sales_orders status check constraint to allow new statuses
ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.sales_orders ADD CONSTRAINT sales_orders_status_check 
  CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected', 'Partial', 'Fulfilled'));

-- 2. Add vehicle compartments to existing vehicles
INSERT INTO public.vehicle_compartments (vehicle_id, compartment_number, capacity)
SELECT v.id, n, CASE 
  WHEN v.capacity = 16000 THEN CASE n WHEN 1 THEN 4000 WHEN 2 THEN 4000 WHEN 3 THEN 4000 ELSE 4000 END
  WHEN v.capacity = 10000 THEN CASE n WHEN 1 THEN 3500 WHEN 2 THEN 3500 ELSE 3000 END
  WHEN v.capacity = 24000 THEN CASE n WHEN 1 THEN 5000 WHEN 2 THEN 5000 WHEN 3 THEN 5000 WHEN 4 THEN 5000 ELSE 4000 END
  ELSE 5000
END
FROM public.vehicles v
CROSS JOIN generate_series(1, 
  CASE 
    WHEN v.capacity = 16000 THEN 4
    WHEN v.capacity = 10000 THEN 3
    WHEN v.capacity = 24000 THEN 5
    ELSE 3
  END
) AS n
WHERE NOT EXISTS (
  SELECT 1 FROM public.vehicle_compartments vc WHERE vc.vehicle_id = v.id
);

-- 3. Seed Sales Order test data (using existing companies/products)
-- SO #1: PT Ogan Jaya Konstruksi, 10000L of B40 (Approved)
INSERT INTO public.sales_orders (
  so_number, company_id, product_id, quotation_id,
  quantity, so_date, delivery_date, delivery_address, status, note, is_note_enabled
) VALUES (
  'SO/2026/001',
  '5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
  '8a1a3c72-6f8d-43fd-b0e7-023a2e934255',
  NULL,
  10000, '2026-06-15', '2026-06-20',
  'Jl. Dr. M. Hatta No. 15, Baturaja Lama',
  'Approved',
  '', true
) ON CONFLICT DO NOTHING;

-- SO #2: CV Musi Trans Mandiri, 5000L of B50 (Approved)
INSERT INTO public.sales_orders (
  so_number, company_id, product_id, quotation_id,
  quantity, so_date, delivery_date, delivery_address, status, note, is_note_enabled
) VALUES (
  'SO/2026/002',
  '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
  '8c69d136-4779-4352-a35d-ff09d6920066',
  NULL,
  5000, '2026-06-18', '2026-06-22',
  'Jl. Kolonel Atmo No. 88, Ilir Timur I, Palembang',
  'Approved',
  '', true
) ON CONFLICT DO NOTHING;

-- SO #3: PT Ogan Jaya Konstruksi, 8000L of B50 (Approved)
INSERT INTO public.sales_orders (
  so_number, company_id, product_id, quotation_id,
  quantity, so_date, delivery_date, delivery_address, status, note, is_note_enabled
) VALUES (
  'SO/2026/003',
  '5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
  '8c69d136-4779-4352-a35d-ff09d6920066',
  NULL,
  8000, '2026-06-20', '2026-06-25',
  'Jl. Dr. M. Hatta No. 15, Baturaja Lama',
  'Approved',
  '', true
) ON CONFLICT DO NOTHING;

-- 4. Seed additional deposit test data
INSERT INTO public.deposits (
  deposit_number, company_id, product_id, deposit_date,
  total_amount, qty_liter, price_per_liter,
  remaining_qty_liter, payment_method, status,
  payment_bank_account, tax_details, note, is_note_enabled
) VALUES (
  'DP/2606/0010',
  '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
  '8c69d136-4779-4352-a35d-ff09d6920066',
  '2026-06-19',
  387500000, 25000, 13500,
  25000, 'Transfer', 'Accepted',
  '{"id":"mdpnw7n","name":"Bank Mandiri","branch":"Letkol Iskandar","bank_name":"Bank Mandiri","account_name":"PT Anugerah Buana Sriwijaya","account_number":"111231002319"}'::jsonb,
  '[{"id":"7acdbbbf-03cc-47c8-ba09-9b0ab721bfeb","name":"PPN","rate":11,"value":11,"enabled":true,"category":"tax"},{"id":"7658866b-0d4a-4b79-97dc-9cbad84a0168","name":"PBBKB","rate":5,"value":5,"enabled":true,"category":"tax"},{"id":"d9e439b8-3f6a-46ab-b65a-914f4a9de96b","name":"PPh 22","rate":0.3,"value":0.3,"enabled":true,"category":"tax"}]'::jsonb,
  '', true
) ON CONFLICT DO NOTHING;

INSERT INTO public.deposits (
  deposit_number, company_id, product_id, deposit_date,
  total_amount, qty_liter, price_per_liter,
  remaining_qty_liter, payment_method, status,
  payment_bank_account, tax_details, note, is_note_enabled
) VALUES (
  'DP/2606/0011',
  '5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
  '8a1a3c72-6f8d-43fd-b0e7-023a2e934255',
  '2026-06-20',
  290625000, 20000, 12500,
  20000, 'Transfer', 'Accepted',
  '{"id":"soqayih","name":"Bank Central Asia","branch":"Letkol Iskandar","bank_name":"Bank Central Asia","account_name":"PT Anugerah Buana Sriwijaya","account_number":"31312315"}'::jsonb,
  '[{"id":"7acdbbbf-03cc-47c8-ba09-9b0ab721bfeb","name":"PPN","rate":11,"value":11,"enabled":true,"category":"tax"},{"id":"7658866b-0d4a-4b79-97dc-9cbad84a0168","name":"PBBKB","rate":5,"value":5,"enabled":true,"category":"tax"},{"id":"d9e439b8-3f6a-46ab-b65a-914f4a9de96b","name":"PPh 22","rate":0.3,"value":0.3,"enabled":true,"category":"tax"}]'::jsonb,
  '', true
) ON CONFLICT DO NOTHING;
