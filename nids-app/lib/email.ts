import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

/**
 * Shared utility for sending emails via Resend.
 * This can be used in server-side routes or background jobs.
 */
export async function sendEmail({ to, subject, html, from }: SendEmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: from || process.env.RESEND_FROM_EMAIL || 'Nexus <onboarding@resend.dev>',
      to,
      subject,
      html,
    })

    if (error) {
      console.error('Email Service Error:', error)
      throw new Error(error.message)
    }

    return { success: true, id: data?.id }
  } catch (err: any) {
    console.error('Email Service Unexpected Error:', err)
    throw err
  }
}

/**
 * Predefined email templates
 */
export const emailTemplates = {
  invitation: (fullName: string, inviteLink: string) => ({
    subject: 'Welcome to Nexus - Complete Your Account',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: linear-gradient(180deg,rgba(0, 209, 129, 1) 0%, rgba(255, 255, 255, 1) 25%);">
        <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Welcome to Nexus</h1>
		<h3>Hello ${fullName || 'there'},</h3>
        <p style="color: #475569; font-size: 16px; line-height: 24px">
          Your account for Nexus has been approved! To get started, please click the button below to set your password.
		</p>
		<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
		<p style="color: #475569; font-size: 16px; line-height: 24px">
		  Akun Nexus Anda telah disetujui! Untuk memulai, silakan klik tombol di bawah ini untuk mengatur kata sandi Anda.
        </p>
		<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <div style="margin: 32px 0;">
          <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
            Activate Account
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 14px; line-height: 20px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <span style="color: #2563eb; word-break: break-all;">${inviteLink}</span>
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          &copy; ${new Date().getFullYear()} Nexus. All rights reserved.
        </p>
      </div>
    `
  }),

  forgotPassword: (fullName: string, resetLink: string) => ({
    subject: 'Password Reset Request - Nexus',
    html: `
	  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;background: linear-gradient(180deg,rgba(235, 192, 0, 1) 0%, rgba(255, 255, 255, 1) 25%);">
        <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Reset Your Password</h1>
		<h3>Hello ${fullName || 'there'},</h3>
        <p style="color: #475569; font-size: 16px; line-height: 24px">
          We received a request to reset the password for your Nexus account. Click the button below to choose a new password.
		  <p style="color: #94a3b8; font-size: 14px; line-height: 20px;">
          If you didn't request this, you can safely ignore this email. The link will expire in 24 hours.<br><br>
		  </p>
        </p>
		<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <p style="color: #475569; font-size: 16px; line-height: 24px">
          Kami menerima permintaan untuk mengatur ulang kata sandi akun Nexus Anda. Klik tombol di bawah ini untuk memilih kata sandi baru.
		  <p style="color: #94a3b8; font-size: 14px; line-height: 20px;">
          Jika Anda tidak meminta ini, Anda dapat mengabaikan email ini. Tautan akan kedaluwarsa dalam 24 jam.<br><br>
		  </p>
        </p>
		<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <div style="margin: 32px 0;">
          <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
            Reset Password
          </a>
        </div>
		<p style="color: #94a3b8; font-size: 14px; line-height: 20px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <span style="color: #2563eb; word-break: break-all;">${resetLink}</span>
        </p>
		
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          &copy; ${new Date().getFullYear()} Nexus. All rights reserved.
        </p>
      </div>
    `
  }),

  deactivation: (fullName: string) => ({
    subject: 'Account Deactivated - Nexus',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;background: linear-gradient(180deg,rgba(209, 0, 80, 1) 0%, rgba(255, 255, 255, 1) 25%);">
        <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Account Deactivated</h1>
		<h3>Hello ${fullName || 'there'},</h3>
		<p style="color: #475569; font-size: 16px; line-height: 24px;">
          We would like to inform you that your account for Nexus has been deactivated. You will no longer be able to log in or access Nexus.
		</p>
		<p style="color: #475569; font-size: 16px; line-height: 24px;">
		  If you believe this is a mistake, please contact your system administrator.
		</p>
		<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
		<p style="color: #475569; font-size: 16px; line-height: 24px;">
		  Kami ingin memberitahukan bahwa akun Nexus Anda telah dinonaktifkan. Anda tidak akan lagi dapat masuk atau mengakses Nexus.
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">
		  Jika Anda yakin ini adalah kesalahan, silakan hubungi administrator sistem Anda.
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          &copy; ${new Date().getFullYear()} Nexus. All rights reserved.
        </p>
      </div>
    `
  }),

  // Placeholder for future use
  invoice: (orderId: string, amount: string) => ({
    subject: `Invoice for Order #${orderId}`,
    html: `<h1>Invoice</h1><p>Amount: ${amount}</p>`
  })
}
