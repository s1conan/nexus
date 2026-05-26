import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Simple helper to read .env.local
function getEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  content.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) env[key.trim()] = value.trim()
  })
  return env
}

async function checkConnection() {
  const env = getEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url.includes('your-project-id')) {
    console.error('❌ Error: Supabase URL or Key is missing/placeholders in .env.local')
    process.exit(1)
  }

  console.log(`Connecting to: ${url}...`)
  const supabase = createClient(url, key)

  const tables = ['dictionary', 'companies', 'products', 'audit_logs']
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    
    if (error) {
      console.error(`❌ Table '${table}': ${error.message}`)
    } else {
      console.log(`✅ Table '${table}': Connected and accessible.`)
    }
  }
}

checkConnection()