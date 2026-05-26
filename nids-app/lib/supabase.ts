import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

// Browser-side singleton
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(supabaseUrl, supabaseAnonKey)
  }
  
  if (!client) {
    client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }
  
  return client
}
