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
 * Calls Gemini with a tiny prompt to verify the key works from Vercel.
 * Returns the response or the exact error.
 */
export async function GET() {
  try {
    const userId = await requireUserId()

    // Fetch the user's Gemini key
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

    try {
      const client = new OpenAI({
        apiKey: key.value,
        baseURL: GEMINI_BASE_URL,
      })
      const completion = await client.chat.completions.create({
        model: GEMINI_MODEL,
        messages: [
          { role: 'system', content: 'You are a test assistant.' },
          { role: 'user', content: 'Say hello in 5 words.' },
        ],
        max_tokens: 30,
      })
      result.success = true
      result.response = completion.choices[0].message.content
      result.usage = completion.usage
    } catch (e: any) {
      result.success = false
      result.error = e.message
      if (e.error) result.errorDetails = e.error
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
