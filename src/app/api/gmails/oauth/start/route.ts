import { NextResponse } from 'next/server'
import { requireUserId, UnauthorizedError } from '@/lib/session'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const APP_BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

// Gmail send scope (compose & send emails on the user's behalf)
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
]

/**
 * GET /api/gmails/oauth/start?slot=N
 * Generates the Google OAuth consent URL for the requested slot. The user is
 * redirected to Google to grant gmail.send permission, then back to
 * /api/gmails/oauth/callback.
 *
 * If Google OAuth credentials are not configured, returns a friendly error
 * so the UI can show a "configuration required" notice instead of failing.
 */
export async function GET(req: Request) {
  try {
    const userId = await requireUserId()
    const url = new URL(req.url)
    const slot = Number(url.searchParams.get('slot') || 0)
    if (slot < 1 || slot > 5) {
      return NextResponse.json({ error: 'slot must be 1..5' }, { status: 400 })
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.json(
        {
          error: 'Google OAuth is not configured on this server. Ask the platform admin to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
          configured: false,
        },
        { status: 503 },
      )
    }

    // Prevent over-writing an already-linked slot accidentally: the UI should
    // confirm via DELETE first, but we also check here.
    const existing = await db.gmailAccount.findUnique({
      where: { userId_slot: { userId, slot } },
    })
    if (existing && existing.oauthRefreshToken) {
      return NextResponse.json(
        { error: `Gmail slot ${slot} is already linked to ${existing.email}. Clear it first to replace.` },
        { status: 409 },
      )
    }

    const redirectUri = `${APP_BASE_URL}/api/gmails/oauth/callback`
    const state = encodeState({ userId, slot, ts: Date.now() })

    const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    googleUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    googleUrl.searchParams.set('redirect_uri', redirectUri)
    googleUrl.searchParams.set('response_type', 'code')
    googleUrl.searchParams.set('scope', SCOPES.join(' '))
    googleUrl.searchParams.set('access_type', 'offline')
    googleUrl.searchParams.set('prompt', 'consent')
    googleUrl.searchParams.set('state', state)
    googleUrl.searchParams.set('include_granted_scopes', 'true')

    return NextResponse.json({ authUrl: googleUrl.toString(), slot })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

function encodeState(payload: Record<string, any>): string {
  const json = JSON.stringify(payload)
  return Buffer.from(json).toString('base64url')
}
