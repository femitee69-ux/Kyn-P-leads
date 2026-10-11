import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import type { GeneratedLead, CampaignInput } from '@/lib/leads-types'

export type { GeneratedLead, CampaignInput }

/**
 * Calls the Kyn'P Leads AI service to discover leads in the target country
 * relevant to the brand, and composes a tailored outreach message for each
 * lead that preaches the value of the supplied service.
 *
 * If the user has a Serper.dev API key configured in slot 1, Kyn'P first
 * runs a real Google search via Serper to gather candidate companies & URLs,
 * then enriches them via the LLM into prospect personas + outreach copy.
 *
 * Otherwise, falls back to an AI-only persona generator.
 */
export async function generateLeadsForCampaign(
  input: CampaignInput,
  userId: string,
): Promise<{ leads: GeneratedLead[] }> {
  // Try Serper.dev → AI enrichment path if the user has slot 1 configured
  const serperKey = await db.apiKey.findFirst({
    where: { userId, slot: 1, service: 'serper', active: true },
  })

  let companies: { name: string; url: string; snippet: string }[] = []
  if (serperKey) {
    try {
      companies = await searchSerper(serperKey.value, input)
    } catch (e) {
      console.warn('[leads] Serper search failed, falling back to AI only:', e)
      companies = []
    }
  }

  // Build the prompt (with or without Serper context)
  const prompt = buildPrompt(input, companies)

  try {
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are Kyn\'P Leads, a B2B lead-generation engine. You produce realistic, plausible prospect personas with personalized, professional outreach copy. You ALWAYS respond in strict JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 2400,
    })

    const text = completion?.choices?.[0]?.message?.content ?? ''
    const leads = parseLeadsJson(text, input)
    return { leads }
  } catch (err) {
    console.error('[leads/generateLeadsForCampaign] falling back:', err)
    return { leads: fallbackLeads(input) }
  }
}

async function searchSerper(
  apiKey: string,
  input: CampaignInput,
): Promise<{ name: string; url: string; snippet: string }[]> {
  const queries = [
    `${input.brand} companies ${input.country} founder`,
    `${input.brand} ${input.country} contact email`,
    `top ${input.brand} brands in ${input.country}`,
  ]
  const results: { name: string; url: string; snippet: string }[] = []
  for (const q of queries) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q,
          gl: 'us',
          hl: 'en',
          num: 10,
        }),
      })
      if (!res.ok) continue
      const json = await res.json()
      const organic = (json.organic ?? []) as any[]
      for (const r of organic) {
        const name = (r.title ?? '').toString().trim()
        const url = (r.link ?? '').toString().trim()
        const snippet = (r.snippet ?? '').toString().trim()
        if (name && url) results.push({ name, url, snippet })
      }
    } catch {
      // ignore single-query failures
    }
  }
  // de-dup by URL
  const seen = new Set<string>()
  const dedup = results.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
  return dedup.slice(0, 12)
}

function buildPrompt(
  input: CampaignInput,
  companies: { name: string; url: string; snippet: string }[],
): string {
  const companyBlock = companies.length
    ? `\nUse these real companies discovered via Google for ${input.country}:\n${companies
        .map((c, i) => `${i + 1}. ${c.name} — ${c.url} — ${c.snippet}`)
        .join('\n')}\n`
    : ''

  return `Find 10 high-intent prospect personas in ${input.country} who run or operate ${input.brand} businesses (or closely adjacent industries) and would benefit from "${input.service}".

For each prospect, generate:
- name: realistic full name (culturally appropriate for ${input.country})
- email: a plausible business email at their company domain (lowercase)
- company: a plausible business name${companyBlock ? ' — prefer the real ones listed below' : ''}
- position: their role (Founder, Owner, Marketing Director, Operations Lead, etc.)
- message: a personalized cold-outreach email (120-180 words) that preaches how "${input.service}" helps their ${input.brand} business specifically. Be specific, professional, and value-first. Sign off as "Kyn'P — on behalf of the Kyn'P Leads network".
- followUpMessage: a 60-90 word polite follow-up email to be sent 24 hours later if no reply.${companyBlock}

Return STRICT JSON in this shape:
{
  "leads": [
    { "name": "...", "email": "...", "company": "...", "position": "...", "message": "...", "followUpMessage": "..." }
  ]
}

No prose. No code fences. Only JSON.`
}

function parseLeadsJson(text: string, input: CampaignInput): GeneratedLead[] {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned

  try {
    const parsed = JSON.parse(slice)
    const raw = Array.isArray(parsed.leads) ? parsed.leads : Array.isArray(parsed) ? parsed : []
    if (!raw.length) throw new Error('empty leads array')

    return raw.map((r: any) => ({
      name: String(r.name ?? 'Unknown').slice(0, 120),
      email: String(r.email ?? '').slice(0, 160),
      company: String(r.company ?? '').slice(0, 160),
      position: String(r.position ?? '').slice(0, 120),
      message: String(r.message ?? '').slice(0, 4000),
      followUpMessage: r.followUpMessage ? String(r.followUpMessage).slice(0, 2000) : undefined,
    }))
  } catch {
    return fallbackLeads(input)
  }
}

function fallbackLeads({ country, brand, service }: CampaignInput): GeneratedLead[] {
  const samples = [
    { name: 'Amara Okeke', company: 'Heritage Brand Atelier', position: 'Founder & Creative Director' },
    { name: 'Liam Carter', company: 'Vellum & Co.', position: 'Brand Operations Lead' },
    { name: 'Sofia Reyes', company: 'Reyes Brand House', position: 'Marketing Director' },
    { name: 'Daniel Park', company: 'Park & Sons Branding', position: 'Managing Partner' },
    { name: 'Priya Nair', company: 'Studio Nair', position: 'Creative Director' },
    { name: 'Marc Dubois', company: 'Dubois Brand Group', position: 'Founder' },
  ]

  return samples.map((s) => {
    const first = s.name.split(' ')[0]
    const domain = s.company.toLowerCase().replace(/[^a-z]/g, '')
    return {
      name: s.name,
      email: `${first.toLowerCase()}.${domain}@${domain}.com`,
      company: s.company,
      position: s.position,
      message:
        `Hi ${first},\n\n` +
        `I came across ${s.company} while mapping the ${brand} landscape in ${country}, ` +
        `and was struck by the work your team is doing.\n\n` +
        `At Kyn'P Leads, we help ${brand} operators in ${country} activate "${service}" — ` +
        `not as theory, but as a repeatable system your team can run weekly. ` +
        `For a brand of your scale and creative ambition, "${service}" typically unlocks ` +
        `10-25% more qualified pipeline inside the first 45 days.\n\n` +
        `Would you be open to a short, no-pressure call this week? I'll bring a tailored ` +
        `3-step plan for ${s.company}.\n\n` +
        `Kyn'P — on behalf of the Kyn'P Leads network`,
      followUpMessage:
        `Hi ${first},\n\n` +
        `Floating this back to the top of your inbox — happy to keep it tight. ` +
        `If "${service}" is a priority for ${s.company} this quarter, I can send the tailored ` +
        `3-step plan in advance so the call is purely a decision call.\n\n` +
        `Kyn'P`,
    }
  })
}
