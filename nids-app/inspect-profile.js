const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function getEnv() {
  const envPath = path.resolve(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    const key = parts[0];
    const value = parts.slice(1).join('=');
    if (key && value) env[key.trim()] = value.trim();
  });
  return env;
}

async function run() {
  const env = getEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('Connecting to:', url);
  const supabase = createClient(url, key);

  console.log('\n--- Fetching profiles table metadata / sample ---');
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (pError) {
    console.error('❌ Profiles error:', pError);
  } else {
    console.log('✅ Profiles sample row:', profiles[0]);
  }

  console.log('\n--- Fetching role_permissions table metadata / sample ---');
  const { data: rolePerms, error: rError } = await supabase
    .from('role_permissions')
    .select('*');

  if (rError) {
    console.error('❌ Role permissions error:', rError);
  } else {
    console.log('✅ Role permissions rows:', rolePerms);
  }
}

run();
