import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OpenAI key not configured' }, { status: 500 })
    const openai = new OpenAI({ apiKey })
    const { messages, bets } = await req.json()

    const settled = (bets || []).filter((b: any) => b.result !== 'pending' && b.result !== 'void')
    const wins = settled.filter((b: any) => b.result === 'win')
    const totalPL = (bets || []).reduce((s: number, b: any) => s + Number(b.profit_loss), 0)
    const winRate = settled.length > 0 ? ((wins.length/settled.length)*100).toFixed(0) : 'N/A'

    const userStats = bets?.length > 0 ? `
The user's betting stats:
- Total bets: ${bets.length} (${settled.length} settled)
- Win rate: ${winRate}%
- Total P&L: ${totalPL.toFixed(2)}
- Recent bets: ${JSON.stringify(bets.slice(0,5).map((b: any) => ({ match: b.match_name, bet_type: b.bet_type, league: b.league, result: b.result, odds: b.odds })))}` : 'No betting history available yet.'

    const systemPrompt = `You are BetIQ Football Coach — an expert AI assistant specialising in football analysis, match insights, betting strategy, and sports news. You have deep knowledge of:
- All major football leagues (Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, etc.)
- Team form, tactics, historical head-to-head records, player injuries and suspensions
- Betting markets, value betting, bankroll management, and statistical analysis
- Football news and general knowledge up to early 2025

You also have access to this user's personal betting history to give tailored advice.

${userStats}

Guidelines:
- Be conversational, confident, and insightful
- Give specific data-driven answers when possible
- When asked about recent/upcoming matches, provide analysis based on your knowledge but note if you're uncertain about very recent results
- Always factor in the user's personal betting patterns when relevant
- Keep responses concise but thorough — use bullet points for lists
- Never guarantee outcomes. This is analysis for entertainment and information purposes.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10).map((m: any) => ({ role: m.role, content: m.content }))
      ],
      max_tokens: 800,
    })

    return NextResponse.json({ message: completion.choices[0].message.content })
  } catch (e: any) {
    if (e?.status === 429) return NextResponse.json({ error: 'OpenAI quota exceeded. Add credits at platform.openai.com/billing' }, { status: 429 })
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
