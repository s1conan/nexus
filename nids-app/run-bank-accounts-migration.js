import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

async function discoverRpc() {
  const url = `${supabaseUrl}/rest/v1/`;
  console.log(`Fetching OpenAPI schema with Service Role Key from ${url}...`);
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const schema = await res.json();
    const paths = Object.keys(schema.paths || {});
    console.log("Found RPC endpoints:");
    paths.filter(p => p.startsWith('/rpc/')).forEach(p => {
      console.log(`- ${p}`);
    });
  } catch (err) {
    console.error("Failed to fetch schema:", err);
  }
}

discoverRpc();
