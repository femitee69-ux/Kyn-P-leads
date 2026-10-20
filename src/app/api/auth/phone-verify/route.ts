import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { codeStore } from '@/app/api/auth/phone-login/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Single-user app — the BOSS
const BOSS_EMAIL = 'boss@kynpleads.app'
const BOSS_NAME = 'BOSS'
const BOSS_PASSWORD = 'kynp-boss-2026'

/**
 * POST /api/auth/phone-verify
 * Body: { phone, code }
 * Verifies the code → ensures the BOSS user exists → returns credentials for NextAuth signIn
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { phone?: string; code?: string }
    const phone = (body.phone || '').trim()
    const code = (body.code || '').trim()

    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code are required' }, { status: 400 })
    }

    // Verify the code
    const stored = codeStore.get(phone)
    if (!stored) {
      return NextResponse.json({ error: 'No code found. Request a new code.' }, { status: 400 })
    }
    if (Date.now() > stored.expires) {
      codeStore.delete(phone)
      return NextResponse.json({ error: 'Code expired. Request a new code.' }, { status: 400 })
    }
    if (stored.code !== code) {
      return NextResponse.json({ error: 'Wrong code. Try again.' }, { status: 400 })
    }

    // Code verified → clear it
    codeStore.delete(phone)

    // Find or create the BOSS user (single-user app — no signup for others)
    let user = await db.user.findUnique({ where: { email: BOSS_EMAIL } })
    if (!user) {
      const passwordHash = await bcrypt.hash(BOSS_PASSWORD, 10)
      user = await db.user.create({
        data: { email: BOSS_EMAIL, name: BOSS_NAME, passwordHash },
      })
      console.log('[auth] Created BOSS user:', user.id)
    }

    return NextResponse.json({
      ok: true,
      // Frontend uses these to call NextAuth signIn('credentials')
      email: BOSS_EMAIL,
      password: BOSS_PASSWORD,
      name: BOSS_NAME,
    })
  } catch (err) {
    console.error('[auth/phone-verify] error', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
