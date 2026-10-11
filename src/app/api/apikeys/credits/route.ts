import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface CreditInfo {
  slot: number
  service: string
  label: string
  credits: number | null
  exhausted: boolean
  error?: string
}

/**
 * GET /api/apikeys/credits
 * Pings each configured service to check the remaining credit balance.
 * Returns a list with `credits` (number when known) and `exhausted` boolean.
 *
 * - Serper.dev: GET https://api.serper.dev/credits  → { credits: number }
 * - LLM / OpenAI: no public quota endpoint — we mark null and report exhausted
 *   only if a previous call failed with 429/insufficient_quota.
 * - SMTP: not applicable.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const keys = await db.apiKey.findMany({
      where: { userId, active: true },
      orderBy: { slot: 'asc' },
    })

    const results = await Promise.all(keys.map((k) => checkOne(k.slot, k.service, k.value)))
    return NextResponse.json({ credits: results })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

async function checkOne(slot: number, service: string, value: string): Promise<CreditInfo> {
  const base: CreditInfo = {
    slot,
    service,
    label: labelFor(service),
    credits: null,
    exhausted: false,
  }

  try {
    if (service === 'serper') {
      const res = await fetch('https://api.serper.dev/credits', {
        headers: { 'X-API-KEY': value, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const j = await res.json()
        const c = Number(j.credits)
        return { ...base, credits: Number.isFinite(c) ? c : null, exhausted: c <= 0 }
      }
      if (res.status === 402 || res.status === 403) {
        return { ...base, credits: 0, exhausted: true, error: `HTTP ${res.status}` }
      }
      return { ...base, error: `HTTP ${res.status}` }
    }

    if (service === 'llm') {
      // No public quota endpoint — try a minimal models list call to confirm key validity.
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${value}` },
        signal: AbortSignal.timeout(8000),
      })
      if (res.status === 429) {
        return { ...base, credits: 0, exhausted: true, error: 'rate_limited' }
      }
      if (res.status === 401 || res.status === 403) {
        return { ...base, exhausted: true, error: 'invalid_key' }
      }
      return { ...base, credits: null, exhausted: false }
    }

    if (service === 'smtp') {
      return { ...base, credits: null, exhausted: false }
    }
  } catch (e: any) {
    return { ...base, error: e.message }
  }
  return base
}

function labelFor(service: string): string {
  switch (service) {
    case 'serper': return 'Serper.dev'
    case 'llm': return 'LLM / OpenAI'
    case 'smtp': return 'SMTP relay'
    default: return service
  }
}
