import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/leads/list?campaignId=...
 * Returns all leads for the most recent (or specified) campaign of the
 * signed-in user.
 */
export async function GET(req: Request) {
  try {
    const userId = await requireUserId()
    const url = new URL(req.url)
    const campaignId = url.searchParams.get('campaignId')

    const campaign = campaignId
      ? await db.campaign.findFirst({ where: { id: campaignId, userId } })
      : await db.campaign.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })

    if (!campaign) {
      return NextResponse.json({ campaign: null, leads: [] })
    }

    const leads = await db.lead.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: 'asc' },
    })

    const stats = {
      total: leads.length,
      pending: leads.filter((l) => l.status === 'pending').length,
      sent: leads.filter((l) => l.status === 'sent').length,
      followedUp: leads.filter((l) => l.status === 'followed_up').length,
      failed: leads.filter((l) => l.status === 'failed').length,
    }

    return NextResponse.json({ campaign, leads, stats })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
