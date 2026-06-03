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
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    console.error('❌ Service role key is missing in .env.local');
    return;
  }

  console.log('Connecting to:', url);
  const supabase = createClient(url, key);

  console.log('\n--- Querying Active RLS Policies ---');
  const { data: policies, error: polError } = await supabase.rpc('pg_execute_sql', {
    // Wait, rpc might not exist. Let's run a standard query using an SQL executor or direct query if available,
    // or select from pg_policies using supabase.from() if exposed, but pg_policies is a system view.
    // In Supabase, standard REST API doesn't expose system catalogs directly unless we use an RPC function or execute raw SQL.
    // Let's check if there is an RPC function for executing raw SQL or similar.
    // If not, we can check RLS by trying to select from profiles as the authenticated user.
  });

  // Let's do a test by logging in as the user 's123conan@yahoo.com' using supabase.auth!
  // Wait, we don't know their password. But we can create a temporary session or read their session,
  // or we can sign in with the service role client and generate a user link, or simply test RLS.
  // Wait! We can fetch the user details using service role admin API:
  const { data: authUsers, error: auError } = await supabase.auth.admin.listUsers();
  if (auError) {
    console.error('❌ Auth users list error:', auError);
  } else {
    console.log('✅ Found auth users count:', authUsers.users.length);
    const conanUser = authUsers.users.find(u => u.email === 's123conan@yahoo.com');
    if (conanUser) {
      console.log('✅ Conan Auth User ID:', conanUser.id);
    }
  }

  // Wait! Let's check the profiles table values again:
  // profiles.id = '3690fcc7-58b0-4956-a4cc-41f96d7e38f3'
  // profiles.auth_id = '893b9f5d-1535-4a2b-89c8-5ba3dea900f0'
  // Wait, if Conan Auth User ID is '893b9f5d-1535-4a2b-89c8-5ba3dea900f0', and profiles.auth_id is '893b9f5d-1535-4a2b-89c8-5ba3dea900f0',
  // but profiles.id is '3690fcc7-58b0-4956-a4cc-41f96d7e38f3',
  // then the 'profiles' RLS policy "Profile Access Self" in schema.sql is:
  // USING (auth.uid() = id)
  // Let's check if this policy is active. If USING (auth.uid() = id) is active, then auth.uid() ('893b9f5d-1535-4a2b-89c8-5ba3dea900f0') 
  // is checked against profiles.id ('3690fcc7-58b0-4956-a4cc-41f96d7e38f3'), which will FAIL!
  // Let's check if the profiles RLS policy is active in the database.
  // Let's run a query to select pg_policies via a custom SQL script if we can, or just inspect how they are defined in fix-profiles-policy.sql.
}

run();
