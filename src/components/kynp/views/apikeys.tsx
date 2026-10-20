'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, Trash2, Loader2, ShieldCheck, Search, Sparkles, Send, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApiKeyRow {
  id: string
  slot: number
  service: string
  label: string
  masked: string
  active: boolean
  updatedAt: string
}
interface ApiKeysResp {
  keys: ApiKeyRow[]
  slots: {
    slot: number
    service: string
    label: string
    placeholder: string
    description: string
  }[]
}
interface CreditsResp {
  credits: {
    slot: number
    service: string
    label: string
    credits: number | null
    exhausted: boolean
    error?: string
  }[]
}

async function fetchKeys(): Promise<ApiKeysResp> {
  const res = await fetch('/api/apikeys', { cache: 'no-store' })
  if (!res.ok) throw new Error('apikeys fetch failed')
  return res.json()
}
async function fetchCredits(): Promise<CreditsResp> {
  const res = await fetch('/api/apikeys/credits', { cache: 'no-store' })
  if (!res.ok) throw new Error('credits fetch failed')
  return res.json()
}

const SERVICE_ICON: Record<string, React.ReactNode> = {
  serper: <Search className="size-3.5" />,
  llm: <Sparkles className="size-3.5" />,
  smtp: <Send className="size-3.5" />,
}

export function ApiKeysView() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['apikeys'], queryFn: fetchKeys })
  const { data: credits } = useQuery<CreditsResp>({
    queryKey: ['credits'],
    queryFn: fetchCredits,
    refetchInterval: 30000,
    enabled: (data?.keys.length ?? 0) > 0,
  })

  const anyExhausted = credits?.credits.some((c) => c.exhausted) ?? false

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="kynp-eyebrow text-kynp-yellow">API Keys</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-[1.1]">
          Serper.dev API Key
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl">
          This is the only API key the app needs. Serper.dev searches Google to find real company
          websites in your target country. Free: 2,500 credits at{' '}
          <a href="https://serper.dev" target="_blank" rel="noopener" className="text-kynp-yellow underline">serper.dev</a>.
        </p>
      </div>

      {anyExhausted && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/[0.06] p-4 flex items-start gap-3">
          <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-foreground">A key is out of credit</p>
            <p className="text-xs text-muted-foreground">
              Kyn&rsquo;P won&rsquo;t start a new campaign until you top up or replace the affected key.
              See the slot below for details.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto">
        {(data?.slots ?? defaultSlots).map((slot) => {
          const c = credits?.credits.find((x) => x.slot === slot.slot)
          return (
            <KeySlot
              key={slot.slot}
              slotMeta={slot}
              existing={data?.keys.find((k) => k.slot === slot.slot)}
              credit={c}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ['apikeys'] })
                qc.invalidateQueries({ queryKey: ['credits'] })
              }}
            />
          )
        })}
      </div>

      <div className="rounded-xl border border-foreground/10 p-4 flex items-start gap-3 bg-foreground/[0.02]">
        <ShieldCheck className="size-4 text-kynp-yellow shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="text-foreground font-medium text-sm">Key safety &amp; multi-tenancy</p>
          <p>
            Keys are stored in the local Kyn&rsquo;P database scoped to your account &mdash; other
            users never see them. Masked values are shown for your safety.
          </p>
        </div>
      </div>
    </section>
  )
}

const defaultSlots = [
  { slot: 1, service: 'serper', label: 'Serper.dev API Key', placeholder: 'serper.dev key', description: 'Searches Google for real company websites. Free: 2,500 credits at serper.dev.' },
]

interface CreditInfo {
  slot: number
  service: string
  label: string
  credits: number | null
  exhausted: boolean
  error?: string
}

function KeySlot({
  slotMeta,
  existing,
  credit,
  onSaved,
}: {
  slotMeta: { slot: number; service: string; label: string; placeholder: string; description: string }
  existing?: ApiKeyRow
  credit?: CreditInfo
  onSaved: () => void
}) {
  const [label, setLabel] = React.useState('')
  const [value, setValue] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [edit, setEdit] = React.useState(false)

  React.useEffect(() => {
    if (existing) {
      setLabel(existing.label)
      setValue('')
    } else {
      setLabel(slotMeta.label)
    }
  }, [existing?.slot, existing?.label, slotMeta.label])

  const handleSave = async () => {
    if (value.trim().length < 6) {
      toast.error('Key looks too short.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: slotMeta.slot, label: label || slotMeta.label, value }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'save failed')
      setValue('')
      setEdit(false)
      toast.success(`Slot ${slotMeta.slot} saved.`)
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
      const res = await fetch(`/api/apikeys?slot=${slotMeta.slot}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      toast.success(`Slot ${slotMeta.slot} cleared.`)
      setLabel(slotMeta.label)
      setValue('')
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
        ? credit?.exhausted
          ? 'border-red-500/40 bg-red-500/[0.04]'
          : 'border-foreground/15 bg-foreground/[0.02]'
        : 'border-kynp-yellow/30 bg-kynp-yellow/[0.04]',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(
            'size-7 rounded-lg text-xs font-semibold flex items-center justify-center',
            existing ? 'bg-kynp-yellow text-kynp-black' : 'bg-foreground/10 text-muted-foreground',
          )}>{slotMeta.slot}</span>
          <div>
            <p className="text-sm font-medium leading-tight">{slotMeta.label}</p>
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              {SERVICE_ICON[slotMeta.service]}
              {slotMeta.service.toUpperCase()}
              {slotMeta.service === 'smtp' && ' (optional)'}
            </p>
          </div>
        </div>
        {existing && (
          <span className={cn('size-2 rounded-full', credit?.exhausted ? 'bg-red-500' : 'bg-kynp-yellow')} />
        )}
      </div>

      <p className="text-xs text-muted-foreground">{slotMeta.description}</p>

      {/* Credit status pill */}
      {existing && credit && credit.credits !== null && (
        <div className={cn(
          'rounded-md border px-2.5 py-1.5 text-[11px] inline-flex items-center gap-1.5',
          credit.exhausted
            ? 'border-red-500/40 bg-red-500/[0.06] text-red-500'
            : credit.credits < 50
              ? 'border-kynp-yellow/40 bg-kynp-yellow/[0.06] text-kynp-yellow'
              : 'border-foreground/10 bg-foreground/[0.04] text-muted-foreground',
        )}>
          {credit.exhausted ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3" />}
          {credit.exhausted ? 'Out of credit' : `${credit.credits} credits`}
        </div>
      )}
      {existing && credit?.error && credit.credits === null && !credit.exhausted && (
        <p className="text-[10px] text-muted-foreground">
          {credit.error === 'blocked_by_cloudflare'
            ? 'Credit check unavailable from server (Cloudflare blocked). The key will be tested when you start a campaign.'
            : `Credit check: ${credit.error}`}
        </p>
      )}

      {existing && !edit ? (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Label</p>
            <p className="text-sm font-medium truncate">{existing.label}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Key</p>
            <p className="text-sm font-mono truncate">{existing.masked}</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setEdit(true)}
              className="text-xs inline-flex items-center gap-1.5 rounded-md bg-foreground/10 hover:bg-foreground/15 px-2.5 py-1.5"
            >
              Replace
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs inline-flex items-center gap-1.5 rounded-md bg-foreground/5 hover:bg-foreground/10 px-2.5 py-1.5 text-muted-foreground"
            >
              {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />} Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={slotMeta.label}
              className="w-full rounded-md bg-background border border-foreground/15 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-kynp-yellow/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Secret value</label>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={slotMeta.placeholder}
              className="w-full rounded-md bg-background border border-foreground/15 px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-kynp-yellow/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || value.trim().length < 6}
              className="inline-flex items-center gap-1.5 rounded-md bg-kynp-black text-kynp-yellow px-3 py-1.5 text-xs font-semibold hover:bg-kynp-ink disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Save
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
