import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/campaigns/stop
 * Pauses a running campaign.
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as { campaignId?: string }
    if (!body.campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }
    const updated = await db.campaign.updateMany({
      where: { id: body.campaignId, userId },
      data: { status: 'paused' },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json({ campaignId: body.campaignId, status: 'paused' })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
