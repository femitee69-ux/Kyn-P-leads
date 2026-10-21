import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'
import { sendEmail } from '@/lib/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/leads/upload
 * Body: { campaignId, leads: [{name, email, company, message}], gmailSlots: [1,3] }
 *
 * Uploads leads from a CSV/file. Only leads with valid emails are saved.
 * Then starts dispatching immediately — 1 email every 2 seconds via the
 * selected Gmails (rotating). All emails actually send via SMTP and
 * appear in the user's Gmail Sent folder.
 *
 * Returns: { saved, skipped, dispatched, failed }
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as {
      campaignId?: string
      leads?: Array<{ name?: string; email?: string; company?: string; message?: string }>
      gmailSlots?: number[]
    }

    if (!body.campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }
    if (!body.leads || body.leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 })
    }
    if (!body.gmailSlots || body.gmailSlots.length === 0) {
      return NextResponse.json({ error: 'Select at least 1 Gmail to send from' }, { status: 400 })
    }

    const campaign = await db.campaign.findFirst({
      where: { id: body.campaignId, userId },
    })
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Filter leads — only keep those with valid emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    let saved = 0
    let skipped = 0

    const validLeads: Array<{
      name: string
      email: string
      company: string
      message: string
    }> = []

    for (const lead of body.leads) {
      const email = (lead.email || '').trim().toLowerCase()
      if (!email || !emailRegex.test(email)) {
        skipped++
        continue
      }
      validLeads.push({
        name: (lead.name || 'Unknown').trim(),
        email,
        company: (lead.company || '').trim(),
        message: (lead.message || '').trim(),
      })
    }

    if (validLeads.length === 0) {
      return NextResponse.json({
        error: 'No leads with valid emails found. Make sure your file has an email column.',
        skipped,
      }, { status: 400 })
    }

    // Save leads to DB
    await db.lead.createMany({
      data: validLeads.map((l) => ({
        campaignId: body.campaignId!,
        name: l.name,
        email: l.email,
        company: l.company,
        position: null,
        country: campaign.country,
        message: l.message || `Hi ${l.company || l.name},\n\nI came across your business and wanted to reach out.\n\nLooking forward to connecting.`,
        followUpMessage: null,
        status: 'pending',
      })),
    })
    saved = validLeads.length

    // Get the selected Gmails
    const gmails = await db.gmailAccount.findMany({
      where: { userId, active: true, slot: { in: body.gmailSlots } },
      orderBy: { slot: 'asc' },
    })

    if (gmails.length === 0) {
      return NextResponse.json({ error: 'No active Gmails found for the selected slots' }, { status: 400 })
    }

    // Dispatch immediately — send emails with 2s delay between each
    let dispatched = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < validLeads.length; i++) {
      const lead = validLeads[i]
      const gmail = gmails[i % gmails.length]

      try {
        await sendEmail({
          gmailAccountId: gmail.id,
          to: lead.email,
          subject: `${campaign.brand} — ${campaign.service}`,
          body: lead.message,
        })

        // Mark as sent
        await db.lead.updateMany({
          where: { campaignId: body.campaignId!, email: lead.email, status: 'pending' },
          data: { status: 'sent', sentAt: new Date(), gmailSlot: gmail.slot },
        })
        dispatched++
      } catch (e: any) {
        // Mark as failed
        await db.lead.updateMany({
          where: { campaignId: body.campaignId!, email: lead.email, status: 'pending' },
          data: { status: 'failed', gmailSlot: gmail.slot },
        })
        failed++
        errors.push(`${lead.email}: ${e.message.slice(0, 80)}`)
      }

      // 2 second delay between sends (avoid Gmail rate limits)
      if (i < validLeads.length - 1) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    return NextResponse.json({
      saved,
      skipped,
      dispatched,
      failed,
      errors: errors.slice(0, 5),
      gmailsUsed: gmails.map(g => g.email),
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    console.error('[leads/upload] error', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
