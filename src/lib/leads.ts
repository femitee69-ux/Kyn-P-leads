import OpenAI from 'openai'
import { db } from '@/lib/db'
import type { GeneratedLead, CampaignInput } from '@/lib/leads-types'

export type { GeneratedLead, CampaignInput }

/**
 * Uses Google Gemini (free tier — https://aistudio.google.com/apikey) to
 * compose prospect personas + outreach copy.
 *
 * Free tier limits: 15 req/min, 1,500 req/day, 1M tokens/min — plenty for
 * Kyn'P Leads campaigns (each campaign = ~1 req for ~50 leads).
 *
 * If the user has a Serper.dev API key configured in slot 1, Kyn'P first
 * runs a real Google search via Serper to gather candidate companies & URLs.
 * Kyn'P then scrapes each company's homepage to find REAL contact emails.
 * The real emails are passed to Gemini as part of the prompt, so the AI
 * generates personas BASED ON real companies with REAL email addresses.
 *
 * Falls back to hardcoded sample personas if no Gemini key is configured.
 */
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/'
const GEMINI_MODEL = 'gemini-flash-latest'

export async function generateLeadsForCampaign(
  input: CampaignInput,
  userId: string,
): Promise<{ leads: GeneratedLead[] }> {
  // Step 1: Discover real companies via Serper.dev (if configured)
  const serperKey = await db.apiKey.findFirst({
    where: { userId, slot: 1, service: 'serper', active: true },
  })

  let companies: { name: string; url: string; snippet: string; email: string | null }[] = []
  if (serperKey) {
    try {
      const serperResults = await searchSerper(serperKey.value, input)
      // Step 2: For each company, scrape their homepage to find a real contact email
      companies = await Promise.all(
        serperResults.slice(0, 15).map(async (c) => ({
          ...c,
          email: await discoverEmailFromWebsite(c.url).catch(() => null),
        }))
      )
      console.log(`[leads] Serper discovered ${companies.length} companies, ${companies.filter(c => c.email).length} with real emails`)
    } catch (e) {
      console.warn('[leads] Serper search failed, falling back to AI only:', e)
      companies = []
    }
  }

  // Step 3: Build the prompt with real company data (including emails)
  const prompt = buildPrompt(input, companies)

  // Step 4: Call Gemini to generate personas + messages
  const geminiKey = await getGeminiKey(userId)
  if (!geminiKey) {
    console.warn('[leads] No Gemini key configured — using fallback personas')
    return { leads: fallbackLeads(input) }
  }

  try {
    const client = new OpenAI({
      apiKey: geminiKey,
      baseURL: GEMINI_BASE_URL,
    })

    // Single Gemini call — no retries (to avoid Vercel function timeout).
    // If Gemini is overloaded (503) or rate-limited (429), fall back to
    // sample personas immediately. The user can retry the campaign later.
    let completion
    try {
      completion = await client.chat.completions.create({
        model: GEMINI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are Kyn\'P Leads, a B2B lead-generation engine. You produce realistic, plausible prospect personas with personalized, professional outreach copy. You ALWAYS respond in strict JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 30000,
      })
    } catch (e: any) {
      const status = e.status || e.error?.[0]?.error?.code
      if (status === 503) {
        console.warn('[leads] Gemini overloaded (503) — falling back to sample personas')
      } else if (status === 429) {
        console.warn('[leads] Gemini rate-limited (429) — falling back to sample personas')
      } else {
        console.error('[leads] Gemini call failed:', e.message)
      }
      throw e
    }

    const text = completion?.choices?.[0]?.message?.content ?? ''
    const leads = parseLeadsJson(text, input)

    // Step 5: Override AI-generated emails with REAL emails discovered via scraping
    // (where available — this dramatically increases deliverability)
    const realEmailsByCompany = new Map(
      companies
        .filter((c) => c.email)
        .map((c) => [c.name.toLowerCase(), c.email!])
    )
    const enrichedLeads = leads.map((lead) => {
      const realEmail = realEmailsByCompany.get(lead.company.toLowerCase())
      if (realEmail) {
        return { ...lead, email: realEmail }
      }
      return lead
    })

    return { leads: enrichedLeads }
  } catch (err) {
    console.error('[leads/generateLeadsForCampaign] falling back:', err)
    return { leads: fallbackLeads(input) }
  }
}

async function getGeminiKey(userId: string): Promise<string | null> {
  const key = await db.apiKey.findFirst({
    where: { userId, slot: 2, service: 'llm', active: true },
  })
  if (!key) return null
  return key.value.trim() || null
}

/**
 * Searches Google via Serper.dev for companies matching the campaign's
 * country + brand + service. Returns up to 15 unique results.
 */
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
  const seen = new Set<string>()
  const dedup = results.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
  return dedup.slice(0, 15)
}

/**
 * Scrapes a company's homepage + /contact page to find a real contact email.
 * Looks for mailto: links and email-pattern strings in the HTML.
 * Returns null if no email found.
 *
 * This gives us REAL, verified-to-exist email addresses (at least the
 * domain exists + the email was published publicly on the company site).
 */
async function discoverEmailFromWebsite(url: string): Promise<string | null> {
  try {
    // Normalize URL
    let targetUrl = url
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl

    // Try the homepage first, then /contact if no email found
    const candidatePaths = ['', '/contact', '/contact-us', '/about', '/team']
    for (const path of candidatePaths) {
      try {
        const res = await fetch(targetUrl + path, {
          signal: AbortSignal.timeout(5000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; KynPLeads/1.0; +https://kynpleads.vercel.app)',
            'Accept': 'text/html',
          },
          redirect: 'follow',
        })
        if (!res.ok) continue
        const html = await res.text()
        const email = extractEmailFromHtml(html, targetUrl)
        if (email) return email
      } catch {
        // continue to next path
      }
    }
  } catch {
    // ignore — return null
  }
  return null
}

/**
 * Extracts a plausible business email from HTML.
 * Looks for:
 * 1. mailto: links (highest priority — explicitly published)
 * 2. Emails in the page content (info@, contact@, hello@ patterns)
 * Filters out common non-contact emails (sentry, noreply, etc.)
 */
function extractEmailFromHtml(html: string, pageUrl: string): string | null {
  // mailto: links — explicit published emails
  const mailtoMatch = html.match(/mailto:([^"'?>\s]+@[^"'?>\s]+\.[^"'?>\s]+)/i)
  if (mailtoMatch) {
    const email = mailtoMatch[1].toLowerCase().trim()
    if (isPlausibleBusinessEmail(email)) return email
  }

  // Bare emails in HTML content
  const emailMatches = html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)
  if (emailMatches) {
    // Filter to plausible business emails (skip noreply, support, etc.)
    for (const rawEmail of emailMatches) {
      const email = rawEmail.toLowerCase()
      if (isPlausibleBusinessEmail(email)) return email
    }
  }
  return null
}

function isPlausibleBusinessEmail(email: string): boolean {
  const domain = email.split('@')[1] || ''
  // Skip generic email providers (these aren't company emails)
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com']
  if (genericDomains.includes(domain)) return false
  // Skip non-contact role accounts
  const localPart = email.split('@')[0]
  const skipPrefixes = ['noreply', 'no-reply', 'donotreply', 'sentry', 'notifications', 'notification', 'wp-', 'wordpress', 'example', 'test', 'demo', 'sample']
  if (skipPrefixes.some((p) => localPart.startsWith(p))) return false
  // Must have a valid TLD (at least 2 chars)
  if (!domain.includes('.')) return false
  return true
}

function buildPrompt(
  input: CampaignInput,
  companies: { name: string; url: string; snippet: string; email: string | null }[],
): string {
  const withEmails = companies.filter((c) => c.email)
  const withoutEmails = companies.filter((c) => !c.email)

  let companyBlock = ''
  if (withEmails.length > 0) {
    companyBlock += `\nUse these REAL companies with their REAL verified contact emails (use these emails verbatim — do not invent new ones):\n`
    companyBlock += withEmails.map((c, i) => `${i + 1}. ${c.name} — ${c.url} — contact: ${c.email}`).join('\n')
    companyBlock += '\n'
  }
  if (withoutEmails.length > 0) {
    companyBlock += `\nAlso use these real companies (generate plausible emails at their domain):\n`
    companyBlock += withoutEmails.map((c, i) => `${i + 1}. ${c.name} — ${c.url} — ${c.snippet}`).join('\n')
    companyBlock += '\n'
  }

  return `Find 50 high-intent prospect personas in ${input.country} who run or operate ${input.brand} businesses (or closely adjacent industries) and would benefit from "${input.service}".

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

Generate exactly 50 leads. No prose. No code fences. Only JSON.`
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
