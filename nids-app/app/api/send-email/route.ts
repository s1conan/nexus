import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { to, subject, html, from } = await request.json()

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, or html' }, { status: 400 })
    }

    const result = await sendEmail({ to, subject, html, from })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('API Send Email Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to send email' }, { status: 500 })
  }
}
