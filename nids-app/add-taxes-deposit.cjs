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
      ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS taxes JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('Successfully altered deposits table to add taxes field');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
