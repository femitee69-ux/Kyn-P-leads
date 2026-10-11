import { db } from '@/lib/db'

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

  // If current token still has 60+ seconds, use it.
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
 * Returns { ok: true, messageId } on success.
 * Throws on any failure.
 */
export async function sendGmailMessage(opts: {
  gmailAccountId: string
  to: string
  subject: string
  body: string
  fromName?: string
}): Promise<{ ok: true; messageId: string; from: string }> {
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
    throw new Error(`Gmail send failed: ${res.status} ${text}`)
  }
  const json = await res.json()
  return { ok: true, messageId: json.id, from: email }
}

/**
 * Builds an RFC 2822 email and base64url-encodes it for the Gmail API.
 */
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
