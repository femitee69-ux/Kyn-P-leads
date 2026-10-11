import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/gmails -> list all linked gmail accounts for the signed-in user
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const gmails = await db.gmailAccount.findMany({
      where: { userId },
      orderBy: { slot: 'asc' },
    })
    return NextResponse.json({
      gmails: gmails.map((g) => ({
        id: g.id,
        slot: g.slot,
        email: g.email,
        active: g.active,
        updatedAt: g.updatedAt,
      })),
      oauthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/gmails
 * body: { slot: 1..5, email, appPassword }
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as {
      slot?: number
      email?: string
      appPassword?: string
    }
    if (!body.slot || body.slot < 1 || body.slot > 5) {
      return NextResponse.json({ error: 'slot must be 1..5' }, { status: 400 })
    }
    if (!body.email || !body.email.includes('@')) {
      return NextResponse.json({ error: 'valid email required' }, { status: 400 })
    }
    // appPassword is now optional (OAuth path doesn't use it).
    const appPassword = body.appPassword ? body.appPassword.trim() : null
    if (appPassword !== null && appPassword.length < 8) {
      return NextResponse.json({ error: 'app password too short' }, { status: 400 })
    }

    const existing = await db.gmailAccount.findUnique({
      where: { userId_slot: { userId, slot: body.slot } },
    })
    let saved
    if (existing) {
      saved = await db.gmailAccount.update({
        where: { userId_slot: { userId, slot: body.slot } },
        data: { email: body.email.trim(), appPassword, active: true },
      })
    } else {
      saved = await db.gmailAccount.create({
        data: {
          userId,
          slot: body.slot,
          email: body.email.trim(),
          appPassword,
          active: true,
        },
      })
    }

    return NextResponse.json({
      slot: saved.slot,
      email: saved.email,
      active: saved.active,
      updatedAt: saved.updatedAt,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * DELETE /api/gmails?slot=2
 */
export async function DELETE(req: Request) {
  try {
    const userId = await requireUserId()
    const url = new URL(req.url)
    const slot = Number(url.searchParams.get('slot') || 0)
    if (slot < 1 || slot > 5) {
      return NextResponse.json({ error: 'invalid slot' }, { status: 400 })
    }
    await db.gmailAccount.deleteMany({ where: { userId, slot } })
    return NextResponse.json({ ok: true, slot })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
