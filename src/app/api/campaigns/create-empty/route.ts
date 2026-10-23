import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/campaigns/create-empty
 * Creates a campaign WITHOUT generating leads (for the upload-leads flow).
 * Body: { brand, service, targetLeads, gmailSlots }
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as {
      brand?: string
      service?: string
      targetLeads?: number
    }

    const campaign = await db.campaign.create({
      data: {
        userId,
        country: 'Uploaded',
        brand: body.brand || 'Uploaded Leads',
        service: body.service || 'Direct Outreach',
        targetAudience: null,
        followUp: false,
        targetLeads: body.targetLeads || 500,
        cronToken: randomBytes(16).toString('hex'),
        status: 'running',
        startedAt: new Date(),
      },
    })

    return NextResponse.json({
      campaignId: campaign.id,
      status: campaign.status,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
