'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useKynpStore } from '@/store/kynp'
import { History as HistoryIcon, Globe2, Tag, Briefcase, Clock, ChevronRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CampaignRow {
  id: string
  country: string
  brand: string
  service: string
  followUp: boolean
  status: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  _count: { leads: number }
}

async function fetchCampaigns(): Promise<{ campaigns: CampaignRow[] }> {
  const res = await fetch('/api/campaigns/list', { cache: 'no-store' })
  if (!res.ok) throw new Error('campaigns fetch failed')
  return res.json()
}

const STATUS_COLOR: Record<string, string> = {
  running: 'text-kynp-yellow',
  paused: 'text-muted-foreground',
  completed: 'text-emerald-500',
  idle: 'text-muted-foreground',
}

export function HistoryView() {
  const { data, isLoading } = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns })
  const { setView, setCampaign } = useKynpStore()

  // When a campaign is clicked, navigate to Leads view with that campaign ID
  const openCampaign = (c: CampaignRow) => {
    setCampaign(c.id, c.status as any)
    setView('leads')
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Campaign History</h1>

      {isLoading ? (
        <div className="rounded-2xl border border-foreground/10 p-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : data && data.campaigns.length > 0 ? (
        <div className="space-y-3">
          {data.campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => openCampaign(c)}
              className="group w-full text-left rounded-2xl border border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.04] hover:border-foreground/20 transition-all p-5 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'size-2 rounded-full shrink-0',
                      c.status === 'running' ? 'bg-kynp-yellow kynp-live-dot' :
                      c.status === 'completed' ? 'bg-emerald-500' :
                      'bg-muted-foreground/40'
                    )} />
                    <span className={cn(
                      'text-[10px] uppercase tracking-wider font-medium',
                      STATUS_COLOR[c.status] ?? 'text-muted-foreground'
                    )}>
                      {c.status}
                    </span>
                    {c.followUp && (
                      <span className="text-[10px] uppercase tracking-wider text-kynp-yellow/70 border border-kynp-yellow/30 rounded-full px-2 py-0.5">
                        Follow-ups on
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Globe2 className="size-3.5 text-kynp-yellow shrink-0" /> {c.country}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Tag className="size-3.5 text-kynp-yellow shrink-0" /> {c.brand}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground truncate">
                      <Briefcase className="size-3.5 shrink-0" /> {c.service}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" /> {c._count.leads} leads
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {c.startedAt ? new Date(c.startedAt).toLocaleString() : 'not started'}
                    </span>
                    {c.completedAt && (
                      <span className="inline-flex items-center gap-1 text-emerald-500/70">
                        completed {new Date(c.completedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  <span className="hidden sm:inline">View leads</span>
                  <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-foreground/15 p-12 text-center">
          <HistoryIcon className="size-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">No campaigns yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Start your first campaign to see it logged here.
          </p>
        </div>
      )}
    </section>
  )
}
