import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'
import { sendEmail } from '@/lib/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Follow-ups only fire after this delay (24 hours in ms). */
const FOLLOW_UP_DELAY_MS = 24 * 60 * 60 * 1000

/**
 * POST /api/leads/send
 * Dispatches the next queued message for a running campaign.
 * Rotates Gmail accounts round-robin via the slot field.
 * Sends via OAuth (Gmail API) OR SMTP (App Password) — both work and both
 * result in the email appearing in the user's Gmail Sent folder.
 * Follow-ups are dispatched only after 24h of no response.
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as { campaignId?: string }
    const campaignId = body.campaignId
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }

    const campaign = await db.campaign.findFirst({
      where: { id: campaignId, userId },
    })
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.status !== 'running') {
      return NextResponse.json({
        campaignId,
        status: campaign.status,
        sent: null,
        reason: 'campaign not running',
      })
    }

    // Pick the next pending lead
    const next = await db.lead.findFirst({
      where: { campaignId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })

    if (!next) {
      // Initial sends done — check for 24h+ follow-ups
      if (campaign.followUp) {
        const cutoff = new Date(Date.now() - FOLLOW_UP_DELAY_MS)
        const follow = await db.lead.findFirst({
          where: {
            campaignId,
            status: 'sent',
            followUpMessage: { not: null },
            sentAt: { lte: cutoff },
          },
          orderBy: { sentAt: 'asc' },
        })
        if (follow) {
          const gmails = await db.gmailAccount.findMany({
            where: { userId, active: true },
            orderBy: { slot: 'asc' },
          })
          let gmailSlot: number | null = null
          let sendError: string | undefined
          if (gmails.length > 0) {
            const idx = await db.lead.count({
              where: { campaignId, status: 'followed_up' },
            })
            const gmail = gmails[idx % gmails.length]
            gmailSlot = gmail.slot
            try {
              await sendEmail({
                gmailAccountId: gmail.id,
                to: follow.email,
                subject: `Re: Outreach — ${campaign.brand} × ${campaign.service}`,
                body: follow.followUpMessage || '',
                fromName: 'Kyn\'P Leads',
              })
            } catch (e: any) {
              sendError = e.message
              console.warn('[leads/send] follow-up send failed:', sendError)
            }
          }
          await db.lead.update({
            where: { id: follow.id },
            data: {
              status: 'followed_up',
              followedUpAt: new Date(),
              gmailSlot,
            },
          })
          const remainingInitial = await db.lead.count({
            where: { campaignId, status: 'pending' },
          })
          const remainingFollowups = await db.lead.count({
            where: {
              campaignId,
              status: 'sent',
              followUpMessage: { not: null },
              sentAt: { lte: cutoff },
            },
          })
          if (remainingInitial === 0 && remainingFollowups === 0) {
            await db.campaign.update({
              where: { id: campaignId },
              data: { status: 'completed', completedAt: new Date() },
            })
          }
          const stats = await computeStats(campaignId)
          return NextResponse.json({
            campaignId,
            sent: { ...follow, status: 'followed_up', kind: 'follow_up', gmailSlot, sendError },
            stats,
          })
        }
      }

      // Nothing left to dispatch — mark complete
      await db.campaign.update({
        where: { id: campaignId },
        data: { status: 'completed', completedAt: new Date() },
      })
      return NextResponse.json({ campaignId, status: 'completed', sent: null })
    }

    // Pick a Gmail slot round-robin from the user's linked accounts
    const gmails = await db.gmailAccount.findMany({
      where: { userId, active: true },
      orderBy: { slot: 'asc' },
    })
    let slot: number | null = null
    let sendError: string | undefined
    if (gmails.length > 0) {
      const alreadySent = await db.lead.count({
        where: { campaignId, NOT: { status: 'pending' } },
      })
      const gmail = gmails[alreadySent % gmails.length]
      slot = gmail.slot
      // Send via OAuth OR SMTP — sendEmail auto-detects the best method
      try {
        await sendEmail({
          gmailAccountId: gmail.id,
          to: next.email,
          subject: `${campaign.brand} × ${campaign.service}`,
          body: next.message,
          fromName: 'Kyn\'P Leads',
        })
      } catch (e: any) {
        sendError = e.message
        console.warn('[leads/send] gmail send failed:', sendError)
      }
    }

    const now = new Date()
    const updated = await db.lead.update({
      where: { id: next.id },
      data: { status: 'sent', sentAt: now, gmailSlot: slot },
    })

    const stats = await computeStats(campaignId)
    return NextResponse.json({
      campaignId,
      sent: { ...updated, kind: 'initial', gmailSlot: slot, sendError },
      stats,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    console.error('[leads/send] error', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

async function computeStats(campaignId: string) {
  const [total, sentCount, followedUpCount, remaining] = await Promise.all([
    db.lead.count({ where: { campaignId } }),
    db.lead.count({ where: { campaignId, status: 'sent' } }),
    db.lead.count({ where: { campaignId, status: 'followed_up' } }),
    db.lead.count({ where: { campaignId, status: 'pending' } }),
  ])
  return { total, sent: sentCount, followedUp: followedUpCount, remaining }
}
