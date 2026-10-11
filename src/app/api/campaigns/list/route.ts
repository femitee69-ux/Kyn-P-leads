import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/campaigns/list
 * Returns all campaigns for the signed-in user, newest first.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const campaigns = await db.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { leads: true } } },
    })
    return NextResponse.json({ campaigns })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/campaigns/list
 * Update a campaign's status.
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as {
      campaignId?: string
      status?: string
    }
    if (!body.campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }
    const updated = await db.campaign.updateMany({
      where: { id: body.campaignId, userId },
      data: body.status ? { status: body.status } : {},
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json({ campaignId: body.campaignId, status: body.status || 'updated' })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
