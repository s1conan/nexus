-- Population Script for Companies, Funders, and Vehicles
-- Each table will have 100 rows

DO $$
BEGIN
    -- 1. Populate Companies (100 rows)
    FOR i IN 1..100 LOOP
        INSERT INTO public.companies (name, type, details, is_active)
        VALUES (
            'Company ' || i || ' ' || CASE WHEN i % 3 = 0 THEN 'Group' WHEN i % 3 = 1 THEN 'Inc' ELSE 'Ltd' END,
            CASE 
                WHEN i % 5 = 0 THEN ARRAY['Customer', 'Supplier']
                WHEN i % 2 = 0 THEN ARRAY['Supplier']
                ELSE ARRAY['Customer']
            END,
            jsonb_build_object(
                'contact_person', 'Manager ' || i,
                'email', 'contact' || i || '@company' || i || '.com',
                'phone', '0812' || lpad(i::text, 8, '0'),
                'address', 'Street Name No. ' || i
            ),
            TRUE
        );
    END LOOP;

    -- 2. Populate Funders (100 rows)
    FOR i IN 1..100 LOOP
        INSERT INTO public.funders (name, id_number, phone, bank_accounts, is_active)
        VALUES (
            'Funder ' || chr(65 + (i % 26)) || ' ' || i,
            '3201' || lpad(i::text, 12, '0'),
            '0857' || lpad(i::text, 8, '0'),
            jsonb_build_array(
                jsonb_build_object(
                    'bank_name', CASE WHEN i % 3 = 0 THEN 'BCA' WHEN i % 3 = 1 THEN 'Mandiri' ELSE 'BNI' END,
                    'account_number', '123456' || lpad(i::text, 4, '0'),
                    'account_holder', 'Funder ' || i
                )
            ),
            TRUE
        );
    END LOOP;

    -- 3. Populate Vehicles (100 rows)
    FOR i IN 1..100 LOOP
        DECLARE
            v_cap NUMERIC := CASE WHEN i % 2 = 0 THEN 16000 ELSE 24000 END;
            v_comps JSONB;
        BEGIN
            IF v_cap = 16000 THEN
                v_comps := '[{"number": 1, "capacity": 8000}, {"number": 2, "capacity": 8000}]'::jsonb;
            ELSE
                v_comps := '[{"number": 1, "capacity": 8000}, {"number": 2, "capacity": 8000}, {"number": 3, "capacity": 8000}]'::jsonb;
            END IF;

            INSERT INTO public.vehicles (license_number, vehicle_type, capacity, compartments, is_active)
            VALUES (
                CASE WHEN i % 2 = 0 THEN 'B ' ELSE 'BG ' END || lpad((1000 + i)::text, 4, '0') || ' ' || chr(65 + (i % 26)) || chr(66 + (i % 26)),
                'Tanker',
                v_cap,
                v_comps,
                TRUE
            );
        END;
    END LOOP;

END $$;
