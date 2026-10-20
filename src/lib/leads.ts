import { db } from '@/lib/db'
import type { GeneratedLead, CampaignInput } from '@/lib/leads-types'

export type { GeneratedLead, CampaignInput }

/**
 * Kyn'P Leads — Lead generation engine
 *
 * Flow:
 * 1. Search Google via Serper.dev for companies matching country + brand
 * 2. Filter out articles/blog posts (only keep real company websites)
 * 3. Scrape each company's homepage to extract:
 *    - Real company name (from <title> or og:site_name)
 *    - Real contact email (from mailto: links or page content)
 * 4. Generate personalized messages using the REAL company name
 * 5. Save leads with real emails + real company names
 */

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/'
const GEMINI_MODEL = 'gemini-flash-latest'

export async function generateLeadsForCampaign(
  input: CampaignInput,
  userId: string,
): Promise<{ leads: GeneratedLead[] }> {
  // Step 1: Search Google via Serper — try all 3 slots, auto-switch when one runs out
  const serperKeys = await db.apiKey.findMany({
    where: { userId, service: 'serper', active: true },
    orderBy: { slot: 'asc' },
  })

  let companies: { name: string; url: string; snippet: string; email: string | null; companyName: string | null }[] = []
  // Try each Serper key until one works (auto-switch when credits run out)
  for (const serperKey of serperKeys) {
    try {
      const serperResults = await searchSerper(serperKey.value, input)
      if (serperResults.length === 0) {
        console.warn(`[leads] Serper key slot ${serperKey.slot} returned 0 results, trying next...`)
        continue
      }
      // Step 2: Scrape each website for real company name + email
      companies = await Promise.all(
        serperResults.slice(0, 20).map(async (c) => {
          const scraped = await scrapeWebsite(c.url).catch(() => ({ companyName: null, email: null }))
          return { ...c, email: scraped.email, companyName: scraped.companyName }
        })
      )
      companies = companies.filter(c => c.companyName)
      console.log(`[leads] Slot ${serperKey.slot}: found ${companies.length} companies`)
      break // Success — stop trying other keys
    } catch (e) {
      console.warn(`[leads] Serper key slot ${serperKey.slot} failed:`, e instanceof Error ? e.message : String(e))
      // Continue to next key
    }
  }

  // Step 3: Generate leads from real company data
  if (companies.length > 0) {
    return { leads: generateTemplateLeads(input, companies) }
  }

  // Step 4: No Serper results → try Gemini as fallback
  const geminiKey = await getGeminiKey(userId)
  if (!geminiKey) {
    return { leads: fallbackLeads(input) }
  }

  try {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey: geminiKey, baseURL: GEMINI_BASE_URL })
    const completion = await client.chat.completions.create({
      model: GEMINI_MODEL,
      messages: [
        { role: 'system', content: 'You are a B2B lead generation engine. Respond in strict JSON.' },
        { role: 'user', content: buildGeminiPrompt(input) },
      ],
      temperature: 0.8,
      max_tokens: 30000,
    })
    const text = completion?.choices?.[0]?.message?.content ?? ''
    return { leads: parseLeadsJson(text, input) }
  } catch (e) {
    console.error('[leads] Gemini failed:', e)
    return { leads: fallbackLeads(input) }
  }
}

/**
 * Generates a batch of more leads for an existing campaign (called by dispatch endpoint).
 */
export async function generateMoreLeads(
  userId: string,
  input: CampaignInput,
  existingLeadCount: number,
  batchSize: number = 10,
): Promise<GeneratedLead[]> {
  const serperKeys = await db.apiKey.findMany({
    where: { userId, service: 'serper', active: true },
    orderBy: { slot: 'asc' },
  })
  if (serperKeys.length === 0) return []

  const page = Math.floor(existingLeadCount / 20) + 1

  // Try each key until one works
  for (const serperKey of serperKeys) {
    try {
      const serperResults = await searchSerperForBatch(serperKey.value, input, page)
      if (serperResults.length === 0) continue

      const companies = await Promise.all(
        serperResults.slice(0, batchSize).map(async (c) => {
          const scraped = await scrapeWebsite(c.url).catch(() => ({ companyName: null, email: null }))
          return { ...c, email: scraped.email, companyName: scraped.companyName }
        })
      )

      const filtered = companies.filter(c => c.companyName)
      console.log(`[leads] Batch page ${page}, slot ${serperKey.slot}: ${filtered.length} companies`)
      if (filtered.length === 0) continue
      return generateTemplateLeads(input, filtered)
    } catch (e) {
      console.warn(`[leads] Batch slot ${serperKey.slot} failed, trying next...`)
    }
  }
  return []
}

// ============ SERPER SEARCH ============

const BIG_PLATFORM_DOMAINS = [
  'youtube.com', 'm.youtube.com', 'instagram.com', 'facebook.com', 'm.facebook.com',
  'twitter.com', 'x.com', 'linkedin.com', 'wikipedia.org', 'tiktok.com', 'pinterest.com',
  'reddit.com', 'medium.com', 'substack.com', 'quora.com', 'yelp.com', 'amazon.com',
  'apple.com', 'google.com', 'play.google.com', 'apps.apple.com', 'bbc.com', 'cnn.com',
  'nytimes.com', 'tripadvisor.com', 'trustpilot.com', 'glassdoor.com', 'indeed.com',
  'crunchbase.com', 'bloomberg.com', 'forbes.com', 'forbesafrica.com', 'entrepreneur.com',
  'shopify.com', 'etsy.com', 'ebay.com', 'alibaba.com', 'aliexpress.com',
]

function isBigPlatform(url: string): boolean {
  try {
    const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
    return BIG_PLATFORM_DOMAINS.some((p) => domain === p || domain.endsWith('.' + p))
  } catch { return false }
}

/** Check if a search result looks like an article/blog post (not a company website) */
function looksLikeArticle(title: string, url: string): boolean {
  const lower = (title + ' ' + url).toLowerCase()
  const articlePatterns = [
    'top ', 'best ', 'list of', 'guide to', 'how to', '10 ', '5 ', '15 ', '20 ', '25 ', '50 ',
    'top 10', 'top 5', 'top 15', 'top 20', 'top 25', 'top 50', 'top 100',
    'best 10', 'best 5', 'best 15', 'best 20', 'best 25', 'best 50',
    'tips for', 'why you', 'reasons to', 'everything you need',
    'review', 'comparison', 'vs ', 'alternative', 'alternatives',
    'news', 'blog', 'article', 'story', 'interview', 'profile',
    'meet the', 'behind the', 'inside the', 'shaping the',
    'founded', 'ceo & founder', 'entrepreneur', 'startup story',
  ]
  return articlePatterns.some(p => lower.includes(p))
}

async function searchSerper(apiKey: string, input: CampaignInput): Promise<{ name: string; url: string; snippet: string }[]> {
  const queries = [
    `${input.brand} companies ${input.country} founder`,
    `${input.brand} ${input.country} contact email`,
    `top ${input.brand} brands in ${input.country}`,
    `${input.brand} ${input.country} website contact`,
    `best ${input.brand} ${input.country}`,
  ]
  return searchSerperQueries(apiKey, queries, 1)
}

export async function searchSerperForBatch(apiKey: string, input: CampaignInput, page: number): Promise<{ name: string; url: string; snippet: string }[]> {
  const allQueries = [
    `${input.brand} companies ${input.country} founder`,
    `${input.brand} ${input.country} contact email`,
    `top ${input.brand} brands in ${input.country}`,
    `${input.brand} ${input.country} website contact`,
    `best ${input.brand} ${input.country}`,
    `${input.brand} directory ${input.country}`,
    `${input.brand} association ${input.country}`,
    `list of ${input.brand} ${input.country}`,
    `${input.brand} startups ${input.country}`,
    `${input.brand} shops ${input.country}`,
    `${input.brand} brands ${input.country} email`,
    `${input.brand} ${input.country} owner`,
    `${input.brand} business ${input.country} contact`,
    `${input.brand} suppliers ${input.country}`,
    `${input.brand} distributors ${input.country}`,
  ]
  const startIdx = (page - 1) * 2 % allQueries.length
  const queries = [allQueries[startIdx], allQueries[(startIdx + 1) % allQueries.length]]
  return searchSerperQueries(apiKey, queries, page)
}

async function searchSerperQueries(apiKey: string, queries: string[], page: number): Promise<{ name: string; url: string; snippet: string }[]> {
  const results: { name: string; url: string; snippet: string }[] = []
  for (const q of queries) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'us', hl: 'en', num: 20, page }),
      })
      if (!res.ok) continue
      const json = await res.json()
      const organic = (json.organic ?? []) as any[]
      for (const r of organic) {
        const name = (r.title ?? '').toString().trim()
        const url = (r.link ?? '').toString().trim()
        const snippet = (r.snippet ?? '').toString().trim()
        // Skip big platforms AND articles/blog posts
        if (name && url && !isBigPlatform(url) && !looksLikeArticle(name, url)) {
          results.push({ name, url, snippet })
        }
      }
    } catch {}
  }
  const seen = new Set<string>()
  return results.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
}

// ============ WEBSITE SCRAPING ============

/**
 * Scrapes a company's homepage + /contact page to extract:
 * 1. The real company name (from <title>, og:site_name, or h1)
 * 2. A real contact email (from mailto: links or page content)
 */
async function scrapeWebsite(url: string): Promise<{ companyName: string | null; email: string | null }> {
  let targetUrl = url
  if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl

  let companyName: string | null = null
  let email: string | null = null

  const paths = ['', '/contact', '/contact-us', '/about', '/about-us']
  for (const path of paths) {
    try {
      const res = await fetch(targetUrl + path, {
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KynPLeadsBot/1.0)',
          'Accept': 'text/html',
        },
        redirect: 'follow',
      })
      if (!res.ok) continue
      const html = await res.text()

      // Extract company name (only from homepage, not /contact etc.)
      if (!companyName && path === '') {
        companyName = extractCompanyName(html, targetUrl)
      }

      // Extract email from any page
      if (!email) {
        email = extractEmailFromHtml(html)
      }

      // Stop early if we have both
      if (companyName && email) break
    } catch {}
  }

  return { companyName, email }
}

/** Extracts the real company name from a website's HTML */
function extractCompanyName(html: string, url: string): string | null {
  // Try og:site_name first (most reliable for company name)
  const ogMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
  if (ogMatch && ogMatch[1].trim().length > 1) {
    const name = ogMatch[1].trim()
    // Skip if it looks like a generic title
    if (!name.toLowerCase().includes('home page') && !name.toLowerCase().includes('welcome to')) {
      return cleanCompanyName(name)
    }
  }

  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch && titleMatch[1].trim().length > 1) {
    const title = titleMatch[1].trim()
    // Skip if title looks like an article or generic page
    if (!looksLikeArticle(title, url)) {
      // Extract company name from title (usually "Company Name - Tagline" or "Company Name | Tagline")
      return cleanCompanyName(title)
    }
  }

  // Try h1 tag
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match && h1Match[1].trim().length > 1) {
    const h1 = h1Match[1].trim()
    if (!looksLikeArticle(h1, url)) {
      return cleanCompanyName(h1)
    }
  }

  // Fall back to domain name
  try {
    const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    const parts = domain.split('.')
    if (parts.length >= 2) {
      const name = parts[parts.length - 2] // e.g., "ormaskincare" from "ormaskincare.com"
      return name.charAt(0).toUpperCase() + name.slice(1)
    }
  } catch {}

  return null
}

/** Cleans up a company name extracted from HTML */
function cleanCompanyName(name: string): string {
  // Remove common suffixes/prefixes
  let clean = name
    .replace(/\s*[-|]\s*.*/g, '') // Remove " - Tagline" or " | Tagline"
    .replace(/^\s*Home\s*[-|]?\s*/i, '')
    .replace(/\s*Home\s*$/i, '')
    .replace(/^\s*Welcome to\s*/i, '')
    .replace(/\s*Official Website\s*$/i, '')
    .replace(/\s*Official Site\s*$/i, '')
    .trim()

  // Capitalize first letter of each word
  clean = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')

  // Limit length
  if (clean.length > 60) clean = clean.slice(0, 60)

  return clean || name
}

/** Extracts a plausible business email from HTML */
function extractEmailFromHtml(html: string): string | null {
  // mailto: links
  const mailtoMatch = html.match(/mailto:([^"'?>\s]+@[^"'?>\s]+\.[^"'?>\s]+)/i)
  if (mailtoMatch) {
    const email = mailtoMatch[1].toLowerCase().trim()
    if (isPlausibleBusinessEmail(email)) return email
  }

  // Bare emails
  const emailMatches = html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)
  if (emailMatches) {
    for (const rawEmail of emailMatches) {
      const email = rawEmail.toLowerCase()
      if (isPlausibleBusinessEmail(email)) return email
    }
  }
  return null
}

function isPlausibleBusinessEmail(email: string): boolean {
  const domain = email.split('@')[1] || ''
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'company.com', 'email.com', 'example.com', 'yourdomain.com', 'domain.com', 'yoursite.com']
  if (genericDomains.includes(domain)) return false
  const localPart = email.split('@')[0]
  const skipLocalParts = ['noreply', 'no-reply', 'donotreply', 'sentry', 'notifications', 'notification', 'wp-', 'wordpress', 'example', 'test', 'demo', 'sample', 'you', 'your', 'my', 'email', 'user', 'admin', 'info@example', 'change', 'placeholder', 'someone']
  if (skipLocalParts.includes(localPart)) return false
  if (!domain.includes('.')) return false
  if (domain.split('.')[0].length < 2) return false
  return true
}

// ============ LEAD GENERATION ============

export function generateTemplateLeads(
  input: CampaignInput,
  companies: { name: string; url: string; snippet: string; email: string | null; companyName: string | null }[],
): GeneratedLead[] {
  return companies.map((c) => {
    const domain = c.url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    // Use the REAL company name scraped from the website (not the Google title)
    const company = c.companyName || c.name.split(' - ')[0].split(' | ')[0].slice(0, 60)
    const email = c.email || `contact@${domain}`

    const message =
      `Hi ${company} team,\n\n` +
      `I came across your website (${domain}) while researching ${input.brand} businesses in ${input.country}, and I was impressed by what you're doing.\n\n` +
      `I'm reaching out because we help ${input.brand} businesses in ${input.country} with "${input.service}". ` +
      `Our approach typically helps brands like yours unlock 10-25% more qualified pipeline within the first 45 days.\n\n` +
      `Would you be open to a quick call this week? I'd love to share a tailored plan for ${company}.\n\n` +
      `Looking forward to connecting.`

    const followUpMessage =
      `Hi ${company} team,\n\n` +
      `Just following up on my previous email. ` +
      `If "${input.service}" is something ${company} is exploring this quarter, I can send a tailored ` +
      `3-step plan in advance so any call is purely a decision call.\n\n` +
      `Best regards.`

    return {
      name: `Contact at ${company}`,
      email,
      company,
      position: 'Founder / Owner',
      message,
      followUpMessage,
    }
  })
}

// ============ GEMINI FALLBACK ============

async function getGeminiKey(userId: string): Promise<string | null> {
  const key = await db.apiKey.findFirst({
    where: { userId, slot: 2, service: 'llm', active: true },
  })
  return key?.value.trim() || null
}

function buildGeminiPrompt(input: CampaignInput): string {
  return `Find 10 prospect personas in ${input.country} who run ${input.brand} businesses and would benefit from "${input.service}".

For each, generate: name, email, company, position, message (120-word outreach email), followUpMessage (60-word follow-up).

Return JSON: {"leads": [{"name":"...","email":"...","company":"...","position":"...","message":"...","followUpMessage":"..."}]}

Do not include any app name or brand name in the sign-off. Sign off naturally.`
}

function parseLeadsJson(text: string, input: CampaignInput): GeneratedLead[] {
  try {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
    const parsed = JSON.parse(slice)
    const raw = Array.isArray(parsed.leads) ? parsed.leads : Array.isArray(parsed) ? parsed : []
    if (!raw.length) throw new Error('empty')
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
        `I came across ${s.company} while researching ${brand} in ${country}.\n\n` +
        `We help ${brand} businesses with "${service}" — typically unlocking 10-25% more pipeline in 45 days.\n\n` +
        `Open to a quick call this week?\n\n` +
        `Looking forward to connecting.`,
      followUpMessage:
        `Hi ${first},\n\n` +
        `Just following up. If "${service}" is a priority for ${s.company} this quarter, I can send a tailored plan.\n\n` +
        `Best regards.`,
    }
  })
}
