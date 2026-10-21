'use client'

import * as React from 'react'
import { useKynpStore } from '@/store/kynp'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Play,
  Square,
  Mail,
  Send,
  CornerUpRight,
  Globe2,
  Tag,
  Briefcase,
  ArrowRight,
  Activity,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusResp {
  gmails: { count: number; slots: number[] }
  apiKeys: { count: number; slots: number[] }
  campaign: {
    id: string
    status: string
    country: string
    brand: string
    service: string
    followUp: boolean
    startedAt: string | null
  } | null
  sentToday: number
  followedUpToday: number
}

async function fetchStatus(): Promise<StatusResp> {
  const res = await fetch('/api/status', { cache: 'no-store' })
  if (!res.ok) throw new Error('status failed')
  return res.json()
}

export function DashboardView() {
  const {
    setView,
    campaignId, campaignStatus,
    isDispatching,
    setCampaign, pushLog,
  } = useKynpStore()
  const qc = useQueryClient()
  const { data } = useQuery<StatusResp>({
    queryKey: ['status'],
    queryFn: fetchStatus,
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
  })

  React.useEffect(() => {
    if (data?.campaign) {
      setCampaign(data.campaign.id, data.campaign.status as any)
    }
  }, [data?.campaign?.id, data?.campaign?.status])

  const hasCampaign = !!data?.campaign
  const isRunning = campaignStatus === 'running'
  const isComplete = campaignStatus === 'completed'

  const handleStop = async () => {
    if (!campaignId) return
    try {
      const res = await fetch('/api/campaigns/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Stop failed')
      setCampaign(campaignId, 'paused')
      pushLog(`Campaign paused.`)
      toast.success('Campaign paused.')
      qc.invalidateQueries({ queryKey: ['status'] })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // Gmails are optional — Start is allowed with 0 gmails (we'll just log messages instead of sending).
  const ready = (data?.apiKeys.count ?? 0) > 0

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Readiness gates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Gate
          ok={(data?.gmails.count ?? 0) > 0}
          count={`${data?.gmails.count ?? 0}/5`}
          label="Gmail accounts"
          sub="optional"
          icon={<Mail className="size-3.5" />}
          onClick={() => setView('gmails')}
        />
        <Gate
          ok={(data?.apiKeys.count ?? 0) > 0}
          count={`${data?.apiKeys.count ?? 0}/3`}
          label="API keys"
          sub="Serper.dev"
          icon={<Tag className="size-3.5" />}
          onClick={() => setView('apikeys')}
        />
        <Gate
          ok={hasCampaign}
          count={hasCampaign ? '1' : '0'}
          label="Active campaign"
          sub={data?.campaign ? data.campaign.country : 'none yet'}
          icon={<Briefcase className="size-3.5" />}
          onClick={() => setView('campaign')}
        />
        <Gate
          ok={isRunning}
          count={isRunning ? 'LIVE' : isComplete ? 'DONE' : 'IDLE'}
          label="Dispatch engine"
          sub={isRunning ? '30s cadence' : 'standing by'}
          icon={<Activity className="size-3.5" />}
          onClick={() => setView('leads')}
        />
      </div>

      {/* Live campaign block */}
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between border-b border-foreground/10">
          <div className="space-y-1">
            
            {data?.campaign ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Globe2 className="size-3.5 text-kynp-yellow" /> {data.campaign.country}
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Tag className="size-3.5 text-kynp-yellow" /> {data.campaign.brand}
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="inline-flex items-center gap-1.5 font-medium truncate max-w-[260px]">
                  <Briefcase className="size-3.5 text-kynp-yellow" /> {data.campaign.service}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No campaign yet &mdash; head to &ldquo;New Campaign&rdquo; to set one up.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isRunning ? (
              <button
                onClick={handleStop}
                disabled={isDispatching}
                className="inline-flex items-center gap-2 rounded-lg bg-foreground/10 hover:bg-foreground/15 text-foreground px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Square className="size-3.5 fill-current" /> Stop
              </button>
            ) : (
              <button
                onClick={() => setView('campaign')}
                disabled={!ready}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all',
                  ready
                    ? 'bg-kynp-yellow text-kynp-black hover:brightness-110 shadow-[0_0_0_1px_rgba(245,197,24,0.4)]'
                    : 'bg-foreground/10 text-muted-foreground cursor-not-allowed',
                )}
              >
                <Play className="size-3.5 fill-current" />
                {hasCampaign ? (isComplete ? 'Start a new one' : 'Resume campaign') : 'Start Campaign'}
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-foreground/10 border-t border-foreground/10">
          <Stat label="Sent today" value={data?.sentToday ?? 0} icon={<Send className="size-3.5" />} />
          <Stat label="Follow-ups today" value={data?.followedUpToday ?? 0} icon={<CornerUpRight className="size-3.5" />} />
          <Stat label="Gmails linked" value={`${data?.gmails.count ?? 0}/5`} icon={<Mail className="size-3.5" />} />
          <Stat label="API keys" value={`${data?.apiKeys.count ?? 0}/3`} icon={<Tag className="size-3.5" />} />
        </div>
      </div>

      <DispatchTicker />
    </section>
  )
}

function Gate({
  ok,
  count,
  label,
  sub,
  icon,
  onClick,
}: {
  ok: boolean
  count: string
  label: string
  sub?: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group text-left rounded-xl border px-3.5 py-3 transition-all',
        ok
          ? 'border-foreground/15 bg-foreground/[0.02] hover:bg-foreground/[0.05]'
          : 'border-kynp-yellow/30 bg-kynp-yellow/[0.04] hover:bg-kynp-yellow/[0.08]',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('inline-flex items-center gap-1.5 text-xs', ok ? 'text-muted-foreground' : 'text-kynp-yellow')}>
          {icon}
          {label}
        </span>
        <span className={cn('text-xs font-semibold', ok ? 'text-foreground' : 'text-kynp-yellow')}>{count}</span>
      </div>
      {sub && <p className="mt-2 text-[11px] text-muted-foreground group-hover:text-foreground/80 transition-colors">{sub}</p>}
    </button>
  )
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="px-4 py-4 sm:px-6 sm:py-5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        {icon}{label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function DispatchTicker() {
  const { recent } = useKynpStore()
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
      <div className="flex items-center justify-between mb-3">
        
        <span className="text-[10px] text-muted-foreground uppercase inline-flex items-center gap-1">
          <Clock className="size-3" /> 30s cadence · 24h follow-up
        </span>
      </div>
      {recent ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{recent.name}</span>
            <span className="text-kynp-yellow inline-flex items-center gap-1 text-[11px] uppercase tracking-wider">
              {recent.kind === 'follow_up' ? <CornerUpRight className="size-3" /> : <Send className="size-3" />}
              {recent.kind === 'follow_up' ? 'Follow-up sent' : 'Message sent'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {recent.company} {recent.position ? `· ${recent.position}` : ''} · Gmail slot {recent.gmailSlot ?? '—'}
          </p>
          <p className="text-xs text-muted-foreground truncate">{recent.email}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No dispatches yet. Start a campaign to populate this ticker.</p>
      )}
    </div>
  )
}
