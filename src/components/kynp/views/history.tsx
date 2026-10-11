'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { History as HistoryIcon, Globe2, Tag, Briefcase, Clock } from 'lucide-react'
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
  completed: 'text-emerald-400',
  idle: 'text-muted-foreground',
}

export function HistoryView() {
  const { data, isLoading } = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns })

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="kynp-eyebrow text-kynp-yellow">Campaign History</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]">
          Past runs, <span className="text-kynp-yellow">kept honest.</span>
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
          Every campaign Kyn&rsquo;P has run for this workspace is logged here &mdash;
          from setup to completion &mdash; with the lead count and final status.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-foreground/10 p-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : data && data.campaigns.length > 0 ? (
        <div className="rounded-2xl border border-foreground/10 overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_auto] gap-3 px-5 py-3 border-b border-foreground/10 bg-foreground/[0.02] text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Campaign</span>
            <span>Leads</span>
            <span>Started</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-foreground/10">
            {data.campaigns.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[1.6fr_1fr_1fr_auto] gap-3 px-5 py-3.5 items-center hover:bg-foreground/[0.02] transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="inline-flex items-center gap-1 font-medium truncate">
                      <Globe2 className="size-3 text-kynp-yellow shrink-0" /> {c.country}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="inline-flex items-center gap-1 font-medium truncate">
                      <Tag className="size-3 text-kynp-yellow shrink-0" /> {c.brand}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground truncate">
                      <Briefcase className="size-3 shrink-0" /> {c.service}
                    </span>
                  </div>
                </div>
                <span className="text-sm tabular-nums">{c._count.leads}</span>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <Clock className="size-3" />
                  {c.startedAt ? new Date(c.startedAt).toLocaleString() : '—'}
                </span>
                <span className={cn('text-[11px] uppercase tracking-wider font-medium', STATUS_COLOR[c.status] ?? 'text-muted-foreground')}>
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
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
