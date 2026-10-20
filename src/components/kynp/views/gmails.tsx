'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, Trash2, Loader2, Mail, CheckCircle2, AlertTriangle } from 'lucide-react'
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
}

async function fetchGmails(): Promise<GmailsResp> {
  const res = await fetch('/api/gmails', { cache: 'no-store' })
  if (!res.ok) throw new Error('fetch failed')
  return res.json()
}

export function GmailsView() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['gmails'], queryFn: fetchGmails })

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="kynp-eyebrow text-kynp-yellow">Gmail Accounts</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-[1.1]">
          Link your Gmails, BOSS.
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl">
          Enter your Gmail address + App Password (16 chars from{' '}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener" className="text-kynp-yellow underline">
            myaccount.google.com/apppasswords
          </a>
          ). The app verifies the password before saving — wrong passwords are rejected.
          Not all 5 slots need to be filled. Remove any Gmail anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5].map((slot) => (
          <GmailSlot
            key={slot}
            slot={slot}
            existing={data?.gmails.find((g) => g.slot === slot)}
            onSaved={() => qc.invalidateQueries({ queryKey: ['gmails'] })}
          />
        ))}
      </div>
    </section>
  )
}

function GmailSlot({
  slot,
  existing,
  onSaved,
}: {
  slot: number
  existing?: GmailRow
  onSaved: () => void
}) {
  const [email, setEmail] = React.useState('')
  const [appPassword, setAppPassword] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [edit, setEdit] = React.useState(false)

  React.useEffect(() => {
    if (existing) {
      setEmail(existing.email)
      setAppPassword('')
    }
  }, [existing?.slot, existing?.email])

  const handleSave = async () => {
    if (!email.includes('@')) {
      toast.error('Enter a valid Gmail address.')
      return
    }
    if (appPassword.replace(/\s/g, '').length < 8) {
      toast.error('App password must be 16 characters.')
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
      toast.success(`Gmail ${email} verified and saved.`)
      setAppPassword('')
      setEdit(false)
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
      toast.success(`Gmail slot ${slot} removed.`)
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
        : 'border-foreground/10 bg-background',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(
            'size-7 rounded-lg text-xs font-semibold flex items-center justify-center',
            existing ? 'bg-kynp-yellow text-kynp-black' : 'bg-foreground/10 text-muted-foreground',
          )}>{slot}</span>
          <div>
            <p className="text-sm font-medium leading-tight">Gmail {slot}</p>
            <p className="text-[11px] text-muted-foreground">{existing ? 'Verified & linked' : 'Empty'}</p>
          </div>
        </div>
        {existing && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-500">
            <CheckCircle2 className="size-3" /> Active
          </span>
        )}
      </div>

      {existing && !edit ? (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</p>
            <p className="text-sm font-medium truncate">{existing.email}</p>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs inline-flex items-center gap-1.5 rounded-md bg-foreground/5 hover:bg-foreground/10 px-2.5 py-1.5 text-red-500"
          >
            {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />} Remove
          </button>
        </div>
      ) : (
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
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">App password (16 chars)</label>
            <input
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="abcd efgh ijkl mnop"
              className="w-full rounded-md bg-background border border-foreground/15 px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-kynp-yellow/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-kynp-yellow text-kynp-black px-3 py-1.5 text-xs font-semibold hover:brightness-110 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {saving ? 'Verifying...' : 'Verify & Save'}
            </button>
            {existing && (
              <button
                onClick={() => setEdit(false)}
                className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5"
              >Cancel</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
