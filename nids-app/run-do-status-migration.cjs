const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function run() {
  let connectionString = 'postgresql://postgres:postgres@localhost:54322/postgres';
  if (process.env.DATABASE_URL) {
    connectionString = process.env.DATABASE_URL;
  }

  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected to DB.");
    
    const sqlPath = path.join(__dirname, 'add_invoiced_status_to_do.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    console.log('✅ Successfully added "Invoiced" status constraint to delivery_orders table!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await client.end();
  }
}
run();
