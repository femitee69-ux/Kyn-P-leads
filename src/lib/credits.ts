/**
 * Per-service credit checker.
 *
 * For each active API key, Kyn'P queries the upstream service to discover the
 * remaining credit/quota so we can surface an "exhausted" warning in the UI
 * before the dispatch loop runs into failures.
 */

interface CreditResult {
  slot: number
  service: string
  label: string
  credits: number | null
  exhausted: boolean
  error?: string
  checkedAt: number
}

// Simple in-memory cache to avoid hammering upstreams on every status poll.
const TTL_MS = 60_000 // 60 seconds
const cache = new Map<string, { at: number; result: CreditResult }>()

export async function checkKeyCredit(key: { id: string; slot: number; service: string; value: string }): Promise<CreditResult> {
  const cacheKey = `${key.id}:${key.service}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.result
  }

  let result: CreditResult
  try {
    if (key.service === 'serper') {
      result = await checkSerper(key)
    } else if (key.service === 'llm') {
      result = await checkLlm(key)
    } else {
      result = {
        slot: key.slot,
        service: key.service,
        label: labelFor(key.service),
        credits: null,
        exhausted: false,
        checkedAt: Date.now(),
      }
    }
  } catch (e: any) {
    result = {
      slot: key.slot,
      service: key.service,
      label: labelFor(key.service),
      credits: null,
      exhausted: false,
      error: e.message,
      checkedAt: Date.now(),
    }
  }

  cache.set(cacheKey, { at: Date.now(), result })
  return result
}

async function checkSerper(k: { slot: number; service: string; value: string }): Promise<CreditResult> {
  const res = await fetch('https://api.serper.dev/credits', {
    headers: { 'X-API-KEY': k.value, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (res.status === 402 || res.status === 403) {
    return {
      slot: k.slot,
      service: k.service,
      label: labelFor(k.service),
      credits: 0,
      exhausted: true,
      error: `HTTP ${res.status}`,
      checkedAt: Date.now(),
    }
  }
  if (!res.ok) {
    return {
      slot: k.slot,
      service: k.service,
      label: labelFor(k.service),
      credits: null,
      exhausted: false,
      error: `HTTP ${res.status}`,
      checkedAt: Date.now(),
    }
  }
  const j = await res.json()
  const c = Number(j.credits)
  return {
    slot: k.slot,
    service: k.service,
    label: labelFor(k.service),
    credits: Number.isFinite(c) ? c : null,
    exhausted: c <= 0,
    checkedAt: Date.now(),
  }
}

async function checkLlm(k: { slot: number; service: string; value: string }): Promise<CreditResult> {
  /**
   * No LLM provider has a public "credits remaining" endpoint, but we can
   * verify the key is alive by calling a /models list endpoint. If it
   * returns 429 (rate-limited) or 402 (quota), we mark as exhausted. If
   * 401/403, the key is invalid. The provider endpoint depends on the key
   * prefix:
   *  - "AIza..."  → Google Gemini OpenAI-compatible endpoint
   *  - "gsk_..."  → Groq OpenAI-compatible endpoint
   *  - "cerebras" → Cerebras
   *  - else        → OpenAI (default)
   */
  let baseURL: string
  if (k.value.startsWith('AIza')) {
    baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai'
  } else if (k.value.startsWith('gsk_')) {
    baseURL = 'https://api.groq.com/openai/v1'
  } else if (k.value.startsWith('cerebras')) {
    baseURL = 'https://api.cerebras.ai/v1'
  } else {
    baseURL = 'https://api.openai.com/v1'
  }

  try {
    const res = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${k.value}` },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 429 || res.status === 402) {
      return {
        slot: k.slot,
        service: k.service,
        label: labelFor(k.service),
        credits: 0,
        exhausted: true,
        error: 'rate_limited',
        checkedAt: Date.now(),
      }
    }
    if (res.status === 401 || res.status === 403) {
      return {
        slot: k.slot,
        service: k.service,
        label: labelFor(k.service),
        credits: null,
        exhausted: true,
        error: 'invalid_key',
        checkedAt: Date.now(),
      }
    }
    return {
      slot: k.slot,
      service: k.service,
      label: labelFor(k.service),
      credits: null,
      exhausted: false,
      checkedAt: Date.now(),
    }
  } catch (e: any) {
    return {
      slot: k.slot,
      service: k.service,
      label: labelFor(k.service),
      credits: null,
      exhausted: false,
      error: e.message,
      checkedAt: Date.now(),
    }
  }
}

function labelFor(service: string): string {
  switch (service) {
    case 'serper': return 'Serper.dev'
    case 'llm': return 'LLM / OpenAI'
    case 'smtp': return 'SMTP relay'
    default: return service
  }
}
