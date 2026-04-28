// Server-side helper to build the canonical "Daily Social ACCA" — the single
// 3-leg accumulator that gets persisted to `daily_accas`, tweeted to
// @Match_Mind_AI, and shown on the public site / track record.
//
// Replicates the dashboard's "Balanced" tier ACCA logic but server-side so
// the cron + grading pipeline have a deterministic source of truth.
// See app/dashboard/predictions/page.tsx → buildTierAcca() for the original
// client-side version. This must stay in sync market-for-market.

export interface DailyAccaLeg {
  fixture_id: number
  home_team: string
  away_team: string
  league: string
  league_flag: string
  market: 'Home Win' | 'Away Win' | 'Over 2.5 Goals' | 'Both Teams to Score'
  prediction: 'home_win' | 'away_win' | 'over_2_5' | 'btts'
  odds: number
  ev_percent: number
  kick_off: string
}

export interface DailyAccaPayload {
  tier: 'safe' | 'balanced' | 'big_win'
  legs: DailyAccaLeg[]
  combined_odds: number
  combined_implied_prob: number
}

// Same structure as in /api/predictions response (we receive these from
// `getTodaysPredictions()` in cron/social-post)
interface InboundPrediction {
  id?: number                       // fixture id (some old shapes use this)
  fixture_id?: number
  home_team: string
  away_team: string
  league: string
  leagueFlag?: string
  date: string                      // kick_off
  bookmaker?: {
    home: number | null
    away: number | null
    draw: number | null
    over25: number | null
    btts: number | null
  } | null
  ev?: {
    home: number | null
    away: number | null
    over25: number | null
    btts: number | null
    draw?: number | null
  }
}

interface CandidateLeg extends DailyAccaLeg {}

// Lift every +EV market off every prediction. Mirrors collectAllBets() in
// app/dashboard/predictions/page.tsx — keep in sync.
function collectCandidateLegs(predictions: InboundPrediction[]): CandidateLeg[] {
  const out: CandidateLeg[] = []
  const MARKETS: {
    market: CandidateLeg['market']
    prediction: CandidateLeg['prediction']
    evKey: 'home' | 'away' | 'over25' | 'btts'
    oddsKey: 'home' | 'away' | 'over25' | 'btts'
  }[] = [
    { market: 'Home Win',            prediction: 'home_win', evKey: 'home',   oddsKey: 'home' },
    { market: 'Away Win',            prediction: 'away_win', evKey: 'away',   oddsKey: 'away' },
    { market: 'Over 2.5 Goals',      prediction: 'over_2_5', evKey: 'over25', oddsKey: 'over25' },
    { market: 'Both Teams to Score', prediction: 'btts',     evKey: 'btts',   oddsKey: 'btts' },
  ]

  for (const p of predictions) {
    if (!p.bookmaker || !p.ev) continue
    const fid = p.fixture_id ?? p.id
    if (!fid) continue
    for (const m of MARKETS) {
      const ev = p.ev[m.evKey]
      const odds = p.bookmaker[m.oddsKey]
      // Same filter as dashboard: positive EV, not silly-high (likely calibration error),
      // odds capped at 4.0 to keep individual legs realistic
      if (ev != null && ev > 0 && ev <= 25 && odds != null && odds <= 4.0 && odds > 1.0) {
        out.push({
          fixture_id: fid,
          home_team: p.home_team,
          away_team: p.away_team,
          league: p.league,
          league_flag: p.leagueFlag || '⚽',
          market: m.market,
          prediction: m.prediction,
          odds,
          ev_percent: ev,
          kick_off: p.date,
        })
      }
    }
  }
  return out
}

// Pick 3 legs prioritising league diversity. Mirrors buildTierAcca() but
// server-side. Tier filter chooses the odds band.
function pickThreeLegs(candidates: CandidateLeg[], tierFilter: (odds: number) => boolean): CandidateLeg[] {
  const tierBets = candidates.filter(b => tierFilter(b.odds)).sort((a, b) => b.ev_percent - a.ev_percent)
  const picked: CandidateLeg[] = []
  const usedLeagues = new Set<string>()
  const usedFixtures = new Set<number>()

  // Pass 1: prefer one fixture per league
  for (const b of tierBets) {
    if (picked.length >= 3) break
    if (usedLeagues.has(b.league) || usedFixtures.has(b.fixture_id)) continue
    picked.push(b)
    usedLeagues.add(b.league)
    usedFixtures.add(b.fixture_id)
  }
  // Pass 2: fill from best-EV remaining (relax league constraint, no duplicate fixtures)
  for (const b of tierBets) {
    if (picked.length >= 3) break
    if (usedFixtures.has(b.fixture_id)) continue
    picked.push(b)
    usedFixtures.add(b.fixture_id)
  }
  return picked
}

// Builds the canonical Daily Social ACCA — Balanced tier (mid-odds 3.0–8.0 combined).
// Returns null if there aren't enough +EV legs to make a 3-leg ACCA.
export function buildDailyAcca(predictions: InboundPrediction[]): DailyAccaPayload | null {
  const candidates = collectCandidateLegs(predictions)
  // Balanced tier per buildTierAcca call site: individual leg odds 1.45–2.20
  // Combined target: ~3.0–8.0
  const balancedFilter = (odds: number) => odds >= 1.45 && odds <= 2.20
  let legs = pickThreeLegs(candidates, balancedFilter)

  // Fallbacks if Balanced tier doesn't produce 3 legs (rare quiet days)
  if (legs.length < 3) {
    legs = pickThreeLegs(candidates, (o) => o >= 1.30 && o <= 2.80) // wider net
  }
  if (legs.length < 3) return null

  const combined_odds = +legs.reduce((acc, l) => acc * l.odds, 1).toFixed(2)
  const combined_implied_prob = +(100 / combined_odds).toFixed(2)

  return {
    tier: 'balanced',
    legs,
    combined_odds,
    combined_implied_prob,
  }
}

// Format an ACCA as a single tweet (within Twitter's 280 char limit).
// Deliberately concise — the brand's other daily tweets carry full match analysis.
export function formatAccaTweet(acca: DailyAccaPayload): string {
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const legs = acca.legs.map(l =>
    `${l.league_flag} ${l.home_team} vs ${l.away_team} → ${l.market} @ ${l.odds.toFixed(2)}`
  ).join('\n')
  return (
    `🎯 MatchMind Daily ACCA — ${date}\n\n` +
    `${legs}\n\n` +
    `Combined @ ${acca.combined_odds.toFixed(2)} (${acca.combined_implied_prob}% implied)\n\n` +
    `Bet responsibly 🙏 | matchmindcom.com`
  )
}
