import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

async function fetchFixtureResult(fixtureId: number) {
  try {
    const res = await fetch(`${BASE}/fixtures?id=${fixtureId}`, {
      headers: { 'x-apisports-key': API_KEY },
    })
    const json = await res.json()
    const fixture = json.response?.[0]
    if (!fixture) return null

    const status = fixture.fixture?.status?.short
    // Only process finished matches
    if (!['FT', 'AET', 'PEN'].includes(status)) return null

    return {
      homeScore: fixture.goals?.home ?? 0,
      awayScore: fixture.goals?.away ?? 0,
      status,
    }
  } catch { return null }
}

function determineResult(
  prediction: string,
  homeScore: number,
  awayScore: number
): 'win' | 'loss' | 'void' {
  const totalGoals = homeScore + awayScore
  const btts = homeScore > 0 && awayScore > 0

  switch (prediction) {
    case 'home_win':
      return homeScore > awayScore ? 'win' : 'loss'
    case 'away_win':
      return awayScore > homeScore ? 'win' : 'loss'
    case 'draw':
      return homeScore === awayScore ? 'win' : 'loss'
    case 'over_2.5_goals':
    case 'over_2_5':
    case 'over_2_5_goals':
      return totalGoals > 2 ? 'win' : 'loss'
    case 'under_2.5_goals':
    case 'under_2_5':
      return totalGoals < 3 ? 'win' : 'loss'
    case 'btts':
    case 'btts_yes':
    case 'both_teams_score':
      return btts ? 'win' : 'loss'
    case 'btts_no':
      return !btts ? 'win' : 'loss'
    default:
      // For any other label, try to parse from bet_type text
      if (prediction.includes('home')) return homeScore > awayScore ? 'win' : 'loss'
      if (prediction.includes('away')) return awayScore > homeScore ? 'win' : 'loss'
      if (prediction.includes('draw')) return homeScore === awayScore ? 'win' : 'loss'
      if (prediction.includes('over')) return totalGoals > 2 ? 'win' : 'loss'
      return 'void'
  }
}

export async function GET(req: NextRequest) {
  // Security: only allow Vercel cron or internal calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      req.headers.get('x-vercel-cron') !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch pending predictions where kick_off was more than 2 hours ago
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: pending, error } = await supabaseAdmin
      .from('prediction_records')
      .select('*')
      .is('result', null)
      .lt('kick_off', cutoff)
      .limit(50)

    if (error) throw error
    if (!pending || pending.length === 0) {
      return NextResponse.json({ message: 'No pending predictions to check', checked: 0 })
    }

    let checked = 0
    let wins = 0
    let losses = 0

    for (const record of pending) {
      const matchResult = await fetchFixtureResult(record.fixture_id)
      if (!matchResult) continue // match not finished yet

      const { homeScore, awayScore } = matchResult
      const result = determineResult(record.prediction, homeScore, awayScore)

      // Calculate P&L (1 unit stake)
      let profitLoss = 0
      if (result === 'win') {
        profitLoss = Math.round(((record.odds || 2) - 1) * 100) / 100
        wins++
      } else if (result === 'loss') {
        profitLoss = -1
        losses++
      } else {
        profitLoss = 0
      }

      await supabaseAdmin
        .from('prediction_records')
        .update({
          result,
          profit_loss: profitLoss,
          home_score: homeScore,
          away_score: awayScore,
          checked_at: new Date().toISOString(),
        })
        .eq('id', record.id)

      checked++
    }

    return NextResponse.json({
      message: `Checked ${checked} predictions`,
      checked, wins, losses,
      pending_remaining: pending.length - checked,
    })
  } catch (err: any) {
    console.error('Check predictions cron error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
