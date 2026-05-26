import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Validate Token again (Security)
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_id, email, setup_token_expires')
      .eq('setup_token', token)
      .single()

    if (fetchError || !profile || !profile.auth_id) {
      return NextResponse.json({ error: 'Session expired or link invalid.' }, { status: 403 })
    }

    // 2. Check Expiry
    if (profile.setup_token_expires && new Date(profile.setup_token_expires) < new Date()) {
      return NextResponse.json({ error: 'This link has expired.' }, { status: 403 })
    }

    // 3. Update Auth User Password using Supabase Admin
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.auth_id,
      { password: password }
    )

    if (authError) {
      console.error('Set Password Admin Error:', authError.message)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // 4. Cleanup: Remove token and finalize profile
    await supabaseAdmin
      .from('profiles')
      .update({
        setup_token: null,
        setup_token_expires: null,
        is_active: true
      })
      .eq('id', profile.id)

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('Set Password API Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
