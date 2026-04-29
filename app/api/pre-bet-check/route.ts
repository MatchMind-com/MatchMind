import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getUserContext } from '@/lib/user-context'
import { recommendStake } from '@/lib/stake-recommender'

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

    // Pull unified user context + stake recommendation. Best-effort.
    let financialContext = ''
    let stakeFlagOverride: 'caution' | 'risky' | null = null
    let stakeFlagNote = ''
    try {
      const ctx = await getUserContext(user.id)
      if (ctx.bankroll) {
        financialContext = `Bankroll: £${ctx.bankroll.current} (1 unit = £${ctx.bankroll.unitSize}).`
        if (ctx.goal) {
          financialContext += ` Goal: £${ctx.goal.target} by ${ctx.goal.endDate} (${ctx.goal.onTrack ? 'on-track' : 'behind'}, ${ctx.goal.riskLevel}).`
        }
        if (ctx.recentLossStreak >= 3) {
          financialContext += ` On a ${ctx.recentLossStreak}-bet losing streak.`
        }
        // If we have odds + stake, compare against recommendation.
        if (odds && stake) {
          const rec = recommendStake(ctx, odds, 5)
          if (rec.suggestedStake > 0) {
            financialContext += ` Recommended stake for this bet (assuming ~5% edge): £${rec.suggestedStake}.`
            const ratio = stake / rec.suggestedStake
            if (ratio >= 3) {
              stakeFlagOverride = 'risky'
              stakeFlagNote = `User is staking £${stake} — that's ${ratio.toFixed(1)}× the recommended £${rec.suggestedStake}. Significantly oversized for their bankroll.`
            } else if (ratio >= 2) {
              stakeFlagOverride = 'caution'
              stakeFlagNote = `User is staking £${stake} — that's ${ratio.toFixed(1)}× the recommended £${rec.suggestedStake}. Oversized.`
            }
          }
          // Stake exceeds 10% of bankroll — always risky regardless of edge.
          if (stake / ctx.bankroll.current >= 0.10) {
            stakeFlagOverride = 'risky'
            stakeFlagNote = `Stake is ${Math.round((stake / ctx.bankroll.current) * 100)}% of bankroll — well above the 5% safety ceiling.`
          }
        }
      }
    } catch (e) {
      console.warn('[pre-bet-check] user context failed:', e)
    }

    const prompt = `You are a responsible gambling advisor. Assess this bet briefly.

Bet: ${betLabel}${odds ? `\nOdds: ${odds}` : ''}${stake ? `\nStake: £${stake}` : ''}
${recentContext}
${financialContext ? `\nUser financial context: ${financialContext}` : ''}
${stakeFlagNote ? `\nIMPORTANT: ${stakeFlagNote} Reflect this in your rating and reasons.` : ''}

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

    // If we already detected stake-vs-bankroll oversizing, force the rating up.
    let finalRating = parsed.rating ?? 'caution'
    let finalReasons = parsed.reasons ?? []
    if (stakeFlagOverride) {
      const order = { good: 0, caution: 1, risky: 2 } as const
      const current = (order as any)[finalRating] ?? 1
      const override = order[stakeFlagOverride]
      if (override > current) {
        finalRating = stakeFlagOverride
        if (stakeFlagNote && !finalReasons.some(r => r.toLowerCase().includes('stake'))) {
          finalReasons = [stakeFlagNote, ...finalReasons].slice(0, 3)
        }
      }
    }

    return NextResponse.json({
      rating: finalRating,
      reasons: finalReasons,
    })
  } catch (err) {
    console.error('[pre-bet-check]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
