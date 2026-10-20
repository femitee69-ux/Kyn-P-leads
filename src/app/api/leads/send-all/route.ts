import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'
import { sendEmail } from '@/lib/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/leads/send-all
 * Sends ALL pending leads for a campaign in one request.
 * Each email is sent with a 2-second delay between them (to avoid Gmail rate limits).
 * Returns a summary of how many were sent vs failed.
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as { campaignId?: string }
    const campaignId = body.campaignId
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }

    const campaign = await db.campaign.findFirst({ where: { id: campaignId, userId } })
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get all pending leads
    const pendingLeads = await db.lead.findMany({
      where: { campaignId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 10, // Max 10 per call (to stay within 60s timeout)
    })

    if (pendingLeads.length === 0) {
      return NextResponse.json({
        campaignId,
        sent: 0,
        failed: 0,
        message: 'No pending leads to send.',
      })
    }

    // Get Gmail accounts
    const gmails = await db.gmailAccount.findMany({
      where: { userId, active: true },
      orderBy: { slot: 'asc' },
    })

    const results = { sent: 0, failed: 0, errors: [] as string[] }

    for (let i = 0; i < pendingLeads.length; i++) {
      const lead = pendingLeads[i]
      let slot: number | null = null

      if (gmails.length > 0) {
        const gmail = gmails[i % gmails.length]
        slot = gmail.slot

        try {
          await sendEmail({
            gmailAccountId: gmail.id,
            to: lead.email,
            subject: `${campaign.brand} × ${campaign.service}`,
            body: lead.message,
            fromName: 'Kyn\'P Leads',
          })

          // Email sent successfully
          await db.lead.update({
            where: { id: lead.id },
            data: { status: 'sent', sentAt: new Date(), gmailSlot: slot },
          })
          results.sent++
        } catch (e: any) {
          // Email failed to send
          await db.lead.update({
            where: { id: lead.id },
            data: { status: 'failed', gmailSlot: slot },
          })
          results.failed++
          results.errors.push(`${lead.email}: ${e.message.slice(0, 80)}`)
        }
      } else {
        // No Gmail linked — can't send
        await db.lead.update({
          where: { id: lead.id },
          data: { status: 'failed', gmailSlot: null },
        })
        results.failed++
        results.errors.push(`${lead.email}: No Gmail linked`)
      }

      // Small delay between sends (avoid Gmail rate limits)
      if (i < pendingLeads.length - 1) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    return NextResponse.json({
      campaignId,
      ...results,
      totalProcessed: pendingLeads.length,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    console.error('[leads/send-all] error', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
