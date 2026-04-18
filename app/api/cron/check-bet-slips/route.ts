import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

interface MatchResult {
  homeScore: number
  awayScore: number
  homeTeam: string
  awayTeam: string
  status: string
}

async function fetchMatchResult(fixtureId: number): Promise<MatchResult | null> {
  try {
    const res = await fetch(`${BASE}/fixtures?id=${fixtureId}`, {
      headers: { 'x-apisports-key': API_KEY },
    })
    const json = await res.json()
    const f = json.response?.[0]
    if (!f) return null
    const status = f.fixture?.status?.short
    if (!['FT', 'AET', 'PEN'].includes(status)) return null
    return {
      homeScore: f.goals?.home ?? 0,
      awayScore: f.goals?.away ?? 0,
      homeTeam: f.teams?.home?.name || '',
      awayTeam: f.teams?.away?.name || '',
      status,
    }
  } catch { return null }
}

// Determine win/loss from selection text + actual scores
// match_name format: "Tottenham vs Brighton"
function determineResult(
  betType: string,
  selection: string,
  matchName: string,
  homeScore: number,
  awayScore: number
): 'win' | 'loss' | 'void' {
  const sel = selection.toLowerCase()
  const total = homeScore + awayScore
  const btts = homeScore > 0 && awayScore > 0
  const [homeTeam, awayTeam] = matchName.split(' vs ').map(s => s.trim().toLowerCase())

  const type = betType.toLowerCase()

  // ── Match Result / 1X2 ──────────────────────────────
  if (type.includes('match result') || type.includes('1x2') || type.includes('winner')) {
    if (sel === 'draw') return homeScore === awayScore ? 'win' : 'loss'
    // Check if selection mentions the home team
    if (homeTeam && sel.includes(homeTeam)) return homeScore > awayScore ? 'win' : 'loss'
    // Check if selection mentions the away team
    if (awayTeam && sel.includes(awayTeam)) return awayScore > homeScore ? 'win' : 'loss'
    // Generic home/away/draw
    if (sel.includes('home')) return homeScore > awayScore ? 'win' : 'loss'
    if (sel.includes('away')) return awayScore > homeScore ? 'win' : 'loss'
  }

  // ── Goals Over/Under ────────────────────────────────
  if (type.includes('over') || type.includes('under') || type.includes('goal')) {
    const match = sel.match(/(\d+\.?\d*)/)
    const line = match ? parseFloat(match[1]) : 2.5
    if (sel.includes('over')) return total > line ? 'win' : 'loss'
    if (sel.includes('under')) return total < line ? 'win' : 'loss'
  }

  // ── Both Teams Score ────────────────────────────────
  if (type.includes('both') || type.includes('btts') || type.includes('gg')) {
    if (sel.includes('yes') || sel.includes('gg')) return btts ? 'win' : 'loss'
    if (sel.includes('no') || sel.includes('ng')) return !btts ? 'win' : 'loss'
  }

  // ── Double Chance ───────────────────────────────────
  if (type.includes('double chance')) {
    const home = homeTeam && sel.includes(homeTeam)
    const away = awayTeam && sel.includes(awayTeam)
    const draw = sel.includes('draw') || sel.includes('x')
    if ((home && homeScore >= awayScore) || (away && awayScore >= homeScore) || (draw && homeScore === awayScore)) return 'win'
    return 'loss'
  }

  // ── Draw No Bet ─────────────────────────────────────
  if (type.includes('draw no bet')) {
    if (homeScore === awayScore) return 'void'
    const home = homeTeam && sel.includes(homeTeam)
    const away = awayTeam && sel.includes(awayTeam)
    if (home) return homeScore > awayScore ? 'win' : 'loss'
    if (away) return awayScore > homeScore ? 'win' : 'loss'
  }

  // ── Win to Nil ──────────────────────────────────────
  if (type.includes('win to nil') || sel.includes('win to nil')) {
    const home = homeTeam && sel.includes(homeTeam)
    const away = awayTeam && sel.includes(awayTeam)
    if (home) return homeScore > awayScore && awayScore === 0 ? 'win' : 'loss'
    if (away) return awayScore > homeScore && homeScore === 0 ? 'win' : 'loss'
  }

  // ── Half-time Result ────────────────────────────────
  // (We don't have HT scores from the basic fixtures endpoint — mark void for now)
  if (type.includes('half') || type.includes('ht')) return 'void'

  // ── Corners / Cards / Correct Score etc. ────────────
  // Can't auto-detect without additional API data
  return 'void'
}

// Check all legs of an accumulator — all must win
function checkAccaLegs(
  legs: { match_name: string; bet_type: string; selection: string; odds: number }[],
  results: Map<string, MatchResult>
): 'win' | 'loss' | 'void' | 'pending' {
  let anyPending = false
  for (const leg of legs) {
    const r = results.get(leg.match_name)
    if (!r) { anyPending = true; continue }
    const legResult = determineResult(leg.bet_type, leg.selection, leg.match_name, r.homeScore, r.awayScore)
    if (legResult === 'loss') return 'loss'   // One loss = whole ACCA lost
    if (legResult === 'void') return 'void'   // Void leg = void ACCA (simplified)
  }
  if (anyPending) return 'pending'
  return 'win'
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      req.headers.get('x-vercel-cron') !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find pending bets where match_date was yesterday or earlier
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 1)
    const cutoffDate = cutoff.toISOString().split('T')[0]

    const { data: pending, error } = await supabaseAdmin
      .from('bet_slips')
      .select('*')
      .eq('result', 'pending')
      .lte('match_date', cutoffDate)
      .limit(100)

    if (error) throw error
    if (!pending || pending.length === 0) {
      return NextResponse.json({ message: 'No pending bets to check', checked: 0 })
    }

    let checked = 0, wins = 0, losses = 0, voided = 0, skipped = 0

    for (const bet of pending) {
      // ── Accumulator ─────────────────────────────────
      if (bet.bet_type === 'Accumulator' && bet.notes) {
        try {
          const legs = JSON.parse(bet.notes)
          if (!Array.isArray(legs)) { skipped++; continue }

          // Fetch results for all legs in parallel
          const resultMap = new Map<string, MatchResult>()
          await Promise.all(
            legs.map(async (leg: any) => {
              if (leg.fixture_id) {
                const r = await fetchMatchResult(leg.fixture_id)
                if (r) resultMap.set(leg.match_name, r)
              }
            })
          )

          const accaResult = checkAccaLegs(legs, resultMap)
          if (accaResult === 'pending') { skipped++; continue }

          const stakeNum = Number(bet.stake)
          const oddsNum = Number(bet.odds)
          const profitLoss = accaResult === 'win' ? (oddsNum - 1) * stakeNum
            : accaResult === 'loss' ? -stakeNum : 0

          await supabaseAdmin.from('bet_slips').update({
            result: accaResult, profit_loss: profitLoss,
          }).eq('id', bet.id)

          if (accaResult === 'win') wins++
          else if (accaResult === 'loss') losses++
          else voided++
          checked++
        } catch { skipped++ }
        continue
      }

      // ── Single bet ───────────────────────────────────
      if (!bet.fixture_id) { skipped++; continue }

      const matchResult = await fetchMatchResult(bet.fixture_id)
      if (!matchResult) { skipped++; continue }

      const result = determineResult(
        bet.bet_type || '',
        bet.selection || '',
        bet.match_name || '',
        matchResult.homeScore,
        matchResult.awayScore
      )

      const stakeNum = Number(bet.stake)
      const oddsNum = Number(bet.odds)
      const profitLoss = result === 'win' ? (oddsNum - 1) * stakeNum
        : result === 'loss' ? -stakeNum : 0

      await supabaseAdmin.from('bet_slips').update({
        result,
        profit_loss: profitLoss,
        notes: bet.notes ? bet.notes : `${matchResult.homeScore}-${matchResult.awayScore}`,
      }).eq('id', bet.id)

      if (result === 'win') wins++
      else if (result === 'loss') losses++
      else voided++
      checked++
    }

    return NextResponse.json({
      message: `Checked ${checked} bets`,
      checked, wins, losses, voided, skipped,
    })
  } catch (err: any) {
    console.error('check-bet-slips error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
