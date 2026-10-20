'use client'

import * as React from 'react'
import Image from 'next/image'
import { useKynpStore } from '@/store/kynp'
import { useQuery } from '@tanstack/react-query'
import { useSessionQuery } from '@/components/kynp/auth-gate'
import { ThemeToggle } from '@/components/kynp/theme-toggle'
import { Circle, Radio, AlertTriangle } from 'lucide-react'
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
  /** Set when any API key has run out of credit. */
  credits?: {
    slot: number
    service: string
    credits: number
    exhausted: boolean
  }[]
}

async function fetchStatus(): Promise<StatusResp> {
  const res = await fetch('/api/status', { cache: 'no-store' })
  if (!res.ok) throw new Error('status failed')
  return res.json()
}

export function TopBar() {
  const { setSheetOpen, campaignId, campaignStatus, setView } = useKynpStore()
  const { data: session } = useSessionQuery()
  const isAuthed = !!session?.user?.id
  const { data } = useQuery<StatusResp>({
    queryKey: ['status'],
    queryFn: fetchStatus,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    enabled: isAuthed,
  })

  const isLive = isAuthed && campaignId && campaignStatus === 'running'
  const exhaustedKeys = data?.credits?.filter((c) => c.exhausted) ?? []

  return (
    <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/85 backdrop-blur-md">
      <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-6 gap-2">
        {/* Brand mark */}
        <button
          onClick={() => useKynpStore.getState().setView('dashboard')}
          className="flex items-center gap-2 group shrink-0"
        >
          <div className="size-9 sm:size-10 rounded-full overflow-hidden flex items-center justify-center">
            <Image src="/logo.png" alt="Kyn'P Leads" width={36} height={36} className="size-9 sm:size-10 object-cover" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-semibold tracking-tight leading-none">
              Kyn&rsquo;P <span className="text-kynp-yellow">Leads</span>
            </p>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">
              Find &middot; Compose &middot; Send &middot; Follow up
            </p>
          </div>
        </button>

        {/* Center: live status pill — only when signed in */}
        <div className="flex-1 hidden md:flex justify-center min-w-0">
          {isAuthed && (
            data?.campaign ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-3 py-1 text-xs max-w-full">
                <span className={cn('inline-block size-1.5 rounded-full shrink-0',
                  isLive ? 'bg-kynp-yellow kynp-live-dot' : 'bg-muted-foreground/50')} />
                <span className="text-muted-foreground">Campaign</span>
                <span className="font-medium truncate">{data.campaign.country}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium truncate max-w-[140px]">{data.campaign.brand}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-kynp-yellow font-medium uppercase tracking-wider text-[10px]">{data.campaign.status}</span>
              </div>
            ) : exhaustedKeys.length > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/[0.06] px-3 py-1 text-xs">
                <AlertTriangle className="size-3 text-red-500" />
                <span className="text-red-500 font-medium">
                  {exhaustedKeys[0].service.toUpperCase()} key credit exhausted
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-3 py-1 text-xs text-muted-foreground">
                <Radio className="size-3" />
                <span>No active campaign</span>
              </div>
            )
          )}
        </div>

        {/* Right: quick stats + theme toggle + (account button when authed) */}
        <div className="flex items-center gap-2 shrink-0">
          {isAuthed && (
            <div className="hidden xl:flex items-center gap-4 text-xs text-muted-foreground">
              <span><span className="text-foreground font-medium">{data?.gmails.count ?? 0}</span>/5 Gmails</span>
              <span><span className="text-foreground font-medium">{data?.apiKeys.count ?? 0}</span>/3 Keys</span>
              <span><span className="text-foreground font-medium">{data?.sentToday ?? 0}</span> sent</span>
            </div>
          )}
          <ThemeToggle />
          {isAuthed && (
            <button
              onClick={() => setSheetOpen(true)}
              aria-label="Open Kyn'P Leads workspace menu"
              className="flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors pl-1.5 pr-2 sm:pr-3 py-1.5"
            >
              <span className="size-6 sm:size-7 rounded-full bg-kynp-yellow text-kynp-black text-[10px] sm:text-xs font-semibold flex items-center justify-center">
                👑
              </span>
              <span className="hidden sm:inline text-xs font-medium">BOSS</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
