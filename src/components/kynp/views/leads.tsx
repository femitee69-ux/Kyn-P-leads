'use client'

import * as React from 'react'
import { useKynpStore } from '@/store/kynp'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Upload,
  Mail,
  Send,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeadRow {
  id: string
  name: string
  email: string
  company: string
  position: string | null
  status: 'pending' | 'sent' | 'followed_up' | 'failed'
  message: string
  followUpMessage: string | null
  sentAt: string | null
  followedUpAt: string | null
  gmailSlot: number | null
  createdAt: string
}
interface LeadsResp {
  campaign: { id: string; status: string; country: string; brand: string; service: string; followUp: boolean } | null
  leads: LeadRow[]
  stats: { total: number; pending: number; sent: number; followedUp: number; failed: number }
}

async function fetchLeads(campaignId?: string): Promise<LeadsResp> {
  const url = new URL('/api/leads/list', window.location.origin)
  if (campaignId) url.searchParams.set('campaignId', campaignId)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error('fetch failed')
  return res.json()
}

const STATUS_META = {
  pending: { label: 'Queued', color: 'text-muted-foreground', dot: 'bg-muted-foreground/40' },
  sent: { label: 'Sent', color: 'text-kynp-yellow', dot: 'bg-kynp-yellow' },
  followed_up: { label: 'Followed up', color: 'text-emerald-500', dot: 'bg-emerald-500' },
  failed: { label: 'Failed', color: 'text-red-500', dot: 'bg-red-500' },
}

export function LeadsView() {
  const { campaignId, setStats, setRecent, pushLog, isDispatching, setDispatching } = useKynpStore()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<LeadsResp>({
    queryKey: ['leads', campaignId],
    queryFn: () => fetchLeads(campaignId ?? undefined),
    refetchInterval: 3000,
    enabled: !!campaignId,
  })

  // Upload state
  const [uploading, setUploading] = React.useState(false)
  const [fileData, setFileData] = React.useState<Array<{ name: string; email: string; company: string; message: string }>>([])
  const [gmailSlots, setGmailSlots] = React.useState<number[]>([])
  const [showUpload, setShowUpload] = React.useState(false)

  // Fetch Gmails
  const { data: gmailsData } = useQuery({
    queryKey: ['gmails'],
    queryFn: async () => {
      const res = await fetch('/api/gmails', { cache: 'no-store' })
      if (!res.ok) throw new Error('failed')
      return res.json()
    },
  })

  React.useEffect(() => {
    if (data?.stats) {
      setStats({
        total: data.stats.total,
        sent: data.stats.sent,
        followedUp: data.stats.followedUp,
        pending: data.stats.pending,
        failed: data.stats.failed,
      })
    }
  }, [data?.stats, setStats])

  const handleManualDispatch = async () => {
    if (!campaignId) return
    setDispatching(true)
    pushLog('Dispatching 1 lead...')
    try {
      const res = await fetch('/api/leads/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'dispatch failed')
      if (json.sent) {
        pushLog(`Sent to ${json.sent.name} <${json.sent.email}> · Gmail slot ${json.sent.gmailSlot ?? '—'}`)
      }
      qc.invalidateQueries({ queryKey: ['leads', campaignId] })
      qc.invalidateQueries({ queryKey: ['status'] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDispatching(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())

    // Parse CSV — detect header
    const leads: Array<{ name: string; email: string; company: string; message: string }> = []
    let nameIdx = 0, emailIdx = 1, companyIdx = 2, messageIdx = 3
    let hasHeader = false

    const firstLine = lines[0].toLowerCase()
    if (firstLine.includes('email') || firstLine.includes('name') || firstLine.includes('company')) {
      hasHeader = true
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      nameIdx = headers.findIndex(h => h.includes('name'))
      emailIdx = headers.findIndex(h => h.includes('email'))
      companyIdx = headers.findIndex(h => h.includes('company'))
      messageIdx = headers.findIndex(h => h.includes('message') || h.includes('body'))
    }

    // Ensure default indices
    if (nameIdx === -1) nameIdx = 0
    if (emailIdx === -1) emailIdx = 1
    if (companyIdx === -1) companyIdx = 2
    if (messageIdx === -1) messageIdx = 3

    const startLine = hasHeader ? 1 : 0
    for (let i = startLine; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      if (cols.length < 2) continue
      leads.push({
        name: (cols[nameIdx] || '').trim(),
        email: (cols[emailIdx] || '').trim(),
        company: (cols[companyIdx] || '').trim(),
        message: (cols[messageIdx] || '').trim(),
      })
    }

    setFileData(leads)
    toast.success(`Parsed ${leads.length} leads from file. ${leads.filter(l => l.email).length} have emails.`)
  }

  const activeGmails = (gmailsData?.gmails ?? []).filter((g: any) => g.active)

  // Auto-create a campaign if none exists (for upload feature)
  const handleUploadAndSendWithCampaign = async () => {
    if (!campaignId) {
      // Auto-create a campaign first
      try {
        const res = await fetch('/api/campaigns/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country: 'Upload',
            brand: 'Uploaded Leads',
            service: 'Direct Outreach',
            targetLeads: fileData.length || 100,
            followUp: false,
            gmailSlots,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to create campaign')
        setCampaign(json.campaignId, 'running')
        // Now upload + send
        await handleUploadAndSend(json.campaignId)
      } catch (e: any) {
        toast.error(e.message)
      }
    } else {
      await handleUploadAndSend(campaignId)
    }
  }

  const handleUploadAndSend = async (cid?: string) => {
    const id = cid || campaignId
    if (!id) {
      toast.error('Start a campaign first.')
      return
    }
    if (fileData.length === 0) {
      toast.error('No leads to upload.')
      return
    }
    if (gmailSlots.length === 0) {
      toast.error('Select at least 1 Gmail to send from.')
      return
    }

    setUploading(true)
    pushLog(`Uploading ${fileData.length} leads and sending via ${gmailSlots.length} Gmail(s)...`)

    try {
      const res = await fetch('/api/leads/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: id, leads: fileData, gmailSlots }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'upload failed')

      toast.success(`Sent ${json.dispatched} emails, ${json.failed} failed. Check your Gmail Sent folder.`)
      pushLog(`Upload complete: ${json.saved} saved, ${json.dispatched} sent, ${json.failed} failed.`)
      setFileData([])
      qc.invalidateQueries({ queryKey: ['leads', id] })
      qc.invalidateQueries({ queryKey: ['status'] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Leads</h1>

      {/* Upload section — always visible */}
      <div className="rounded-lg border border-kynp-yellow/30 bg-kynp-yellow/[0.04] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="size-4 text-kynp-yellow" />
          <p className="text-sm font-medium">Upload Leads File</p>
        </div>

        <div className="space-y-2">
          <label className="block">
            <span className="text-xs text-muted-foreground">CSV format: name, email, company, message (one per line)</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="mt-1 w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-kynp-yellow file:px-4 file:py-2.5 file:text-kynp-black file:font-semibold file:cursor-pointer hover:file:brightness-110"
            />
          </label>
        </div>

        {fileData.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {fileData.length} leads parsed. {fileData.filter(l => l.email).length} have valid emails.
            </p>

            {activeGmails.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Select Gmail(s) to send from:</p>
                <div className="flex flex-wrap gap-2">
                  {activeGmails.map((g: any) => (
                    <label key={g.slot} className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs cursor-pointer',
                      gmailSlots.includes(g.slot) ? 'border-kynp-yellow bg-kynp-yellow/10' : 'border-foreground/15'
                    )}>
                      <input
                        type="checkbox"
                        checked={gmailSlots.includes(g.slot)}
                        onChange={(e) => {
                          setGmailSlots(e.target.checked
                            ? [...gmailSlots, g.slot]
                            : gmailSlots.filter(s => s !== g.slot))
                        }}
                        className="size-3 accent-kynp-yellow"
                      />
                      {g.email}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleUploadAndSendWithCampaign}
              disabled={uploading || gmailSlots.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-kynp-black text-kynp-yellow px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {uploading ? 'Sending...' : `Send to ${fileData.filter(l => l.email).length} leads`}
            </button>
          </div>
        )}
      </div>

      {campaignId && (
        <>
          {/* Stats */}
          {data?.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Total" value={data.stats.total} />
              <MiniStat label="Pending" value={data.stats.pending} />
              <MiniStat label="Sent" value={data.stats.sent} accent />
              <MiniStat label="Failed" value={data.stats.failed} />
            </div>
          )}

          {/* Dispatch button */}
          <button
            onClick={handleManualDispatch}
            disabled={isDispatching}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground/10 hover:bg-foreground/15 px-3 py-2 text-xs font-medium disabled:opacity-50"
          >
            {isDispatching ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send 1 now
          </button>

          {/* Lead list */}
          <div className="rounded-lg border border-foreground/10 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-foreground/10 text-xs text-muted-foreground">
              30s auto-dispatch · tap any lead to view message
            </div>
            {isLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : data && data.leads.length > 0 ? (
              <ul className="divide-y divide-foreground/10 max-h-[600px] overflow-y-auto kynp-scroll">
                {data.leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
              </ul>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">No leads yet. Upload a file above.</div>
            )}
          </div>
        </>
      )}

      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Total" value={data.stats.total} />
          <MiniStat label="Pending" value={data.stats.pending} />
          <MiniStat label="Sent" value={data.stats.sent} accent />
          <MiniStat label="Failed" value={data.stats.failed} />
        </div>
      )}

      {/* Lead list */}
      <div className="rounded-lg border border-foreground/10 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-foreground/10 text-xs text-muted-foreground">
          30s auto-dispatch · tap any lead to view message
        </div>
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : data && data.leads.length > 0 ? (
          <ul className="divide-y divide-foreground/10 max-h-[600px] overflow-y-auto kynp-scroll">
            {data.leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">No leads yet.</div>
        )}
      </div>
    </section>
  )
}

function LeadCard({ lead }: { lead: LeadRow }) {
  const [expanded, setExpanded] = React.useState(false)
  const meta = STATUS_META[lead.status] ?? STATUS_META.pending

  return (
    <li>
      <button onClick={() => setExpanded(v => !v)} className="w-full text-left px-4 py-3 hover:bg-foreground/[0.02]">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-full bg-kynp-yellow/15 text-kynp-yellow text-[10px] font-semibold flex items-center justify-center shrink-0">
            {lead.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">{lead.name}</p>
              <span className={cn('text-[10px] inline-flex items-center gap-1 uppercase', meta.color)}>
                <span className={cn('size-1.5 rounded-full', meta.dot)} />{meta.label}
              </span>
              {lead.gmailSlot && <span className="text-[10px] text-muted-foreground">Gmail #{lead.gmailSlot}</span>}
              {lead.sentAt && <span className="text-[10px] text-muted-foreground">{new Date(lead.sentAt).toLocaleString()}</span>}
            </div>
            <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
          </div>
          {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 ml-11">
          <div className="rounded-md bg-foreground/[0.04] border border-foreground/10 px-3 py-2">
            <p className="text-xs whitespace-pre-wrap text-foreground/85 leading-relaxed">{lead.message}</p>
          </div>
        </div>
      )}
    </li>
  )
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-foreground/10 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums mt-0.5', accent && 'text-kynp-yellow')}>{value}</p>
    </div>
  )
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}
