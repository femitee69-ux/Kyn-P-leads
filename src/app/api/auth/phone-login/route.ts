import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// In-memory code store (resets on serverless cold start — acceptable for single-user app)
const codeStore = new Map<string, { code: string; expires: number }>()

/**
 * POST /api/auth/phone-login
 * Body: { phone: string }
 * Generates a 6-digit verification code and returns it (shown on screen — no SMS cost).
 * In a production app with a budget, this would send the code via SMS (Twilio/Vonage).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { phone?: string }
    const phone = (body.phone || '').trim()

    if (!phone || phone.length < 7) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expires = Date.now() + 5 * 60 * 1000 // 5 minutes

    codeStore.set(phone, { code, expires })

    // BOSS's phone number — auto-login (no code needed)
    const BOSS_PHONE = '09152938605'
    if (phone.replace(/[\s+]/g, '').endsWith('09152938605') || phone.replace(/[\s+]/g, '').endsWith('9152938605')) {
      return NextResponse.json({
        ok: true,
        phone,
        displayCode: code,
        autoLogin: true, // Frontend auto-fills the code
        message: 'Welcome back, BOSS.',
      })
    }

    return NextResponse.json({
      ok: true,
      phone,
      displayCode: code,
      message: 'Code generated. Enter it below.',
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// Export the code store so the verify endpoint can access it
export { codeStore }
