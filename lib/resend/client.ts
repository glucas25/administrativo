import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Sistema Docentes <onboarding@resend.dev>',
      to,
      subject,
      html,
    })

    if (error) {
      console.error('Error sending email:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Error:', error)
    return { success: false, error }
  }
}