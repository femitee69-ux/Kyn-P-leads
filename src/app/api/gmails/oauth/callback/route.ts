import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const APP_BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

interface StatePayload {
  userId: string
  slot: number
  ts: number
}

/**
 * GET /api/gmails/oauth/callback?code=...&state=...
 * Receives the Google OAuth code, exchanges it for tokens (access + refresh),
 * fetches the user's email via userinfo, and saves the GmailAccount linked
 * to the original Kyn'P user (decoded from the state param).
 *
 * On success, redirects back to /?view=gmails.
 * On failure, redirects to /?gmail_error=...
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errParam = url.searchParams.get('error')

  if (errParam) {
    return NextResponse.redirect(`${APP_BASE_URL}/?gmail_error=${encodeURIComponent(errParam)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${APP_BASE_URL}/?gmail_error=missing_params`)
  }

  let payload: StatePayload
  try {
    payload = decodeState(state)
  } catch {
    return NextResponse.redirect(`${APP_BASE_URL}/?gmail_error=invalid_state`)
  }

  // Validate the state isn't too old (10 min window)
  if (Date.now() - payload.ts > 10 * 60 * 1000) {
    return NextResponse.redirect(`${APP_BASE_URL}/?gmail_error=expired_state`)
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${APP_BASE_URL}/?gmail_error=oauth_not_configured`)
  }

  try {
    const redirectUri = `${APP_BASE_URL}/api/gmails/oauth/callback`

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      console.error('[gmails/oauth/callback] token exchange failed:', text)
      return NextResponse.redirect(`${APP_BASE_URL}/?gmail_error=token_exchange_failed`)
    }
    const tokens = await tokenRes.json()
    const accessToken = tokens.access_token
    const refreshToken = tokens.refresh_token
    const expiresIn = tokens.expires_in ?? 3600
    if (!accessToken || !refreshToken) {
      return NextResponse.redirect(`${APP_BASE_URL}/?gmail_error=no_tokens`)
    }

    // Fetch the user's email
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!profileRes.ok) {
      return NextResponse.redirect(`${APP_BASE_URL}/?gmail_error=profile_fetch_failed`)
    }
    const profile = await profileRes.json()
    const email = String(profile.email || '').toLowerCase().trim()
    if (!email) {
      return NextResponse.redirect(`${APP_BASE_URL}/?gmail_error=no_email`)
    }

    // Save the linked Gmail
    const existing = await db.gmailAccount.findUnique({
      where: { userId_slot: { userId: payload.userId, slot: payload.slot } },
    })
    const data = {
      email,
      appPassword: null,
      oauthRefreshToken: refreshToken,
      oauthAccessToken: accessToken,
      oauthExpiresAt: new Date(Date.now() + expiresIn * 1000),
      oauthScope: 'gmail.send userinfo.email openid',
      active: true,
    }
    if (existing) {
      await db.gmailAccount.update({
        where: { userId_slot: { userId: payload.userId, slot: payload.slot } },
        data,
      })
    } else {
      await db.gmailAccount.create({
        data: { userId: payload.userId, slot: payload.slot, ...data },
      })
    }

    return NextResponse.redirect(`${APP_BASE_URL}/?gmail_linked=${payload.slot}`)
  } catch (err) {
    console.error('[gmails/oauth/callback] error', err)
    return NextResponse.redirect(`${APP_BASE_URL}/?gmail_error=${encodeURIComponent((err as Error).message)}`)
  }
}

function decodeState(state: string): StatePayload {
  const json = Buffer.from(state, 'base64url').toString('utf8')
  const parsed = JSON.parse(json)
  if (!parsed.userId || !parsed.slot) throw new Error('invalid state payload')
  return parsed as StatePayload
}
