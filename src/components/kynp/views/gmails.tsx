'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, Trash2, Loader2, ShieldCheck, Mail, AlertCircle, Plug, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GmailRow {
  id: string
  slot: number
  email: string
  active: boolean
  updatedAt: string
}
interface GmailsResp {
  gmails: GmailRow[]
  oauthConfigured: boolean
}

async function fetchGmails(): Promise<GmailsResp> {
  const res = await fetch('/api/gmails', { cache: 'no-store' })
  if (!res.ok) throw new Error('gmails fetch failed')
  return res.json()
}

export function GmailsView() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['gmails'], queryFn: fetchGmails })

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="kynp-eyebrow text-kynp-yellow">Gmail Accounts</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-[1.1]">
          Five inboxes. <span className="text-kynp-yellow">One relay.</span>
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl">
          Click <strong>Login Gmail</strong> to link each Gmail with one Google sign-in &mdash;
          no app passwords. Kyn&rsquo;P rotates between them across the 30-second cadence. Gmails
          are optional &mdash; you can run the app with 0 if you only want to log messages.
        </p>
      </div>

      {!data?.oauthConfigured && (
        <div className="rounded-xl border border-kynp-yellow/40 bg-kynp-yellow/[0.06] p-4 flex items-start gap-3">
          <AlertCircle className="size-4 text-kynp-yellow shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-foreground">One-click Gmail login needs a quick admin step</p>
            <p className="text-xs text-muted-foreground">
              The platform admin needs to set <code className="bg-foreground/10 px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> and{' '}
              <code className="bg-foreground/10 px-1 py-0.5 rounded">GOOGLE_CLIENT_SECRET</code> on the server.
              Until then, you can still link Gmails manually with App Passwords below.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5].map((slot) => (
          <GmailSlot
            key={slot}
            slot={slot}
            oauthConfigured={data?.oauthConfigured ?? false}
            existing={data?.gmails.find((g) => g.slot === slot)}
            onSaved={() => qc.invalidateQueries({ queryKey: ['gmails'] })}
          />
        ))}
      </div>

      <div className="rounded-xl border border-foreground/10 p-4 flex items-start gap-3 bg-foreground/[0.02]">
        <ShieldCheck className="size-4 text-kynp-yellow shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="text-foreground font-medium text-sm">OAuth, not passwords</p>
          <p>
            Kyn&rsquo;P only ever asks for the <code className="bg-foreground/10 px-1 py-0.5 rounded">gmail.send</code>{' '}
            scope. We store refresh tokens (encrypted at rest) so Kyn&rsquo;P can dispatch on your
            behalf without re-asking for consent. You can revoke at any time from your Google
            account page, and the linked slot here will stop working.
          </p>
        </div>
      </div>
    </section>
  )
}

function GmailSlot({
  slot,
  oauthConfigured,
  existing,
  onSaved,
}: {
  slot: number
  oauthConfigured: boolean
  existing?: GmailRow
  onSaved: () => void
}) {
  const [email, setEmail] = React.useState('')
  const [appPassword, setAppPassword] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [manualMode, setManualMode] = React.useState(false)
  const [connecting, setConnecting] = React.useState(false)

  React.useEffect(() => {
    if (existing) {
      setEmail(existing.email)
      setAppPassword('')
    }
  }, [existing?.slot, existing?.email])

  const handleOAuthConnect = async () => {
    setConnecting(true)
    try {
      const res = await fetch(`/api/gmails/oauth/start?slot=${slot}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'OAuth start failed')
      }
      // Redirect to Google OAuth consent
      window.location.href = json.authUrl
    } catch (e: any) {
      toast.error(e.message)
      setConnecting(false)
    }
  }

  const handleSaveManual = async () => {
    if (!email.includes('@')) {
      toast.error('Enter a valid Gmail address.')
      return
    }
    if (appPassword.trim().length < 8) {
      toast.error('App password looks too short.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/gmails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, email, appPassword }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'save failed')
      toast.success(`Gmail slot ${slot} saved.`)
      setAppPassword('')
      setManualMode(false)
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/gmails?slot=${slot}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      toast.success(`Gmail slot ${slot} cleared.`)
      setEmail('')
      setAppPassword('')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={cn(
      'rounded-2xl border p-5 space-y-4 transition-colors',
      existing
        ? 'border-foreground/15 bg-foreground/[0.02]'
        : 'border-kynp-yellow/30 bg-kynp-yellow/[0.04]',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(
            'size-7 rounded-lg text-xs font-semibold flex items-center justify-center',
            existing ? 'bg-kynp-yellow text-kynp-black' : 'bg-foreground/10 text-muted-foreground',
          )}>{slot}</span>
          <div>
            <p className="text-sm font-medium leading-tight">Gmail {slot}</p>
            <p className="text-[11px] text-muted-foreground">{existing ? 'Linked' : 'Empty'}</p>
          </div>
        </div>
        {existing && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-kynp-yellow">
            <CheckCircle2 className="size-3" /> Ready
          </span>
        )}
      </div>

      {existing && !manualMode ? (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</p>
            <p className="text-sm font-medium truncate">{existing.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs inline-flex items-center gap-1.5 rounded-md bg-foreground/5 hover:bg-foreground/10 px-2.5 py-1.5 text-muted-foreground"
            >
              {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />} Clear
            </button>
          </div>
        </div>
      ) : manualMode ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Gmail address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              className="w-full rounded-md bg-background border border-foreground/15 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-kynp-yellow/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">App password (fallback)</label>
            <input
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="16-character app password"
              className="w-full rounded-md bg-background border border-foreground/15 px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-kynp-yellow/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveManual}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-kynp-black text-kynp-yellow px-3 py-1.5 text-xs font-semibold hover:bg-kynp-ink disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Save
            </button>
            <button
              onClick={() => setManualMode(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5"
            >Cancel</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={handleOAuthConnect}
            disabled={connecting || !oauthConfigured}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              oauthConfigured
                ? 'bg-kynp-yellow text-kynp-black hover:brightness-110'
                : 'bg-foreground/10 text-muted-foreground cursor-not-allowed',
            )}
          >
            {connecting ? (
              <><Loader2 className="size-3.5 animate-spin" /> Connecting…</>
            ) : (
              <><Plug className="size-3.5" /> Login Gmail</>
            )}
          </button>
          <button
            onClick={() => setManualMode(true)}
            className="w-full text-xs text-muted-foreground hover:text-foreground text-center pt-0.5"
          >
            Use app password instead
          </button>
        </div>
      )}
    </div>
  )
}
