import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

const SYSTEM_PROMPT = `You are FootballBetAI, an expert football betting performance coach. You have deep knowledge of football betting markets, value betting, bankroll management, and statistical analysis. Analyze the user's betting data and provide specific, actionable insights to improve their ROI and decision-making. Be direct, data-driven, and encouraging.

When given bet history, analyze:
- Win rate and ROI trends
- Which bet types perform best/worst
- Odds range sweet spots
- Stake sizing patterns
- Areas for improvement

Keep responses concise, structured, and actionable. Use bullet points when listing insights.`

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { prompt, betHistory } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 })
    }

    // Build context from bet history
    let contextMessage = ''
    if (betHistory && Array.isArray(betHistory) && betHistory.length > 0) {
      const wins = betHistory.filter((b) => b.result === 'win').length
      const losses = betHistory.filter((b) => b.result === 'loss').length
      const voids = betHistory.filter((b) => b.result === 'void').length
      const totalPL = betHistory.reduce((sum: number, b: { profitLoss: number }) => sum + (b.profitLoss || 0), 0)
      const winRate = betHistory.length > 0 ? ((wins / betHistory.length) * 100).toFixed(1) : 0
      const avgOdds = betHistory.length > 0
        ? (betHistory.reduce((sum: number, b: { odds: number }) => sum + b.odds, 0) / betHistory.length).toFixed(2)
        : 0

      contextMessage = `
Here is the user's recent betting data (last ${betHistory.length} bets):

SUMMARY STATS:
- Total bets: ${betHistory.length}
- Wins: ${wins}, Losses: ${losses}, Voids: ${voids}
- Win rate: ${winRate}%
- Total P&L: $${totalPL.toFixed(2)}
- Average odds: ${avgOdds}

RECENT BETS:
${betHistory
  .slice(0, 15)
  .map(
    (b: {
      date: string
      match: string
      betType: string
      odds: number
      stake: number
      result: string
      profitLoss: number
    }) =>
      `- ${b.date}: ${b.match} | ${b.betType} @ ${b.odds} | Stake: $${b.stake} | ${b.result.toUpperCase()} | P&L: $${b.profitLoss}`
  )
  .join('\n')}

USER QUESTION: ${prompt}`
    } else {
      contextMessage = `The user has no bet history yet.\n\nUSER QUESTION: ${prompt}`
    }

    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contextMessage },
      ],
      max_tokens: 800,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || 'No response generated.'

    // Save the session
    await supabase.from('ai_sessions').insert({
      user_id: user.id,
      prompt,
      response,
    })

    return NextResponse.json({ response })
  } catch (error: unknown) {
    console.error('AI coach error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to get AI response'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
