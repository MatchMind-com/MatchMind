import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const revalidate = 3600 // 1 hour cache

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data: records } = await supabaseAdmin
      .from('prediction_records')
      .select('*')
      .not('result', 'is', null)
      .order('kick_off', { ascending: false })
      .limit(500)

    if (!records || records.length === 0) {
      return NextResponse.json({ stats: null, byLeague: [], recent: [], chartData: [] })
    }

    const settled = records.filter(r => r.result !== 'void')
    const wins = settled.filter(r => r.result === 'win').length
    const losses = settled.filter(r => r.result === 'loss').length
    const voids = records.filter(r => r.result === 'void').length
    const totalProfit = records.reduce((sum, r) => sum + (r.profit_loss || 0), 0)
    const winRate = settled.length > 0 ? Math.round((wins / settled.length) * 100) : 0
    const roi = settled.length > 0 ? Math.round((totalProfit / settled.length) * 100) / 100 : 0
    const avgOdds = records.length > 0
      ? Math.round((records.reduce((s, r) => s + (r.odds || 0), 0) / records.length) * 100) / 100
      : 0

    // Value bets subset
    const valueBets = records.filter(r => r.is_value_bet)
    const vbWins = valueBets.filter(r => r.result === 'win').length
    const vbSettled = valueBets.filter(r => r.result !== 'void')
    const vbProfit = valueBets.reduce((s, r) => s + (r.profit_loss || 0), 0)
    const vbWinRate = vbSettled.length > 0 ? Math.round((vbWins / vbSettled.length) * 100) : 0
    const vbROI = vbSettled.length > 0 ? Math.round((vbProfit / vbSettled.length) * 100) / 100 : 0

    // By league
    const leagueMap: Record<string, { wins: number; losses: number; profit: number; tips: number }> = {}
    for (const r of records) {
      if (!leagueMap[r.league]) leagueMap[r.league] = { wins: 0, losses: 0, profit: 0, tips: 0 }
      leagueMap[r.league].tips++
      leagueMap[r.league].profit += r.profit_loss || 0
      if (r.result === 'win') leagueMap[r.league].wins++
      if (r.result === 'loss') leagueMap[r.league].losses++
    }
    const byLeague = Object.entries(leagueMap)
      .map(([league, s]) => ({
        league,
        tips: s.tips,
        wins: s.wins,
        losses: s.losses,
        winRate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
        profit: Math.round(s.profit * 100) / 100,
      }))
      .sort((a, b) => b.profit - a.profit)

    // By bet type
    const betTypeMap: Record<string, { wins: number; losses: number; profit: number }> = {}
    for (const r of records) {
      const t = r.bet_type || 'Other'
      if (!betTypeMap[t]) betTypeMap[t] = { wins: 0, losses: 0, profit: 0 }
      betTypeMap[t].profit += r.profit_loss || 0
      if (r.result === 'win') betTypeMap[t].wins++
      if (r.result === 'loss') betTypeMap[t].losses++
    }
    const byBetType = Object.entries(betTypeMap)
      .map(([type, s]) => ({
        type,
        wins: s.wins,
        losses: s.losses,
        winRate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
        profit: Math.round(s.profit * 100) / 100,
      }))
      .sort((a, b) => b.profit - a.profit)

    // Cumulative P&L chart data (chronological)
    const chronological = [...records].sort((a, b) =>
      new Date(a.kick_off).getTime() - new Date(b.kick_off).getTime()
    )
    let cumulative = 0
    const chartData = chronological.map(r => {
      cumulative += r.profit_loss || 0
      return {
        date: r.kick_off?.split('T')[0],
        cumulative: Math.round(cumulative * 100) / 100,
        result: r.result,
      }
    })

    // Recent settled predictions (last 20)
    const recent = records.slice(0, 20).map(r => ({
      id: r.id,
      home_team: r.home_team,
      away_team: r.away_team,
      league: r.league,
      kick_off: r.kick_off,
      bet_type: r.bet_type,
      odds: r.odds,
      ev_percent: r.ev_percent,
      is_value_bet: r.is_value_bet,
      result: r.result,
      profit_loss: r.profit_loss,
      home_score: r.home_score,
      away_score: r.away_score,
    }))

    return NextResponse.json({
      stats: {
        total: records.length,
        wins,
        losses,
        voids,
        winRate,
        roi,
        totalProfit: Math.round(totalProfit * 100) / 100,
        avgOdds,
        valueBets: {
          total: valueBets.length,
          winRate: vbWinRate,
          roi: vbROI,
          profit: Math.round(vbProfit * 100) / 100,
        }
      },
      byLeague,
      byBetType,
      recent,
      chartData,
    })
  } catch (err: any) {
    console.error('Track record API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
