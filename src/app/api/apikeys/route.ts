import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Static service-per-slot mapping so the UI can label each slot clearly. */
export const API_KEY_SLOTS: { slot: number; service: string; label: string; placeholder: string; description: string }[] = [
  {
    slot: 1,
    service: 'serper',
    label: 'Serper.dev Key 1',
    placeholder: 'serper.dev API key',
    description: 'Primary key. Get free 2,500 credits at serper.dev.',
  },
  {
    slot: 2,
    service: 'serper',
    label: 'Serper.dev Key 2',
    placeholder: 'serper.dev API key',
    description: 'Backup. Auto-switches here when Key 1 runs out.',
  },
  {
    slot: 3,
    service: 'serper',
    label: 'Serper.dev Key 3',
    placeholder: 'serper.dev API key',
    description: 'Backup. Auto-switches here when Key 2 runs out.',
  },
]

/**
 * GET /api/apikeys  -> list all API key slots for the signed-in user
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const keys = await db.apiKey.findMany({
      where: { userId },
      orderBy: { slot: 'asc' },
    })
    const masked = keys.map((k) => ({
      id: k.id,
      slot: k.slot,
      service: k.service,
      label: k.label,
      masked: maskKey(k.value),
      active: k.active,
      updatedAt: k.updatedAt,
    }))
    return NextResponse.json({ keys: masked, slots: API_KEY_SLOTS })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/apikeys
 * body: { slot: 1|2|3, label, value }
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as {
      slot?: number
      label?: string
      value?: string
    }
    if (!body.slot || body.slot < 1 || body.slot > 3) {
      return NextResponse.json({ error: 'slot must be 1, 2 or 3' }, { status: 400 })
    }
    if (!body.value || body.value.trim().length < 6) {
      return NextResponse.json({ error: 'value too short' }, { status: 400 })
    }

    const slotMeta = API_KEY_SLOTS.find((s) => s.slot === body.slot)!
    const label = (body.label || slotMeta.label).slice(0, 80)
    const value = body.value.trim()

    const existing = await db.apiKey.findUnique({
      where: { userId_slot: { userId, slot: body.slot } },
    })

    let saved
    if (existing) {
      saved = await db.apiKey.update({
        where: { userId_slot: { userId, slot: body.slot } },
        data: { label, value, service: slotMeta.service, active: true },
      })
    } else {
      saved = await db.apiKey.create({
        data: { userId, slot: body.slot, label, value, service: slotMeta.service, active: true },
      })
    }

    return NextResponse.json({
      slot: saved.slot,
      service: saved.service,
      label: saved.label,
      masked: maskKey(saved.value),
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
 * DELETE /api/apikeys?slot=2
 */
export async function DELETE(req: Request) {
  try {
    const userId = await requireUserId()
    const url = new URL(req.url)
    const slot = Number(url.searchParams.get('slot') || 0)
    if (slot < 1 || slot > 3) {
      return NextResponse.json({ error: 'invalid slot' }, { status: 400 })
    }
    await db.apiKey.deleteMany({ where: { userId, slot } })
    return NextResponse.json({ ok: true, slot })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

function maskKey(value: string): string {
  if (!value) return ''
  if (value.length <= 8) return '•'.repeat(value.length)
  return value.slice(0, 4) + '•'.repeat(Math.max(4, value.length - 8)) + value.slice(-4)
}
