import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'
import { sendEmail } from '@/lib/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as {
      campaignId?: string
      leads?: Array<{ name?: string; email?: string; company?: string; message?: string }>
      gmailSlots?: number[]
    }
    if (!body.campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    if (!body.leads || body.leads.length === 0) return NextResponse.json({ error: 'No leads' }, { status: 400 })
    if (!body.gmailSlots || body.gmailSlots.length === 0) return NextResponse.json({ error: 'Select Gmails' }, { status: 400 })

    const campaign = await db.campaign.findFirst({ where: { id: body.campaignId, userId } })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const validLeads = body.leads
      .filter(l => l.email && emailRegex.test(l.email!.trim()))
      .map(l => ({ name: (l.name || 'Unknown').trim(), email: l.email!.trim().toLowerCase(), company: (l.company || '').trim(), message: (l.message || '').trim() }))

    if (validLeads.length === 0) return NextResponse.json({ error: 'No leads with valid emails' }, { status: 400 })

    await db.lead.createMany({
      data: validLeads.map(l => ({
        campaignId: body.campaignId!, name: l.name, email: l.email, company: l.company, position: null,
        country: campaign.country,
        message: l.message || `Hi ${l.company || l.name},\n\nI came across your business and wanted to reach out.\n\nLooking forward to connecting.`,
        followUpMessage: null, status: 'pending',
      })),
    })

    const gmails = await db.gmailAccount.findMany({ where: { userId, active: true, slot: { in: body.gmailSlots } }, orderBy: { slot: 'asc' } })
    if (gmails.length === 0) return NextResponse.json({ error: 'No active Gmails' }, { status: 400 })

    let dispatched = 0, failed = 0
    const errors: string[] = []
    for (let i = 0; i < validLeads.length; i++) {
      const lead = validLeads[i]
      const gmail = gmails[i % gmails.length]
      try {
        await sendEmail({ gmailAccountId: gmail.id, to: lead.email, subject: `${campaign.brand} — ${campaign.service}`, body: lead.message })
        await db.lead.updateMany({ where: { campaignId: body.campaignId!, email: lead.email, status: 'pending' }, data: { status: 'sent', sentAt: new Date(), gmailSlot: gmail.slot } })
        dispatched++
      } catch (e: any) {
        await db.lead.updateMany({ where: { campaignId: body.campaignId!, email: lead.email, status: 'pending' }, data: { status: 'failed', gmailSlot: gmail.slot } })
        failed++
        errors.push(`${lead.email}: ${e.message.slice(0, 80)}`)
      }
      if (i < validLeads.length - 1) await new Promise(r => setTimeout(r, 2000))
    }

    return NextResponse.json({ saved: validLeads.length, skipped: body.leads.length - validLeads.length, dispatched, failed, errors: errors.slice(0, 5), gmailsUsed: gmails.map(g => g.email) })
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
