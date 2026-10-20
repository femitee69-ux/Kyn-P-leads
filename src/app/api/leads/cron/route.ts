import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/gmail'
import { generateMoreLeads } from '@/lib/leads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const FOLLOW_UP_DELAY_MS = 24 * 60 * 60 * 1000

/**
 * GET /api/leads/cron?campaignId=xxx&token=yyy
 *
 * SERVER-SIDE DISPATCH — works even when the browser is closed.
 * Called every 30 seconds by an external cron service (cron-job.org).
 *
 * Flow:
 * 1. Verify campaignId + cronToken (no user auth needed)
 * 2. Check if target leads reached → if yes, mark completed + stop
 * 3. Pick next pending lead → send via Gmail (SMTP or OAuth)
 * 4. If queue low + total < target → generate 10 more leads from Serper
 * 5. Return summary
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const campaignId = url.searchParams.get('campaignId')
    const token = url.searchParams.get('token')

    if (!campaignId || !token) {
      return NextResponse.json({ error: 'campaignId and token required' }, { status: 400 })
    }

    const campaign = await db.campaign.findUnique({ where: { id: campaignId } })
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.cronToken !== token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
    if (campaign.status !== 'running') {
      return NextResponse.json({
        campaignId,
        status: campaign.status,
        action: 'idle',
        message: 'Campaign not running — cron skipping.',
      })
    }

    // Check if target reached
    const totalLeads = await db.lead.count({ where: { campaignId } })
    if (totalLeads >= campaign.targetLeads) {
      // Target reached — check if all leads are dispatched
      const pendingCount = await db.lead.count({ where: { campaignId, status: 'pending' } })
      if (pendingCount === 0) {
        await db.campaign.update({
          where: { id: campaignId },
          data: { status: 'completed', completedAt: new Date() },
        })
        return NextResponse.json({
          campaignId,
          status: 'completed',
          action: 'target_reached',
          totalLeads,
          targetLeads: campaign.targetLeads,
          message: `Target of ${campaign.targetLeads} leads reached. Campaign completed.`,
        })
      }
    }

    // Pick next pending lead
    const next = await db.lead.findFirst({
      where: { campaignId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })

    // Generate more leads if queue is low
    if (!next || (await db.lead.count({ where: { campaignId, status: 'pending' } })) < 5) {
      if (totalLeads < campaign.targetLeads) {
        try {
          const moreLeads = await generateMoreLeads(
            campaign.userId,
            { country: campaign.country, brand: campaign.brand, service: campaign.service },
            totalLeads,
            10,
          )
          if (moreLeads.length > 0) {
            await db.lead.createMany({
              data: moreLeads.map((l) => ({
                campaignId,
                name: l.name,
                email: l.email,
                company: l.company,
                position: l.position ?? null,
                country: campaign.country,
                message: l.message,
                followUpMessage: l.followUpMessage ?? null,
                status: 'pending',
              })),
            })
          }
        } catch (e: any) {
          console.warn('[cron] Lead generation failed:', e.message)
        }
      }
    }

    if (!next) {
      // Check for 24h+ follow-ups
      if (campaign.followUp) {
        const cutoff = new Date(Date.now() - FOLLOW_UP_DELAY_MS)
        const follow = await db.lead.findFirst({
          where: { campaignId, status: 'sent', followUpMessage: { not: null }, sentAt: { lte: cutoff } },
          orderBy: { sentAt: 'asc' },
        })
        if (follow) {
          const gmails = await db.gmailAccount.findMany({
            where: { userId: campaign.userId, active: true },
            orderBy: { slot: 'asc' },
          })
          let gmailSlot: number | null = null
          if (gmails.length > 0) {
            const idx = await db.lead.count({ where: { campaignId, status: 'followed_up' } })
            const gmail = gmails[idx % gmails.length]
            gmailSlot = gmail.slot
            try {
              await sendEmail({
                gmailAccountId: gmail.id,
                to: follow.email,
                subject: `Re: ${campaign.brand}`,
                body: follow.followUpMessage || '',
              })
            } catch (e: any) {
              console.warn('[cron] Follow-up send failed:', e.message)
            }
          }
          await db.lead.update({
            where: { id: follow.id },
            data: { status: 'followed_up', followedUpAt: new Date(), gmailSlot },
          })
          return NextResponse.json({
            campaignId,
            action: 'follow_up_sent',
            lead: follow.email,
            totalLeads: await db.lead.count({ where: { campaignId } }),
            targetLeads: campaign.targetLeads,
          })
        }
      }

      await db.campaign.update({
        where: { id: campaignId },
        data: { status: 'completed', completedAt: new Date() },
      })
      return NextResponse.json({
        campaignId,
        status: 'completed',
        action: 'queue_empty',
        totalLeads,
        targetLeads: campaign.targetLeads,
      })
    }

    // Dispatch the lead
    const gmails = await db.gmailAccount.findMany({
      where: { userId: campaign.userId, active: true },
      orderBy: { slot: 'asc' },
    })

    let slot: number | null = null
    let emailSent = false
    let sendError: string | undefined

    if (gmails.length > 0) {
      const alreadySent = await db.lead.count({
        where: { campaignId, NOT: { status: 'pending' } },
      })
      const gmail = gmails[alreadySent % gmails.length]
      slot = gmail.slot
      try {
        await sendEmail({
          gmailAccountId: gmail.id,
          to: next.email,
          subject: `${campaign.brand} — ${campaign.service}`,
          body: next.message,
        })
        emailSent = true
      } catch (e: any) {
        sendError = e.message
      }
    }

    await db.lead.update({
      where: { id: next.id },
      data: {
        status: emailSent ? 'sent' : 'failed',
        sentAt: emailSent ? new Date() : null,
        gmailSlot: slot,
      },
    })

    return NextResponse.json({
      campaignId,
      action: 'dispatched',
      lead: { name: next.name, email: next.email, company: next.company },
      gmailSlot: slot,
      emailSent,
      sendError,
      totalLeads: await db.lead.count({ where: { campaignId } }),
      pending: await db.lead.count({ where: { campaignId, status: 'pending' } }),
      targetLeads: campaign.targetLeads,
    })
  } catch (err) {
    console.error('[cron] error', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
