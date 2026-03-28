import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('user_id', user.id)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ report: data || null })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: bets } = await supabase
    .from('bet_slips')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: false })

  if (!bets || bets.length === 0) {
    return NextResponse.json({ error: 'No bets this week to generate a report.' }, { status: 400 })
  }

  const won = bets.filter(b => b.result === 'win')
  const lost = bets.filter(b => b.result === 'loss')
  const settled = bets.filter(b => b.result === 'win' || b.result === 'loss')
  const totalPnL = bets.reduce((s, b) => s + (Number(b.profit_loss) || 0), 0)
  const winRate = settled.length > 0 ? Math.round((won.length / settled.length) * 100) : 0
  const bestBet = won.sort((a, b) => b.profit_loss - a.profit_loss)[0]
  const worstBet = lost.sort((a, b) => a.profit_loss - b.profit_loss)[0]
  const totalStake = bets.reduce((s, b) => s + Number(b.stake), 0)
  const roi = totalStake > 0 ? ((totalPnL / totalStake) * 100).toFixed(1) : '0.0'

  const betSummary = bets.slice(0, 20).map(b =>
    `${b.match_name} | ${b.bet_type} on "${b.selection}" | Odds ${b.odds} | Stake £${b.stake} | Result: ${b.result} | P&L: £${b.profit_loss}`
  ).join('\n')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [{
      role: 'system',
      content: 'You are BetIQ, an expert football betting coach. Generate honest, insightful weekly report cards. Be specific, encouraging but realistic. Always return valid JSON.'
    }, {
      role: 'user',
      content: `Generate a weekly betting report card for this user's last 7 days:

Summary: ${bets.length} bets | ${won.length} wins | ${lost.length} losses | Win Rate: ${winRate}% | Total P&L: £${totalPnL.toFixed(2)} | ROI: ${roi}%
Best bet: ${bestBet ? `${bestBet.match_name} +£${Number(bestBet.profit_loss).toFixed(2)}` : 'None'}
Worst bet: ${worstBet ? `${worstBet.match_name} -£${Math.abs(Number(worstBet.profit_loss)).toFixed(2)}` : 'None'}

All bets this week:
${betSummary}

Return JSON with exactly these fields:
{
  "grade": "one of: A+, A, B+, B, C+, C, D, F",
  "headline": "short punchy 5-8 word headline for the week",
  "summary": "2-3 sentence honest overall assessment",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["improvement area 1", "improvement area 2"],
  "best_bet": "specific comment on best decision this week",
  "worst_bet": "honest constructive comment on toughest loss",
  "tip_for_next_week": "one specific actionable tip for improvement",
  "stats": {
    "bets": ${bets.length},
    "wins": ${won.length},
    "losses": ${lost.length},
    "win_rate": "${winRate}%",
    "pnl": ${totalPnL.toFixed(2)},
    "roi": "${roi}%"
  }
}`
    }],
    max_tokens: 1000,
  })

  const reportData = JSON.parse(completion.choices[0]?.message?.content || '{}')
  const weekStart = new Date(weekAgo).toISOString().split('T')[0]

  await supabase.from('weekly_reports').upsert({
    user_id: user.id,
    week_start: weekStart,
    report_data: reportData,
  }, { onConflict: 'user_id,week_start' })

  return NextResponse.json({ report: reportData })
}
