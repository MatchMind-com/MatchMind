import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OpenAI key not configured' }, { status: 500 })
    const openai = new OpenAI({ apiKey })
    const { bets } = await req.json()

    const settled = bets.filter((b: any) => b.result !== 'pending' && b.result !== 'void')
    if (settled.length === 0) return NextResponse.json({ suggestions: [{ title: 'Not enough data yet', insight: 'You need at least a few settled bets before the AI can provide meaningful insights.', action: 'Add bet slips and mark them as won or lost to get started.', type: 'info' }] })

    const wins = settled.filter((b: any) => b.result === 'win')
    const losses = settled.filter((b: any) => b.result === 'loss')
    const totalStake = settled.reduce((s: number, b: any) => s + Number(b.stake), 0)
    const totalPL = bets.reduce((s: number, b: any) => s + Number(b.profit_loss), 0)

    const byLeague: Record<string, { wins: number; total: number; pl: number; stake: number }> = {}
    const byType: Record<string, { wins: number; total: number; pl: number; stake: number }> = {}
    settled.forEach((b: any) => {
      const l = b.league || 'Unknown'; const t = b.bet_type || 'Unknown'
      if (!byLeague[l]) byLeague[l] = { wins: 0, total: 0, pl: 0, stake: 0 }
      if (!byType[t]) byType[t] = { wins: 0, total: 0, pl: 0, stake: 0 }
      byLeague[l].total++; byType[t].total++
      byLeague[l].stake += Number(b.stake); byType[t].stake += Number(b.stake)
      byLeague[l].pl += Number(b.profit_loss); byType[t].pl += Number(b.profit_loss)
      if (b.result === 'win') { byLeague[l].wins++; byType[t].wins++ }
    })

    const summary = `
Betting history summary:
- Total settled bets: ${settled.length} (${wins.length} wins, ${losses.length} losses)
- Win rate: ${((wins.length/settled.length)*100).toFixed(1)}%
- Total P&L: ${totalPL.toFixed(2)} on ${totalStake.toFixed(2)} staked
- ROI: ${totalStake > 0 ? ((totalPL/totalStake)*100).toFixed(1) : 0}%
- By league: ${JSON.stringify(byLeague)}
- By bet type: ${JSON.stringify(byType)}
- Recent 5 bets: ${JSON.stringify(bets.slice(0,5).map((b: any) => ({ match: b.match_name, result: b.result, pl: b.profit_loss })))}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: 'You are a professional football betting analyst. Analyse the user\'s betting data and return ONLY a JSON array of 4-6 insight cards. Each card: { "title": "short title", "insight": "1-2 sentence explanation", "action": "specific actionable advice", "type": "positive|warning|info|danger" }. Be specific, data-driven, and brutally honest. Look for patterns in leagues, bet types, stakes, and timing.'
      }, {
        role: 'user', content: summary
      }],
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0].message.content || '{}'
    const parsed = JSON.parse(content)
    const suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || parsed.insights || [])
    return NextResponse.json({ suggestions })
  } catch (e: any) {
    if (e?.status === 429) return NextResponse.json({ error: 'OpenAI quota exceeded. Add credits at platform.openai.com/billing' }, { status: 429 })
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
