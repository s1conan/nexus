import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendEmail, emailTemplates } from "@/lib/email"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 })
    }

    // 1. Find profile by email
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, auth_id")
      .eq("email", email)
      .single()

    // Security: Always return success even if email not found
    if (fetchError || !profile) {
      console.warn(`Forgot Password: User not found: ${email}`)
      return NextResponse.json({ success: true })
    }

    // 2. Generate OUR OWN Token
    const setupToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

    // 3. Update Profile with recovery token
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        setup_token: setupToken,
        setup_token_expires: expiresAt,
      })
      .eq("id", profile.id)

    if (updateError) {
      console.error("Forgot Password Update Error:", updateError.message)
      return NextResponse.json(
        { error: "System error processing request" },
        { status: 500 }
      )
    }

    // 4. Construct Reset Link
    const resetLink = `${new URL(request.url).origin}/reset-password?token=${setupToken}&type=recovery`

    // 5. Send the Email (BACKGROUND)
    const template = emailTemplates.forgotPassword(
      profile.full_name || "there",
      resetLink
    )

    sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      category: "auth",
    })
      .then(() => {
        console.log(`Forgot password email dispatched to ${email}`)
      })
      .catch((err) => {
        console.error("Forgot password background email error:", err.message)
      })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Forgot Password API Error:", err)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
