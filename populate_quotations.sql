-- Script to populate the quotations table with at least 10 rows of mock data.
-- This script uses a DO block to dynamically fetch an existing company and product
-- to ensure referential integrity.

DO $$
DECLARE
  v_company_id UUID;
  v_product_id UUID;
  i INT;
  v_status TEXT;
  v_qnum TEXT;
BEGIN
  -- 1. Get an existing company (prefer a Customer)
  SELECT id INTO v_company_id FROM public.companies WHERE 'Customer' = ANY(type) LIMIT 1;
  IF v_company_id IS NULL THEN
    -- Fallback to any company if no 'Customer' type exists
    SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  END IF;

  -- 2. Get an existing product
  SELECT id INTO v_product_id FROM public.products LIMIT 1;

  -- 3. Only proceed if we have valid references
  IF v_company_id IS NOT NULL AND v_product_id IS NOT NULL THEN
    
    FOR i IN 1..10 LOOP
      -- Determine status based on index for variety
      IF i % 4 = 0 THEN
        v_status := 'Accepted';
      ELSIF i % 3 = 0 THEN
        v_status := 'Rejected';
      ELSIF i % 2 = 0 THEN
        v_status := 'Sent';
      ELSE
        v_status := 'Draft';
      END IF;

      v_qnum := 'QTN/2026/MOCK-' || lpad(i::text, 3, '0');

      INSERT INTO public.quotations (
        quotation_number,
        company_id,
        product_id,
        quotation_date,
        expiry_date,
        expiry_days,
        minimum_order,
        shrinkage_tolerance,
        status,
        content,
        is_content_enabled,
        note,
        is_note_enabled,
        terms_conditions,
        is_terms_enabled,
        closing_remarks,
        is_closing_enabled,
        discounts,
        bank_accounts
      ) VALUES (
        v_qnum,
        v_company_id,
        v_product_id,
        CURRENT_DATE - (i || ' days')::interval,
        CURRENT_DATE + 30 - (i || ' days')::interval,
        30,
        1000 + (i * 500),
        0.5,
        v_status,
        '<p>This is an automated mock quotation generated for testing purposes. Quotation reference: ' || v_qnum || '</p>',
        TRUE,
        '<p>Standard delivery times apply.</p>',
        TRUE,
        '<p>1. Payment is due within 30 days.<br>2. Goods remain property of the seller until fully paid.</p>',
        TRUE,
        '<p>Thank you for considering our services. We look forward to doing business with you.</p>',
        TRUE,
        CASE WHEN i % 2 = 0 THEN '[{"label": "Volume Discount", "value": 5}]'::jsonb ELSE '[]'::jsonb END,
        '[{"name": "Bank BCA", "account_number": "1234567890", "account_name": "PT. Contoh", "branch": "Jakarta"}]'::jsonb
      ) ON CONFLICT (quotation_number) DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Successfully inserted 10 mock quotations.';
  ELSE
    RAISE NOTICE 'Could not insert quotations: missing company or product records in the database.';
  END IF;
END $$;
