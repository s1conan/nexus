const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  let connectionString = 'postgresql://postgres:postgres@localhost:54322/postgres';
  if (process.env.DATABASE_URL) connectionString = process.env.DATABASE_URL;

  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected to DB.");

  try {
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_deposit_inventory_v3() 
      RETURNS trigger AS $$
      DECLARE
        v_pbbkb_rate NUMERIC := 0;
        v_unit_cost NUMERIC;
      BEGIN
        IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.status = 'Accepted')) THEN
          DELETE FROM public.inventory_ledger 
          WHERE reference_type = 'Deposit' AND reference_id = OLD.id;
        END IF;

        IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
          IF (NEW.status = 'Accepted') THEN
            IF NEW.product_id IS NOT NULL AND NEW.qty_liter > 0 THEN
              
              IF NEW.tax_details IS NOT NULL AND jsonb_typeof(NEW.tax_details) = 'array' THEN
                SELECT COALESCE(
                  (SELECT (elem->>'rate')::NUMERIC 
                  FROM jsonb_array_elements(NEW.tax_details) elem 
                  WHERE (elem->>'name') = 'PBBKB' AND (elem->>'enabled')::BOOLEAN = true
                  LIMIT 1
                  ), 0) INTO v_pbbkb_rate;
              END IF;

              v_unit_cost := NEW.price_per_liter * (1 + (v_pbbkb_rate / 100));

              INSERT INTO public.inventory_ledger (
                supplier_id, 
                product_id, 
                transaction_type, 
                quantity, 
                unit_cost, 
                reference_type, 
                reference_id, 
                created_by
              )
              VALUES (
                NEW.company_id, 
                NEW.product_id, 
                'IN', 
                NEW.qty_liter, 
                v_unit_cost, 
                'Deposit', 
                NEW.id, 
                NEW.created_by
              );
            END IF;
          END IF;
        END IF;

        IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
      END;
      $$ LANGUAGE plpgsql;

      -- Update the view to calculate the unit price appropriately if needed
      -- (We don't need to update the view, because total_in_value will use the new unit_cost)
    `);
    console.log('Successfully updated handle_deposit_inventory_v3 to include PBBKB.');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();