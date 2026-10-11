import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'
import { checkKeyCredit } from '@/lib/credits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/status
 * Lightweight status summary for the signed-in user.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const [gmails, apiKeys, lastCampaign] = await Promise.all([
      db.gmailAccount.findMany({ where: { userId, active: true } }),
      db.apiKey.findMany({ where: { userId, active: true } }),
      db.campaign.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ])

    let sentToday = 0
    let followedUpToday = 0
    if (lastCampaign) {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      sentToday = await db.lead.count({
        where: { campaignId: lastCampaign.id, sentAt: { gte: startOfDay } },
      })
      followedUpToday = await db.lead.count({
        where: { campaignId: lastCampaign.id, followedUpAt: { gte: startOfDay } },
      })
    }

    // Check credits in the background (cached for 60s to avoid hammering APIs)
    const credits = await Promise.all(
      apiKeys.map((k) => checkKeyCredit(k)),
    )

    return NextResponse.json({
      gmails: {
        count: gmails.length,
        slots: gmails.map((g) => g.slot),
      },
      apiKeys: {
        count: apiKeys.length,
        slots: apiKeys.map((k) => k.slot),
      },
      campaign: lastCampaign
        ? {
            id: lastCampaign.id,
            status: lastCampaign.status,
            country: lastCampaign.country,
            brand: lastCampaign.brand,
            service: lastCampaign.service,
            followUp: lastCampaign.followUp,
            startedAt: lastCampaign.startedAt,
          }
        : null,
      sentToday,
      followedUpToday,
      credits,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
