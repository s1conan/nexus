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

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const sql = `
    ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
    ALTER TABLE public.quotations ADD CONSTRAINT quotations_status_check CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Processed'));
  `;
  
  console.log("Applying migration...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  // Note: The previous script used 'sql', but sometimes RPC params are named differently.
  // I'll try 'sql_query' and fallback to 'sql' if it fails, or just 'exec_sql' if it's a known pattern.
  // Actually, let's check the previous script again... it used 'sql'.
  
  if (error) {
    // Retry with different param name if first one fails
    const { error: error2 } = await supabase.rpc('exec_sql', { sql: sql });
    if (error2) {
      console.error("Migration failed via RPC:", error2);
      process.exit(1);
    }
  }
  
  console.log("Migration applied successfully: 'Processed' status added to quotations.");
}

runMigration();
