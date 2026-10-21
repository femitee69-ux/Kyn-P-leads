'use client'

import * as React from 'react'
import Link from 'next/link'
import { useKynpStore } from '@/store/kynp'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { TopBar } from './top-bar'
import { AccountSheet } from './account-sheet'
import { DashboardView } from './views/dashboard'
import { CampaignView } from './views/campaign'
import { LeadsView } from './views/leads'
import { ApiKeysView } from './views/apikeys'
import { GmailsView } from './views/gmails'
import { HistoryView } from './views/history'
import { AuthGate, useSessionQuery } from './auth-gate'
import { Activity, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AppShell() {
  const {
    view, setView,
    campaignId, campaignStatus,
    setDispatching, setRecent, setStats, pushLog,
  } = useKynpStore()
  const qc = useQueryClient()
  const { data: session, isLoading: sessionLoading } = useSessionQuery()
  const isAuthed = !!session?.user?.id

  // When the user is not authenticated, the only sign-in CTA lives on the
  // landing page. Both buttons call `setAuthOpen(true)`.
  const [authOpen, setAuthOpen] = React.useState(false)

  // CRITICAL: When the auth state changes (sign in / sign out), reset the
  // entire Kyn'P store so a new user starts fresh — no leftover form data,
  // campaign IDs, or activity logs from the previous account.
  const prevAuthed = React.useRef(isAuthed)
  React.useEffect(() => {
    if (prevAuthed.current && !isAuthed) {
      // User just signed out → reset everything
      useKynpStore.setState({
        view: 'dashboard',
        sheetOpen: false,
        campaignId: null,
        campaignStatus: 'idle',
        isStarting: false,
        isDispatching: false,
        stats: null,
        recent: null,
        country: '',
        brand: '',
        service: '',
        targetAudience: '',
        targetLeads: 500,
        followUp: false,
        selectedGmailSlots: [],
        log: [],
      })
      // Clear all React Query caches so no stale data from the previous account
      // appears in the new account's views.
      qc.clear()
    }
    prevAuthed.current = isAuthed
  }, [isAuthed, qc])

  // Handle OAuth callback query params (?gmail_linked=N / ?gmail_error=...)
  // Also support direct-view links like ?view=gmails, ?view=apikeys, etc.
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const linked = url.searchParams.get('gmail_linked')
    const err = url.searchParams.get('gmail_error')
    const viewParam = url.searchParams.get('view')

    if (linked) {
      toast.success(`Gmail slot ${linked} linked successfully.`)
      url.searchParams.delete('gmail_linked')
      window.history.replaceState({}, '', url.toString())
      setView('gmails')
    }
    if (err) {
      const msg = decodeURIComponent(err)
      toast.error(`Gmail link failed: ${msg}`)
      url.searchParams.delete('gmail_error')
      window.history.replaceState({}, '', url.toString())
      setView('gmails')
    }
    if (viewParam && isAuthed) {
      const validViews = ['dashboard', 'campaign', 'leads', 'apikeys', 'gmails', 'history']
      if (validViews.includes(viewParam)) {
        setView(viewParam as any)
      }
    }
  }, [isAuthed])

  // 30-second dispatch loop — only runs when authenticated and campaign is running
  React.useEffect(() => {
    if (!isAuthed) return
    if (campaignStatus !== 'running' || !campaignId) return
    let cancelled = false
    let timer: any

    const tick = async () => {
      if (cancelled) return
      setDispatching(true)
      try {
        const res = await fetch('/api/leads/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'dispatch failed')

        if (json.sent) {
          const s = json.sent
          setRecent({
            id: s.id,
            name: s.name,
            email: s.email,
            company: s.company,
            position: s.position,
            status: s.status,
            kind: s.kind ?? 'initial',
            gmailSlot: s.gmailSlot,
            message: s.message,
            sentAt: s.sentAt,
          })
          pushLog(`Dispatched to ${s.name} <${s.email}> · Gmail slot ${s.gmailSlot}`)
        }
        if (json.stats) {
          setStats({
            total: json.stats.total,
            sent: json.stats.sent,
            followedUp: json.stats.followedUp,
            pending: json.stats.remaining,
            failed: 0,
          })
        }
        qc.invalidateQueries({ queryKey: ['leads', campaignId] })
        qc.invalidateQueries({ queryKey: ['status'] })

        if (json.status === 'completed') {
          pushLog('Campaign completed. No more leads to dispatch.')
          return
        }
      } catch (e: any) {
        pushLog(`Dispatch error: ${e.message}`)
      } finally {
        setDispatching(false)
      }
      timer = setTimeout(tick, 30_000)
    }

    pushLog('Dispatch loop started (30s cadence, 24h follow-up).')
    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [campaignId, campaignStatus, isAuthed])

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="size-6 border-2 border-kynp-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative z-10 flex flex-col min-h-screen">
      <TopBar />
      {isAuthed && <AccountSheet />}
      <AuthGate open={authOpen} onOpenChange={setAuthOpen} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {isAuthed ? (
          <>
            {view === 'dashboard' && <DashboardView />}
            {view === 'campaign' && <CampaignView />}
            {view === 'leads' && <LeadsView />}
            {view === 'apikeys' && <ApiKeysView />}
            {view === 'gmails' && <GmailsView />}
            {view === 'history' && <HistoryView />}
          </>
        ) : (
          <PhoneLoginView onPhoneLogin={() => setAuthOpen(true)} />
        )}
      </main>

      {isAuthed && <ActivityLogFooter />}
    </div>
  )
}

function PhoneLoginView({ onPhoneLogin }: { onPhoneLogin: () => void }) {
  return (
    <section className="flex flex-col items-center justify-center min-h-[60vh] max-w-sm mx-auto">
      <img src="/logo.png" alt="Kyn'P" className="size-16 rounded-full mb-6" />
      <button
        onClick={onPhoneLogin}
        className="w-full rounded-md bg-kynp-black text-white px-6 py-3 text-sm font-medium hover:bg-kynp-ink"
      >
        Sign In
      </button>
      <div className="mt-6 flex gap-6 text-xs text-muted-foreground">
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
      </div>
    </section>
  )
}

function ActivityLogFooter() {
  const { log, clearLog } = useKynpStore()
  const [open, setOpen] = React.useState(false)
  const { data: session } = useSessionQuery()
  const isAuthed = !!session?.user?.id
  if (!isAuthed) return null
  return (
    <footer className="mt-auto border-t border-foreground/10 bg-background/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between py-3 text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <Activity className="size-3.5" /> Activity log
            <span className="rounded-full bg-foreground/10 px-1.5 text-[10px]">{log.length}</span>
          </span>
          <span>{open ? 'Hide' : 'Show'}</span>
        </button>
        {open && (
          <div className="pb-4">
            {log.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No activity yet.</p>
            ) : (
              <ul className="max-h-48 overflow-y-auto kynp-scroll space-y-1 font-mono text-[11px] text-muted-foreground">
                {log.map((line, i) => (
                  <li key={i} className="leading-relaxed">
                    <span className="text-kynp-yellow/70">›</span> {line}
                  </li>
                ))}
              </ul>
            )}
            {log.length > 0 && (
              <button
                onClick={clearLog}
                className="mt-2 text-[11px] text-muted-foreground hover:text-foreground"
              >Clear log</button>
            )}
          </div>
        )}
      </div>
    </footer>
  )
}
