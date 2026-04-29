import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { betLabel, odds, stake, recentBets } = body as {
      betLabel: string
      odds?: number
      stake?: number
      recentBets?: { result: string }[]
    }

    if (!betLabel) return NextResponse.json({ error: 'betLabel required' }, { status: 400 })

    const recentLosses = recentBets?.filter(b => b.result === 'loss').length ?? 0
    const recentContext = recentBets && recentBets.length > 0
      ? `The user's last ${recentBets.length} bets had ${recentLosses} losses.`
      : ''

    const prompt = `You are a responsible gambling advisor. Assess this bet briefly.

Bet: ${betLabel}${odds ? `\nOdds: ${odds}` : ''}${stake ? `\nStake: £${stake}` : ''}
${recentContext}

Reply with JSON only, no markdown:
{
  "rating": "good" | "caution" | "risky",
  "reasons": ["reason 1", "reason 2", "reason 3"]
}

"good" = reasonable value bet with solid odds
"caution" = some concerns (high odds, short notice, form issues)
"risky" = very high odds (4+), potential emotional/chase bet, major injuries, poor form`

    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.3,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let parsed: { rating: string; reasons: string[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { rating: 'caution', reasons: ['Unable to assess — proceed with care.'] }
    }

    return NextResponse.json({
      rating: parsed.rating ?? 'caution',
      reasons: parsed.reasons ?? [],
    })
  } catch (err) {
    console.error('[pre-bet-check]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
