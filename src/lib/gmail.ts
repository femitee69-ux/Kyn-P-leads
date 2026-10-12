import { db } from '@/lib/db'
import nodemailer from 'nodemailer'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

/**
 * Refreshes a Gmail OAuth access token using the stored refresh token.
 * Updates the DB with the new access token and expiry.
 * Returns the live access token or throws.
 */
export async function getFreshGmailAccessToken(
  gmailAccountId: string,
): Promise<{ accessToken: string; email: string } | null> {
  const g = await db.gmailAccount.findUnique({ where: { id: gmailAccountId } })
  if (!g || !g.oauthRefreshToken) return null

  if (g.oauthAccessToken && g.oauthExpiresAt && g.oauthExpiresAt.getTime() > Date.now() + 60_000) {
    return { accessToken: g.oauthAccessToken, email: g.email }
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth not configured — cannot refresh token')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: g.oauthRefreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed: ${text}`)
  }
  const json = await res.json()
  const accessToken: string = json.access_token
  const expiresIn: number = json.expires_in ?? 3600

  await db.gmailAccount.update({
    where: { id: g.id },
    data: {
      oauthAccessToken: accessToken,
      oauthExpiresAt: new Date(Date.now() + expiresIn * 1000),
    },
  })
  return { accessToken, email: g.email }
}

/**
 * Sends an email via the Gmail API using the user's OAuth access token.
 */
export async function sendGmailMessage(opts: {
  gmailAccountId: string
  to: string
  subject: string
  body: string
  fromName?: string
}): Promise<{ ok: true; messageId: string; from: string; method: string }> {
  const auth = await getFreshGmailAccessToken(opts.gmailAccountId)
  if (!auth) throw new Error('Gmail account not linked via OAuth')
  const { accessToken, email } = auth

  const fromHeader = opts.fromName ? `"${opts.fromName}" <${email}>` : `<${email}>`
  const raw = buildRawEmail({
    from: fromHeader,
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
  })

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gmail API send failed: ${res.status} ${text}`)
  }
  const json = await res.json()
  return { ok: true, messageId: json.id, from: email, method: 'gmail-api-oauth' }
}

/**
 * Sends an email via Gmail's SMTP server using the user's App Password.
 * This is the fallback when OAuth isn't available.
 *
 * Gmail SMTP settings:
 * - Host: smtp.gmail.com
 * - Port: 587 (STARTTLS) or 465 (SSL)
 * - Auth: email + app password (16-char)
 *
 * Emails sent via SMTP DO appear in the user's Gmail Sent folder.
 */
export async function sendViaSmtp(opts: {
  gmailAccountId: string
  to: string
  subject: string
  body: string
  fromName?: string
}): Promise<{ ok: true; messageId: string; from: string; method: string }> {
  const g = await db.gmailAccount.findUnique({ where: { id: opts.gmailAccountId } })
  if (!g) throw new Error('Gmail account not found')
  if (!g.appPassword) throw new Error('Gmail account has no App Password — link it via "Login Gmail" or add an App Password')

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user: g.email,
      pass: g.appPassword,
    },
  })

  const fromHeader = opts.fromName ? `"${opts.fromName}" <${g.email}>` : g.email

  const info = await transporter.sendMail({
    from: fromHeader,
    to: opts.to,
    subject: opts.subject,
    text: opts.body,
  })

  return {
    ok: true,
    messageId: info.messageId,
    from: g.email,
    method: 'gmail-smtp-app-password',
  }
}

/**
 * Sends an email via the best available method:
 * 1. If the Gmail has an OAuth refresh token → use Gmail API (OAuth)
 * 2. Else if the Gmail has an App Password → use SMTP
 * 3. Else throw (no sending method available)
 *
 * Both methods result in the email appearing in the user's Gmail Sent folder.
 */
export async function sendEmail(opts: {
  gmailAccountId: string
  to: string
  subject: string
  body: string
  fromName?: string
}): Promise<{ ok: true; messageId: string; from: string; method: string }> {
  const g = await db.gmailAccount.findUnique({ where: { id: opts.gmailAccountId } })
  if (!g) throw new Error('Gmail account not found')

  // Try OAuth first
  if (g.oauthRefreshToken) {
    try {
      return await sendGmailMessage(opts)
    } catch (e: any) {
      console.warn(`[gmail] OAuth send failed (${e.message}), falling back to SMTP`)
      // Fall back to SMTP if app password is available
      if (g.appPassword) {
        return await sendViaSmtp(opts)
      }
      throw e
    }
  }

  // No OAuth — try SMTP via App Password
  if (g.appPassword) {
    return await sendViaSmtp(opts)
  }

  throw new Error('No sending method available — link this Gmail via "Login Gmail" (OAuth) or add an App Password')
}

function buildRawEmail(opts: {
  from: string
  to: string
  subject: string
  body: string
}): string {
  const date = new Date().toUTCString()
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@kynpleads.app>`
  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    '',
    opts.body,
  ]
  const raw = lines.join('\r\n')
  return Buffer.from(raw, 'utf8').toString('base64url')
}
