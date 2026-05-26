import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Missing security token' }, { status: 400 })
    }

    // 1. Find profile by token and check expiry
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, setup_token_expires')
      .eq('setup_token', token)
      .single()

    if (fetchError || !profile) {
      console.warn(`Verify Token: Token not found: ${token}`)
      return NextResponse.json({ error: 'Invalid security link.' }, { status: 404 })
    }

    // 2. Check Expiry
    if (profile.setup_token_expires && new Date(profile.setup_token_expires) < new Date()) {
      console.warn(`Verify Token: Token expired for ${profile.email}`)
      return NextResponse.json({ error: 'This security link has expired.' }, { status: 403 })
    }

    return NextResponse.json({ success: true, email: profile.email })

  } catch (err: any) {
    console.error('Verify Token API Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
