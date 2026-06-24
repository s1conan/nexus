import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail, emailTemplates } from '@/lib/email'
import { createServerSideClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const { profileId, email, action, fullName, phone } = await request.json()

    if (!profileId || !email || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`API Approve: ${action} for ${email} (Profile: ${profileId})`)

    if (action === 'approve') {
      // 0. Fetch the current profile to get the role
      const { data: profileData, error: profileFetchError } = await supabaseAdmin
        .from('profiles')
        .select('role, auth_id')
        .eq('id', profileId)
        .single()

      if (profileFetchError) {
        console.error('Profile Fetch Error:', profileFetchError.message)
        return NextResponse.json({ error: profileFetchError.message }, { status: 500 })
      }

      let authId = profileData.auth_id

      // 1. Ensure Auth User exists
      if (!authId) {
        console.log(`API Approve: Creating new auth user for ${email}`)
        const tempPassword = Math.random().toString(36).slice(-12) + "!"
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName || '',
            phone: phone || '',
            role: profileData.role || 'staff'
          }
        })

        if (authError) {
          console.error('Auth Creation Error:', authError.message)
          return NextResponse.json({ error: authError.message }, { status: 500 })
        }
        authId = authData.user?.id
      }

      if (!authId) {
        return NextResponse.json({ error: 'Failed to establish Auth ID' }, { status: 500 })
      }

      // 2. Generate OUR OWN Token
      const setupToken = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

      // 3. Update Profile with our token
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          auth_id: authId,
          is_active: true,
          setup_token: setupToken,
          setup_token_expires: expiresAt
        })
        .eq('id', profileId)

      if (profileUpdateError) {
        console.error('Profile Token Update Error:', profileUpdateError.message)
        return NextResponse.json({ error: `Failed to initialize security token: ${profileUpdateError.message}` }, { status: 500 })
      }

      // 4. Construct Application Link
      const inviteLink = `${new URL(request.url).origin}/reset-password?token=${setupToken}`

      // 5. Send the Email (BACKGROUND TASK)
      const template = emailTemplates.invitation(fullName, inviteLink)
      sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        category: "auth"
      }).catch((err) => console.error('Background Email Error:', err.message))

      return NextResponse.json({ success: true, auth_id: authId })

    } else if (action === 'revoke') {
      // 0. Safety Check: Prevent self-revocation
      const supabaseServer = await createServerSideClient()
      const { data: { user: currentUser } } = await supabaseServer.auth.getUser()

      // 1. Get the auth_id and full_name from the profile
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('auth_id, full_name')
        .eq('id', profileId)
        .single()

      if (fetchError || !profile?.auth_id) {
        console.error('Profile Fetch Error or No Auth ID:', fetchError)
        return NextResponse.json({ error: 'User has no auth account to revoke' }, { status: 400 })
      }

      if (currentUser && profile.auth_id === currentUser.id) {
        console.warn(`Blocked self-revocation attempt for user: ${currentUser.email}`)
        return NextResponse.json({ error: 'You cannot revoke your own account access.' }, { status: 403 })
      }

      const authIdToDelete = profile.auth_id
      const userFullName = profile.full_name || 'User'

      // 2. Update the profile FIRST to break the foreign key constraint
      // and set is_active to false
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          auth_id: null,
          is_active: false
        })
        .eq('id', profileId)

      if (profileUpdateError) {
        console.error('Profile Update Error during revocation:', profileUpdateError.message)
        return NextResponse.json({ error: `Failed to update profile: ${profileUpdateError.message}` }, { status: 500 })
      }

      console.log(`Profile unlinked for ${profileId}. Proceeding to background background cleanup.`)

      // 3. Send the Deactivation Email (BACKGROUND TASK)
      const deactivationTemplate = emailTemplates.deactivation(userFullName)
      sendEmail({
        to: email,
        subject: deactivationTemplate.subject,
        html: deactivationTemplate.html,
        category: "auth"
      }).then(() => {
        console.log(`Deactivation email sent backgrounded`)
      }).catch((err) => {
        console.warn('Background Deactivation Email Warning:', err.message)
      })

      // 4. Delete the user from Supabase Auth (BACKGROUND TASK)
      // This is the slowest part, so we definitely don't want to wait for it.
      supabaseAdmin.auth.admin.deleteUser(authIdToDelete).then(({ error: delError }) => {
        if (delError) {
            console.error('Background Auth Deletion Error:', delError.message)
        } else {
            console.log('Background Auth Deletion Success')
        }
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (err: any) {
    console.error('Unexpected API Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
