'use client'

import * as React from 'react'
import { useKynpStore } from '@/store/kynp'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Globe2,
  Tag,
  Briefcase,
  CornerUpRight,
  Play,
  Loader2,
  Mail,
  KeyRound,
  AlertTriangle,
  AlertCircle,
  Check,
  Users,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusResp {
  gmails: { count: number }
  apiKeys: { count: number }
  credits?: { slot: number; service: string; exhausted: boolean }[]
}

async function fetchStatus(): Promise<StatusResp> {
  const res = await fetch('/api/status', { cache: 'no-store' })
  if (!res.ok) throw new Error('status failed')
  return res.json()
}

// ---------- Validation ----------
function validateCountry(v: string): string | null {
  if (!v.trim()) return 'Country is required.'
  if (v.trim().length < 2) return 'Country looks too short (min 2 chars).'
  if (!/^[a-zA-Z\s'-]+$/.test(v.trim())) return 'Use letters only (e.g. "Nigeria").'
  return null
}
function validateBrand(v: string): string | null {
  if (!v.trim()) return 'Brand is required.'
  if (v.trim().length < 2) return 'Brand looks too short (min 2 chars).'
  return null
}
function validateService(v: string): string | null {
  if (!v.trim()) return 'Service is required.'
  if (v.trim().length < 5) return 'Be more specific (min 5 chars).'
  return null
}

export function CampaignView() {
  const {
    country, brand, service, targetAudience, targetLeads, followUp, selectedGmailSlots,
    setForm, isStarting, setStarting,
    setCampaign, setView, pushLog,
  } = useKynpStore()
  const qc = useQueryClient()
  const { data } = useQuery<StatusResp>({
    queryKey: ['status'],
    queryFn: fetchStatus,
    refetchInterval: 8000,
  })

  // Fetch linked Gmails for the selection
  const { data: gmailsData } = useQuery({
    queryKey: ['gmails'],
    queryFn: async () => {
      const res = await fetch('/api/gmails', { cache: 'no-store' })
      if (!res.ok) throw new Error('failed')
      return res.json()
    },
  })

  const [touched, setTouched] = React.useState<{ [k: string]: boolean }>({})

  const gmailsReady = (data?.gmails.count ?? 0) > 0
  const keysReady = (data?.apiKeys.count ?? 0) > 0
  const exhaustedKey = data?.credits?.find((c) => c.exhausted)

  const activeGmails = (gmailsData?.gmails ?? []).filter((g: any) => g.active)
  const hasGmails = activeGmails.length > 0
  const hasGmailSelected = selectedGmailSlots.length > 0

  // Inline errors
  const countryErr = touched.country ? validateCountry(country) : null
  const brandErr = touched.brand ? validateBrand(brand) : null
  const serviceErr = touched.service ? validateService(service) : null

  // Block submit unless all fields are valid + at least 1 Gmail selected
  const formValid =
    !validateCountry(country) && !validateBrand(brand) && !validateService(service) && hasGmailSelected

  // Block when API keys exhausted
  const blocked = !!exhaustedKey
  const canStart = keysReady && formValid && !isStarting && !blocked && hasGmailSelected

  const handleStart = async () => {
    setTouched({ country: true, brand: true, service: true })
    if (!formValid) {
      toast.error('Please fix the highlighted fields before continuing.')
      return
    }
    if (blocked) {
      toast.error(`${exhaustedKey!.service.toUpperCase()} key is out of credit. Top up or replace it first.`)
      setView('apikeys')
      return
    }
    setStarting(true)
    pushLog('Starting campaign: generating leads & composing messages…')
    try {
      const res = await fetch('/api/campaigns/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, brand, service, targetAudience, targetLeads, followUp, gmailSlots: selectedGmailSlots }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Start failed')
      setCampaign(json.campaignId, 'running')
      pushLog(`Campaign started: ${json.totalLeads} leads generated. Target: ${json.targetLeads || 500} leads.`)
      toast.success(`Campaign started — ${json.totalLeads} leads ready. Keep this tab open for 30s auto-dispatch.`)
      qc.invalidateQueries({ queryKey: ['status'] })
      setView('leads')
    } catch (e: any) {
      toast.error(e.message)
      pushLog(`Error: ${e.message}`)
    } finally {
      setStarting(false)
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">New Campaign</h1>

      {/* Readiness / blocking banners */}
      {blocked && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/[0.06] p-4 flex items-start gap-3">
          <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-foreground">
              {exhaustedKey!.service.toUpperCase()} key is out of credit
            </p>
            <p className="text-xs text-muted-foreground">
              Kyn&rsquo;P blocked the start to save your time. Top up the key at its provider and
              you&rsquo;ll be good to go.
            </p>
            <button
              onClick={() => setView('apikeys')}
              className="mt-2 text-xs inline-flex items-center gap-1.5 rounded-md bg-foreground/10 hover:bg-foreground/15 px-2.5 py-1"
            >
              <KeyRound className="size-3" /> Open API Keys
            </button>
          </div>
        </div>
      )}

      {!keysReady && !blocked && (
        <div className="rounded-xl border border-kynp-yellow/40 bg-kynp-yellow/[0.06] p-4 flex items-start gap-3">
          <AlertTriangle className="size-4 text-kynp-yellow shrink-0 mt-0.5" />
          <div className="text-sm space-y-2">
            <p className="font-medium text-foreground">Before you start</p>
            <p className="text-xs text-muted-foreground">
              Gmail accounts are optional. API keys are required to power lead generation.
            </p>
            <div className="flex flex-wrap gap-2">
              {!gmailsReady && (
                <button
                  onClick={() => setView('gmails')}
                  className="inline-flex items-center gap-1.5 rounded-md bg-foreground/10 px-2.5 py-1 text-xs hover:bg-foreground/15"
                >
                  <Mail className="size-3" /> Link Gmails (optional)
                </button>
              )}
              <button
                onClick={() => setView('apikeys')}
                className="inline-flex items-center gap-1.5 rounded-md bg-foreground/10 px-2.5 py-1 text-xs hover:bg-foreground/15"
              >
                <KeyRound className="size-3" /> Add API key (required)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="space-y-6">
        <Field
          icon={<Globe2 className="size-4 text-kynp-yellow" />}
          label="Country"
          hint="Where should leads be located? e.g. Nigeria, France, UAE."
          value={country}
          onChange={(v) => { setForm({ country: v }); setTouched((t) => ({ ...t, country: true })) }}
          onBlur={() => setTouched((t) => ({ ...t, country: true }))}
          placeholder="e.g. Nigeria"
          error={countryErr}
        />

        <Field
          icon={<Tag className="size-4 text-kynp-yellow" />}
          label="Brand / Industry"
          hint="Which brand or industry are you targeting? e.g. Dior, luxury fashion, boutique coffee."
          value={brand}
          onChange={(v) => { setForm({ brand: v }); setTouched((t) => ({ ...t, brand: true })) }}
          onBlur={() => setTouched((t) => ({ ...t, brand: true }))}
          placeholder="e.g. boutique coffee"
          error={brandErr}
        />

        <Field
          icon={<Briefcase className="size-4 text-kynp-yellow" />}
          label="Service to preach"
          hint="What service do you offer to these prospects? Be specific — it shapes the messaging."
          value={service}
          onChange={(v) => { setForm({ service: v }); setTouched((t) => ({ ...t, service: true })) }}
          onBlur={() => setTouched((t) => ({ ...t, service: true }))}
          placeholder="e.g. paid-ads management that adds 20% revenue in 60 days"
          textarea
          error={serviceErr}
        />

        <Field
          icon={<Users className="size-4 text-kynp-yellow" />}
          label="Target audience"
          hint="Who are you trying to reach? e.g. founders, marketing directors, small business owners."
          value={targetAudience}
          onChange={(v) => setForm({ targetAudience: v })}
          placeholder="e.g. founders and marketing directors of skincare brands"
        />

        <Field
          icon={<Target className="size-4 text-kynp-yellow" />}
          label="Target leads count"
          hint="How many leads do you want? The app stops automatically when this number is reached."
          value={String(targetLeads)}
          onChange={(v) => setForm({ targetLeads: parseInt(v) || 500 })}
          placeholder="500"
        />

        {/* Gmail selection — compulsory */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-kynp-yellow" />
            <label className="text-sm font-medium">Select Gmail(s) to send from</label>
            <span className="text-[10px] text-kynp-yellow uppercase tracking-wider">Required</span>
          </div>
          <p className="text-xs text-muted-foreground">Pick which Gmail account(s) will send the outreach. Multiple Gmails rotate automatically.</p>
          {activeGmails.length === 0 ? (
            <div className="rounded-lg border border-kynp-yellow/40 bg-kynp-yellow/[0.06] p-3 text-xs text-muted-foreground">
              No Gmails linked. <button onClick={() => setView('gmails')} className="text-kynp-yellow font-medium underline">Link a Gmail first →</button>
            </div>
          ) : (
            <div className="space-y-2">
              {activeGmails.map((g: any) => (
                <label key={g.slot} className="flex items-center gap-3 rounded-lg border border-foreground/10 p-3 cursor-pointer hover:bg-foreground/[0.03]">
                  <input
                    type="checkbox"
                    checked={selectedGmailSlots.includes(g.slot)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...selectedGmailSlots, g.slot]
                        : selectedGmailSlots.filter((s) => s !== g.slot)
                      setForm({ selectedGmailSlots: next })
                    }}
                    className="size-4 accent-kynp-yellow"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{g.email}</p>
                    <p className="text-[11px] text-muted-foreground">Slot {g.slot}</p>
                  </div>
                </label>
              ))}
              {!hasGmailSelected && (
                <p className="text-[11px] text-red-500">Select at least 1 Gmail to start the campaign.</p>
              )}
            </div>
          )}
        </div>

        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-foreground/10 p-4 hover:bg-foreground/[0.03] transition-colors">
          <input
            type="checkbox"
            checked={followUp}
            onChange={(e) => setForm({ followUp: e.target.checked })}
            className="mt-0.5 size-4 accent-kynp-yellow"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CornerUpRight className="size-4 text-kynp-yellow" />
              Send follow-ups (after 24 hours of no reply)
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              When enabled, Kyn&rsquo;P waits <strong>24 hours</strong> after the initial send and
              dispatches a polite, tailored follow-up to any lead that hasn&rsquo;t replied &mdash;
              on the same 30-second cadence.
            </p>
          </div>
        </label>
      </div>

      {/* Start button */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={cn(
            'w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all',
            canStart
              ? 'bg-kynp-yellow text-kynp-black hover:brightness-110 shadow-[0_4px_24px_-4px_rgba(245,197,24,0.45)]'
              : 'bg-foreground/10 text-muted-foreground cursor-not-allowed',
          )}
        >
          {isStarting ? (
            <><Loader2 className="size-4 animate-spin" /> Generating leads & composing…</>
          ) : blocked ? (
            <><AlertCircle className="size-4" /> Key out of credit</>
          ) : (
            <><Play className="size-4 fill-current" /> Start Campaign</>
          )}
        </button>
        <p className="text-xs text-muted-foreground">
          Kyn&rsquo;P will find leads, compose messages, and dispatch one every 30 seconds.
        </p>
      </div>
    </section>
  )
}

function Field({
  icon,
  label,
  hint,
  value,
  onChange,
  onBlur,
  placeholder,
  textarea,
  error,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  textarea?: boolean
  error?: string | null
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <label className="text-sm font-medium">{label}</label>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={3}
          className={cn(
            'w-full rounded-lg bg-background border px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-shadow resize-y',
            error
              ? 'border-red-500/50 focus:ring-red-500/30'
              : 'border-foreground/15 focus:ring-kynp-yellow/40 focus:border-kynp-yellow/40',
          )}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-lg bg-background border px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-shadow',
            error
              ? 'border-red-500/50 focus:ring-red-500/30'
              : 'border-foreground/15 focus:ring-kynp-yellow/40 focus:border-kynp-yellow/40',
          )}
        />
      )}
      {error ? (
        <span className="text-[11px] text-red-500 inline-flex items-center gap-1">
          <AlertCircle className="size-3" /> {error}
        </span>
      ) : value && (textarea ? value.length >= 5 : value.length >= 2) ? (
        <span className="text-[11px] text-emerald-500 inline-flex items-center gap-1">
          <Check className="size-3" /> Looks good.
        </span>
      ) : null}
    </div>
  )
}
