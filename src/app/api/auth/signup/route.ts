import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
})

/**
 * POST /api/auth/signup
 * Creates a new Kyn'P Leads user account.
 * Email + password (min 8 chars) required.
 * Returns { ok: true } so the frontend can immediately call signIn('credentials').
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({})))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message || 'Invalid input'
      return NextResponse.json({ error: err }, { status: 400 })
    }
    const { email, password, name } = parsed.data
    const normalized = email.toLowerCase().trim()

    const existing = await db.user.findUnique({ where: { email: normalized } })
    if (existing) {
      return NextResponse.json(
        { error: 'An account already exists with that email.' },
        { status: 409 },
      )
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await db.user.create({
      data: { email: normalized, passwordHash, name: name || null },
    })

    return NextResponse.json({ ok: true, email: normalized })
  } catch (err) {
    console.error('[auth/signup] error', err)
    return NextResponse.json(
      { error: (err as Error).message || 'Signup failed' },
      { status: 500 },
    )
  }
}
