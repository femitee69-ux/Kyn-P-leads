'use client'

import * as React from 'react'
import { useKynpStore } from '@/store/kynp'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Mail,
  Send,
  CornerUpRight,
  Clock,
  CheckCircle2,
  Hourglass,
  XCircle,
  RefreshCw,
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
  pending: { label: 'Queued', icon: Hourglass, color: 'text-muted-foreground', dot: 'bg-muted-foreground/40' },
  sent: { label: 'Sent', icon: Send, color: 'text-kynp-yellow', dot: 'bg-kynp-yellow' },
  followed_up: { label: 'Followed up', icon: CornerUpRight, color: 'text-emerald-400', dot: 'bg-emerald-400' },
  failed: { label: 'Failed', icon: XCircle, color: 'text-red-400', dot: 'bg-red-400' },
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
  }, [data?.stats])

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
        pushLog(`Dispatched to ${sent.name} <${sent.email}> (Gmail slot ${sent.gmailSlot})`)
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

      {/* Stat row */}
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
            <Clock className="size-3" /> auto-dispatch every 30s
          </span>
        </div>
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : data && data.leads.length > 0 ? (
          <ul className="divide-y divide-foreground/10 max-h-[640px] overflow-y-auto kynp-scroll">
            {data.leads.map((lead) => {
              const meta = STATUS_META[lead.status] ?? STATUS_META.pending
              const Icon = meta.icon
              return (
                <li key={lead.id} className="px-5 py-4 hover:bg-foreground/[0.02] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-full bg-kynp-yellow/15 text-kynp-yellow text-xs font-semibold flex items-center justify-center shrink-0">
                      {lead.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{lead.name}</p>
                        <span className={cn('text-[11px] inline-flex items-center gap-1 uppercase tracking-wider', meta.color)}>
                          <Icon className="size-3" /> {meta.label}
                        </span>
                        {lead.gmailSlot && (
                          <span className="text-[10px] text-muted-foreground">Gmail #{lead.gmailSlot}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {lead.email} · {lead.company} {lead.position ? `· ${lead.position}` : ''}
                      </p>
                    </div>
                  </div>
                  {/* Message preview */}
                  <div className="mt-3 ml-12 rounded-lg bg-foreground/[0.04] border border-foreground/10 px-3.5 py-3">
                    <p className="text-xs whitespace-pre-wrap text-foreground/85 line-clamp-4">{lead.message}</p>
                    {lead.followUpMessage && lead.status === 'followed_up' && (
                      <div className="mt-3 pt-3 border-t border-foreground/10">
                        <p className="text-[10px] uppercase tracking-wider text-kynp-yellow mb-1">Follow-up</p>
                        <p className="text-xs whitespace-pre-wrap text-foreground/85 line-clamp-3">{lead.followUpMessage}</p>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
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

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-foreground/10 px-3.5 py-3 bg-foreground/[0.02]">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-semibold tabular-nums mt-0.5', accent && 'text-kynp-yellow')}>{value}</p>
    </div>
  )
}
