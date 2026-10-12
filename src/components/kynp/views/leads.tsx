'use client'

import * as React from 'react'
import { useKynpStore } from '@/store/kynp'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Send,
  CornerUpRight,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Mail,
  Globe2,
  Building2,
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
  campaign: {
    id: string
    status: string
    country: string
    brand: string
    service: string
    followUp: boolean
  } | null
  leads: LeadRow[]
  stats: {
    total: number
    pending: number
    sent: number
    followedUp: number
    failed: number
  }
}

async function fetchLeads(campaignId?: string): Promise<LeadsResp> {
  const url = new URL('/api/leads/list', window.location.origin)
  if (campaignId) url.searchParams.set('campaignId', campaignId)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error('leads fetch failed')
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
  const { data, isLoading, refetch } = useQuery<LeadsResp>({
    queryKey: ['leads', campaignId],
    queryFn: () => fetchLeads(campaignId ?? undefined),
    refetchInterval: 3000,
    enabled: !!campaignId,
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
    pushLog('Manual dispatch triggered.')
    try {
      const res = await fetch('/api/leads/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'dispatch failed')
      if (json.sent) {
        const sent = json.sent
        setRecent({
          id: sent.id,
          name: sent.name,
          email: sent.email,
          company: sent.company,
          position: sent.position,
          status: sent.status,
          kind: sent.kind ?? 'initial',
          gmailSlot: sent.gmailSlot,
          message: sent.message,
          sentAt: sent.sentAt,
        })
        pushLog(`Dispatched to ${sent.name} <${sent.email}> · Gmail slot ${sent.gmailSlot ?? '—'}`)
      } else {
        pushLog('No more leads to dispatch.')
      }
      qc.invalidateQueries({ queryKey: ['leads', campaignId] })
      qc.invalidateQueries({ queryKey: ['status'] })
    } catch (e: any) {
      toast.error(e.message)
      pushLog(`Error: ${e.message}`)
    } finally {
      setDispatching(false)
    }
  }

  if (!campaignId) {
    return (
      <section className="space-y-4">
        <p className="kynp-eyebrow text-kynp-yellow">Leads &amp; Messages</p>
        <h1 className="text-2xl font-semibold">No campaign running.</h1>
        <p className="text-sm text-muted-foreground">Start a campaign to populate the live queue.</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="kynp-eyebrow text-kynp-yellow">Leads &amp; Messages</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {data?.campaign ? (
              <>
                {data.campaign.country} &middot;{' '}
                <span className="text-kynp-yellow">{data.campaign.brand}</span>
              </>
            ) : 'Live queue'}
          </h1>
        </div>
        <button
          onClick={handleManualDispatch}
          disabled={isDispatching}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground/10 hover:bg-foreground/15 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {isDispatching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Dispatch now
        </button>
      </div>

      {data?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Total" value={data.stats.total} />
          <MiniStat label="Queued" value={data.stats.pending} />
          <MiniStat label="Sent" value={data.stats.sent} accent />
          <MiniStat label="Followed up" value={data.stats.followedUp} accent />
        </div>
      )}

      {/* Live queue */}
      <div className="rounded-2xl border border-foreground/10 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-foreground/10 flex items-center justify-between bg-foreground/[0.02]">
          <p className="text-sm font-medium">Outreach queue</p>
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            <Clock className="size-3" /> auto-dispatch every 30s · tap any lead to view message
          </span>
        </div>
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : data && data.leads.length > 0 ? (
          <ul className="divide-y divide-foreground/10 max-h-[640px] overflow-y-auto kynp-scroll">
            {data.leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </ul>
        ) : (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No leads yet — start a campaign to populate the queue.
          </div>
        )}
      </div>
    </section>
  )
}

function LeadCard({ lead }: { lead: LeadRow }) {
  const [expanded, setExpanded] = React.useState(false)
  const meta = STATUS_META[lead.status] ?? STATUS_META.pending
  const initials = lead.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  const hasFollowUp = lead.followUpMessage && lead.status === 'followed_up'

  return (
    <li>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 hover:bg-foreground/[0.02] transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-full bg-kynp-yellow/15 text-kynp-yellow text-xs font-semibold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">{lead.name}</p>
              <span className={cn('text-[11px] inline-flex items-center gap-1 uppercase tracking-wider', meta.color)}>
                <span className={cn('size-1.5 rounded-full', meta.dot)} />
                {meta.label}
              </span>
              {lead.gmailSlot && (
                <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <Mail className="size-2.5" /> Gmail #{lead.gmailSlot}
                </span>
              )}
              {lead.sentAt && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(lead.sentAt).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {lead.email} · {lead.company} {lead.position ? `· ${lead.position}` : ''}
            </p>
            <p className={cn('text-xs mt-2 text-foreground/70', !expanded && 'line-clamp-2')}>
              {lead.message.split('\n')[0]}{lead.message.split('\n')[1] ? '...' : ''}
            </p>
          </div>
          <div className="shrink-0 mt-1">
            {expanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded view — full message + follow-up */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 ml-12 space-y-3">
          {/* Lead metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Globe2 className="size-3" /> {lead.email}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="size-3" /> {lead.company}
            </div>
            {lead.position && (
              <div className="text-muted-foreground">{lead.position}</div>
            )}
          </div>

          {/* Initial message */}
          <div className="rounded-lg bg-foreground/[0.04] border border-foreground/10 px-3.5 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-kynp-yellow inline-flex items-center gap-1">
                <Send className="size-3" /> Initial message
                {lead.sentAt && (
                  <span className="text-muted-foreground ml-2 normal-case tracking-normal">
                    · sent {new Date(lead.sentAt).toLocaleString()}
                  </span>
                )}
              </p>
            </div>
            <p className="text-xs whitespace-pre-wrap text-foreground/90 leading-relaxed">
              {lead.message}
            </p>
          </div>

          {/* Follow-up message */}
          {lead.followUpMessage && (
            <div className={cn(
              'rounded-lg border px-3.5 py-3',
              hasFollowUp
                ? 'bg-emerald-500/[0.04] border-emerald-500/20'
                : 'bg-foreground/[0.02] border-foreground/10',
            )}>
              <p className={cn(
                'text-[10px] uppercase tracking-wider mb-2 inline-flex items-center gap-1',
                hasFollowUp ? 'text-emerald-500' : 'text-muted-foreground',
              )}>
                <CornerUpRight className="size-3" />
                {hasFollowUp ? 'Follow-up sent' : 'Follow-up ready (24h after initial)'}
                {lead.followedUpAt && (
                  <span className="ml-2 normal-case tracking-normal text-muted-foreground">
                    · sent {new Date(lead.followedUpAt).toLocaleString()}
                  </span>
                )}
              </p>
              <p className="text-xs whitespace-pre-wrap text-foreground/90 leading-relaxed">
                {lead.followUpMessage}
              </p>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-foreground/10 px-3.5 py-3 bg-foreground/[0.02]">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-semibold tabular-nums mt-0.5', accent && 'text-kynp-yellow')}>{value}</p>
    </div>
  )
}
