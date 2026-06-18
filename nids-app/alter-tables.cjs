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
      ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
    `);
    console.log('Successfully altered tables');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
