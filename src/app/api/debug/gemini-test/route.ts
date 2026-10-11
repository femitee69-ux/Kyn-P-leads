import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { db } from '@/lib/db'
import { requireUserId, UnauthorizedError } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/'
const GEMINI_MODEL = 'gemini-flash-latest'

/**
 * GET /api/debug/gemini-test
 * Calls Gemini with the actual Kyn'P leads prompt + same params as leads.ts
 * to see what's actually failing in production.
 */
export async function GET() {
  try {
    const userId = await requireUserId()

    const key = await db.apiKey.findFirst({
      where: { userId, slot: 2, active: true },
    })
    if (!key) {
      return NextResponse.json({ error: 'No Gemini key saved in slot 2' }, { status: 400 })
    }

    const result: any = {
      keyPrefix: key.value.slice(0, 6),
      keyLength: key.value.length,
      baseURL: GEMINI_BASE_URL,
      model: GEMINI_MODEL,
    }

    // Use the ACTUAL prompt + params from leads.ts (with country, brand, service)
    const prompt = `Find 10 high-intent prospect personas in France who run or operate coffee shops businesses and would benefit from "paid-ads management".

For each prospect, generate:
- name: realistic full name
- email: a plausible business email
- company: a plausible business name
- position: their role
- message: a personalized cold-outreach email (120-180 words)
- followUpMessage: a 60-90 word polite follow-up email

Return STRICT JSON in this shape:
{
  "leads": [
    { "name": "...", "email": "...", "company": "...", "position": "...", "message": "...", "followUpMessage": "..." }
  ]
}

No prose. No code fences. Only JSON.`

    try {
      const client = new OpenAI({
        apiKey: key.value,
        baseURL: GEMINI_BASE_URL,
      })
      const completion = await client.chat.completions.create({
        model: GEMINI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are Kyn\'P Leads, a B2B lead-generation engine. You produce realistic, plausible prospect personas with personalized, professional outreach copy. You ALWAYS respond in strict JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 2400,
      })
      result.success = true
      result.rawResponse = JSON.parse(JSON.stringify(completion).slice(0, 5000))
      result.responseContent = completion.choices[0]?.message?.content ?? '(empty)'
      result.responseLength = (completion.choices[0]?.message?.content ?? '').length
      result.usage = completion.usage
      result.finishReason = completion.choices[0]?.finish_reason
    } catch (e: any) {
      result.success = false
      result.error = e.message
      if (e.error) result.errorDetails = JSON.parse(JSON.stringify(e.error).slice(0, 2000))
      if (e.status) result.errorStatus = e.status
    }

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
