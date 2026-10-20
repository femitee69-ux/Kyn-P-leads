import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { generateLeadsForCampaign } from '@/lib/leads'
import { requireUserId, UnauthorizedError } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60  // Allow up to 60s for AI generation (default is 10s)

interface StartBody {
  country?: string
  brand?: string
  service?: string
  targetAudience?: string
  followUp?: boolean
  gmailSlots?: number[]
  targetLeads?: number
}

/**
 * POST /api/campaigns/start
 * Creates a new campaign for the signed-in user, generates leads via AI
 * (and Serper.dev when available), composes outreach messages, and marks
 * the campaign as "running".
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as StartBody
    const country = (body.country || '').trim()
    const brand = (body.brand || '').trim()
    const service = (body.service || '').trim()
    const targetAudience = (body.targetAudience || '').trim()
    const targetLeads = body.targetLeads || 500
    const followUp = Boolean(body.followUp)

    if (!country || !brand || !service) {
      return NextResponse.json(
        { error: 'country, brand and service are required' },
        { status: 400 },
      )
    }

    // Gmail selection is compulsory — at least 1 must be selected
    if (!body.gmailSlots || body.gmailSlots.length === 0) {
      return NextResponse.json(
        { error: 'Select at least 1 Gmail to send from.' },
        { status: 400 },
      )
    }

    // Gmails are optional — we still create the campaign; messages are logged.
    const apiKeys = await db.apiKey.findMany({ where: { userId, active: true } })
    if (apiKeys.length === 0) {
      return NextResponse.json(
        { error: 'At least one API key is required to generate leads. Head to API Keys to add one.' },
        { status: 400 },
      )
    }

    // Generate leads — the first batch is generated now (fast: just Serper + template)
    // More leads are generated on-the-fly by the dispatch endpoint as the queue depletes.
    const generated = await generateLeadsForCampaign({ country, brand, service }, userId)

    const campaign = await db.campaign.create({
      data: {
        userId,
        country,
        brand,
        service,
        targetAudience: targetAudience || null,
        followUp,
        targetLeads,
        cronToken: randomBytes(16).toString('hex'),
        status: 'running',
        startedAt: new Date(),
        leads: {
          create: generated.leads.slice(0, 10).map((l) => ({
            name: l.name,
            email: l.email,
            company: l.company,
            position: l.position ?? null,
            country,
            message: l.message,
            followUpMessage: l.followUpMessage ?? null,
            status: 'pending',
          })),
        },
      },
      include: { leads: true },
    })

    // Save the remaining generated leads as "pending" too (so the dispatch loop
    // can start immediately while the user watches the queue fill up)
    if (generated.leads.length > 10) {
      await db.lead.createMany({
        data: generated.leads.slice(10).map((l) => ({
          campaignId: campaign.id,
          name: l.name,
          email: l.email,
          company: l.company,
          position: l.position ?? null,
          country,
          message: l.message,
          followUpMessage: l.followUpMessage ?? null,
          status: 'pending',
        })),
      })
    }

    const cronUrl = `${process.env.NEXTAUTH_URL || 'https://kyn-p-leads.vercel.app'}/api/leads/cron?campaignId=${campaign.id}&token=${campaign.cronToken}`

    return NextResponse.json({
      campaignId: campaign.id,
      status: campaign.status,
      totalLeads: campaign.leads.length,
      targetLeads,
      cronUrl,
      cronToken: campaign.cronToken,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    console.error('[campaigns/start] error', err)
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to start campaign' },
      { status: 500 },
    )
  }
}
