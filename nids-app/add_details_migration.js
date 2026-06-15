const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addDetailsField() {
  const sql = `
    ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error("RPC exec_sql might not exist or failed:", error);
    console.log("Will execute directly using psql if needed.");
  } else {
    console.log("Details columns added successfully via RPC.");
  }
}

addDetailsField();
