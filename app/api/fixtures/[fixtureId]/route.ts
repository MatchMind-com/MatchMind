import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getSofaScoreLineupsForMatch,
  getSofaScoreLiveStats,
  type SofaScoreStats,
} from '@/lib/sofascore'

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

async function apiFetch(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.response || null
  } catch { return null }
}

function getCurrentSeason(): number {
  const now = new Date()
  return now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

export async function GET(
  req: NextRequest,
  { params }: { params: { fixtureId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fixtureId = params.fixtureId
  const season = getCurrentSeason()

  // Fetch fixture details first to get team IDs
  const fixtureData = await apiFetch(`/fixtures?id=${fixtureId}`)
  if (!fixtureData || fixtureData.length === 0) {
    return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
  }

  const fixture = fixtureData[0]
  const homeTeamId = fixture.teams?.home?.id
  const awayTeamId = fixture.teams?.away?.id
  const leagueId = fixture.league?.id

  // Fetch all detail data in parallel
  const [injuries, h2h, homeForm, awayForm, homeSquad, awaySquad, predictions, matchStats, homeSeasonStats, awaySeasonStats, lineupsRaw, eventsRaw] = await Promise.all([
    apiFetch(`/injuries?fixture=${fixtureId}`),
    apiFetch(`/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=5`),
    apiFetch(`/fixtures?team=${homeTeamId}&league=${leagueId}&season=${season}&last=5&status=FT`),
    apiFetch(`/fixtures?team=${awayTeamId}&league=${leagueId}&season=${season}&last=5&status=FT`),
    apiFetch(`/players/squads?team=${homeTeamId}`),
    apiFetch(`/players/squads?team=${awayTeamId}`),
    apiFetch(`/predictions?fixture=${fixtureId}`),
    apiFetch(`/fixtures/statistics?fixture=${fixtureId}`),
    apiFetch(`/teams/statistics?league=${leagueId}&season=${season}&team=${homeTeamId}`),
    apiFetch(`/teams/statistics?league=${leagueId}&season=${season}&team=${awayTeamId}`),
    apiFetch(`/fixtures/lineups?fixture=${fixtureId}`),
    apiFetch(`/fixtures/events?fixture=${fixtureId}`),
  ])

  // Process lineups — split per team, normalise grid → coords for layout
  function processLineup(raw: any) {
    if (!raw) return null
    return {
      team_id: raw.team?.id ?? null,
      team_name: raw.team?.name ?? null,
      team_logo: raw.team?.logo ?? null,
      formation: raw.formation ?? null,
      coach: raw.coach?.name ?? null,
      starting_xi: (raw.startXI ?? []).map((p: any) => ({
        id: p.player?.id,
        name: p.player?.name,
        number: p.player?.number,
        pos: p.player?.pos,
        grid: p.player?.grid ?? null, // "row:col" e.g. "2:3"
      })),
      substitutes: (raw.substitutes ?? []).map((p: any) => ({
        id: p.player?.id,
        name: p.player?.name,
        number: p.player?.number,
        pos: p.player?.pos,
      })),
    }
  }
  let homeLineup = Array.isArray(lineupsRaw)
    ? processLineup(lineupsRaw.find((l: any) => l?.team?.id === homeTeamId) ?? lineupsRaw[0])
    : null
  let awayLineup = Array.isArray(lineupsRaw)
    ? processLineup(lineupsRaw.find((l: any) => l?.team?.id === awayTeamId) ?? lineupsRaw[1])
    : null

  // SofaScore lineup fallback — API-Football's lineup coverage is patchy
  // for lower-tier leagues (Saudi Pro, J1, MLS, Liga MX, etc.). If we're
  // missing a lineup AND the match is close to kickoff or already live,
  // try SofaScore which covers ~all leagues.
  const fxStatusForLineup = fixture.fixture?.status?.short
  const isLiveOrKickingOff = fxStatusForLineup &&
    !['NS', 'TBD', 'PST', 'CANC', 'ABD'].includes(fxStatusForLineup)
  // For NS, only attempt if kickoff is within ~2 hours (lineups land ~1h before).
  const kickoffMs = fixture.fixture?.date ? new Date(fixture.fixture.date).getTime() : null
  const minsToKickoff = kickoffMs ? Math.round((kickoffMs - Date.now()) / 60_000) : null
  const lineupsExpected =
    isLiveOrKickingOff || (minsToKickoff != null && minsToKickoff < 120 && minsToKickoff > -240)
  const homeName = fixture.teams?.home?.name
  const awayName = fixture.teams?.away?.name
  if ((!homeLineup || !awayLineup) && lineupsExpected && homeName && awayName) {
    try {
      const sofa = await getSofaScoreLineupsForMatch(homeName, awayName)
      const toCommonShape = (l: any, teamId: number | null, teamName: string | null) => l ? ({
        team_id: teamId,
        team_name: teamName,
        team_logo: null,
        formation: l.formation,
        coach: l.coach,
        starting_xi: l.starting_xi.map((p: any) => ({
          id: p.id, name: p.name, number: p.number, pos: p.pos, grid: null,
        })),
        substitutes: l.substitutes.map((p: any) => ({
          id: p.id, name: p.name, number: p.number, pos: p.pos,
        })),
      }) : null
      if (!homeLineup && sofa.home) homeLineup = toCommonShape(sofa.home, homeTeamId, homeName)
      if (!awayLineup && sofa.away) awayLineup = toCommonShape(sofa.away, awayTeamId, awayName)
    } catch (e) {
      // Best-effort — don't fail the route if SofaScore is down.
      console.warn('[fixture-detail] SofaScore lineup fallback failed:', e)
    }
  }

  // Process events — goals, cards, subs, VAR
  const events = Array.isArray(eventsRaw)
    ? eventsRaw.map((e: any) => ({
        minute: e.time?.elapsed,
        extra: e.time?.extra,
        team_id: e.team?.id,
        team_name: e.team?.name,
        player: e.player?.name,
        assist: e.assist?.name,
        type: e.type, // Goal, Card, subst, Var
        detail: e.detail, // Normal Goal, Yellow Card, etc
        comments: e.comments,
      }))
    : []

  // Process injuries by team
  const homeInjuries: any[] = []
  const awayInjuries: any[] = []
  injuries?.forEach((inj: any) => {
    const entry = {
      player: inj.player?.name,
      photo: inj.player?.photo,
      reason: inj.player?.reason,
      type: inj.player?.type, // 'Missing Fixture' | 'Questionable'
    }
    if (inj.team?.id === homeTeamId) homeInjuries.push(entry)
    else awayInjuries.push(entry)
  })

  // Process H2H
  const h2hMatches = h2h?.slice(0, 5).map((m: any) => ({
    date: m.fixture?.date,
    homeTeam: m.teams?.home?.name,
    awayTeam: m.teams?.away?.name,
    homeGoals: m.goals?.home,
    awayGoals: m.goals?.away,
    winner: m.teams?.home?.winner ? m.teams?.home?.name : m.teams?.away?.winner ? m.teams?.away?.name : 'Draw',
  })) || []

  // Process recent form
  function processForm(matches: any[], teamId: number) {
    return matches?.slice(0, 5).map((m: any) => {
      const isHome = m.teams?.home?.id === teamId
      const teamGoals = isHome ? m.goals?.home : m.goals?.away
      const oppGoals = isHome ? m.goals?.away : m.goals?.home
      const opponent = isHome ? m.teams?.away?.name : m.teams?.home?.name
      const result = teamGoals > oppGoals ? 'W' : teamGoals < oppGoals ? 'L' : 'D'
      return {
        date: m.fixture?.date,
        opponent,
        score: `${teamGoals}-${oppGoals}`,
        result,
        isHome,
      }
    }) || []
  }

  const homeFormProcessed = processForm(homeForm || [], homeTeamId)
  const awayFormProcessed = processForm(awayForm || [], awayTeamId)

  // Process match statistics (live/finished games)
  function extractStat(teamStats: any[], statType: string) {
    const entry = teamStats?.find((s: any) => s.type === statType)
    const val = entry?.value
    if (val === null || val === undefined) return null
    // Some values come as "45%" strings
    if (typeof val === 'string' && val.endsWith('%')) return parseFloat(val)
    return typeof val === 'number' ? val : parseFloat(val) || null
  }

  let statistics: any = null
  if (matchStats && matchStats.length >= 2) {
    const homeTeamStats = matchStats.find((s: any) => s.team?.id === homeTeamId)?.statistics || []
    const awayTeamStats = matchStats.find((s: any) => s.team?.id === awayTeamId)?.statistics || []
    statistics = {
      home: {
        possession: extractStat(homeTeamStats, 'Ball Possession'),
        shots_total: extractStat(homeTeamStats, 'Total Shots'),
        shots_on_goal: extractStat(homeTeamStats, 'Shots on Goal'),
        xg: extractStat(homeTeamStats, 'expected_goals'),
        corners: extractStat(homeTeamStats, 'Corner Kicks'),
        fouls: extractStat(homeTeamStats, 'Fouls'),
        yellow_cards: extractStat(homeTeamStats, 'Yellow Cards'),
        red_cards: extractStat(homeTeamStats, 'Red Cards'),
        saves: extractStat(homeTeamStats, 'Goalkeeper Saves'),
        passes_total: extractStat(homeTeamStats, 'Total passes'),
        passes_accurate: extractStat(homeTeamStats, 'Passes accurate'),
        pass_accuracy: extractStat(homeTeamStats, 'Passes %'),
        offsides: extractStat(homeTeamStats, 'Offsides'),
      },
      away: {
        possession: extractStat(awayTeamStats, 'Ball Possession'),
        shots_total: extractStat(awayTeamStats, 'Total Shots'),
        shots_on_goal: extractStat(awayTeamStats, 'Shots on Goal'),
        xg: extractStat(awayTeamStats, 'expected_goals'),
        corners: extractStat(awayTeamStats, 'Corner Kicks'),
        fouls: extractStat(awayTeamStats, 'Fouls'),
        yellow_cards: extractStat(awayTeamStats, 'Yellow Cards'),
        red_cards: extractStat(awayTeamStats, 'Red Cards'),
        saves: extractStat(awayTeamStats, 'Goalkeeper Saves'),
        passes_total: extractStat(awayTeamStats, 'Total passes'),
        passes_accurate: extractStat(awayTeamStats, 'Passes accurate'),
        pass_accuracy: extractStat(awayTeamStats, 'Passes %'),
        offsides: extractStat(awayTeamStats, 'Offsides'),
      },
    }
  }

  // SofaScore fallback — for live/finished matches in lower-tier leagues
  // API-Football frequently returns null xG/shots/possession/corners. SofaScore
  // covers nearly every league. Only fetch when there's something missing AND
  // the match is in a state where stats should exist (live or finished).
  const fxStatus = fixture.fixture?.status?.short
  const isPlayedOrLive = fxStatus && !['NS', 'TBD', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(fxStatus)
  // homeName / awayName already declared above for the lineup fallback
  const needsFallback =
    isPlayedOrLive &&
    homeName &&
    awayName &&
    (!statistics ||
      statistics.home.shots_total === null ||
      statistics.home.xg === null ||
      statistics.home.possession === null ||
      statistics.home.corners === null)
  if (needsFallback) {
    try {
      const sofa: SofaScoreStats = await getSofaScoreLiveStats(homeName, awayName)
      if (sofa.matchId !== null) {
        if (!statistics) {
          statistics = {
            home: {
              possession: null, shots_total: null, shots_on_goal: null, xg: null,
              corners: null, fouls: null, yellow_cards: null, red_cards: null,
              saves: null, passes_total: null, passes_accurate: null, pass_accuracy: null, offsides: null,
            },
            away: {
              possession: null, shots_total: null, shots_on_goal: null, xg: null,
              corners: null, fouls: null, yellow_cards: null, red_cards: null,
              saves: null, passes_total: null, passes_accurate: null, pass_accuracy: null, offsides: null,
            },
          }
        }
        const fill = (side: 'home' | 'away') => {
          const dst = statistics[side]
          dst.possession = dst.possession ?? sofa.possession[side]
          dst.shots_total = dst.shots_total ?? sofa.shots[side]
          dst.shots_on_goal = dst.shots_on_goal ?? sofa.shotsOnTarget[side]
          dst.xg = dst.xg ?? sofa.xg[side]
          dst.corners = dst.corners ?? sofa.corners[side]
          dst.fouls = dst.fouls ?? sofa.fouls[side]
          dst.saves = dst.saves ?? sofa.saves[side]
          dst.pass_accuracy = dst.pass_accuracy ?? sofa.passAccuracy[side]
          dst.offsides = dst.offsides ?? sofa.offsides[side]
          if (!dst.yellow_cards) dst.yellow_cards = sofa.yellowCards[side]
          if (!dst.red_cards) dst.red_cards = sofa.redCards[side]
        }
        fill('home')
        fill('away')
      }
    } catch (e) {
      console.warn('[fixtures/[fixtureId]] SofaScore fallback failed:', e)
    }
  }

  // Process season team statistics for pre-match Stats tab
  function extractTeamSeasonStats(raw: any) {
    if (!raw) return null
    const fx = raw.fixtures || {}
    const goals = raw.goals || {}
    const played = fx.played?.total || 0
    const wins = fx.wins?.total || 0
    const draws = fx.draws?.total || 0
    const losses = fx.loses?.total || 0

    // Goals
    const goalsFor = goals.for?.total?.total || 0
    const goalsAgainst = goals.against?.total?.total || 0
    const goalsForAvg = parseFloat(goals.for?.average?.total || '0')
    const goalsAgainstAvg = parseFloat(goals.against?.average?.total || '0')

    // Home vs Away
    const homeGoalsFor = goals.for?.total?.home || 0
    const homeGoalsAgainst = goals.against?.total?.home || 0
    const awayGoalsFor = goals.for?.total?.away || 0
    const awayGoalsAgainst = goals.against?.total?.away || 0

    // Cards
    const cards = raw.cards || {}
    const totalYellow = Object.values(cards.yellow || {}).reduce((sum: number, v: any) => sum + (v?.total || 0), 0) as number
    const totalRed = Object.values(cards.red || {}).reduce((sum: number, v: any) => sum + (v?.total || 0), 0) as number

    // Clean sheets & failed to score
    const cleanSheets = raw.clean_sheet?.total || 0
    const failedToScore = raw.failed_to_score?.total || 0

    // Biggest values
    const biggestWin = raw.biggest?.wins?.home || raw.biggest?.wins?.away || null
    const biggestLoss = raw.biggest?.loses?.home || raw.biggest?.loses?.away || null

    // Penalties
    const penScored = raw.penalty?.scored?.total || 0
    const penMissed = raw.penalty?.missed?.total || 0

    // Lineups (most common formation)
    const topFormation = raw.lineups?.sort((a: any, b: any) => b.played - a.played)?.[0]?.formation || null

    return {
      played, wins, draws, losses,
      win_rate: played > 0 ? Math.round((wins / played) * 100) : 0,
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      goals_for_avg: goalsForAvg,
      goals_against_avg: goalsAgainstAvg,
      home: { goals_for: homeGoalsFor, goals_against: homeGoalsAgainst, wins: fx.wins?.home || 0, draws: fx.draws?.home || 0, losses: fx.loses?.home || 0 },
      away: { goals_for: awayGoalsFor, goals_against: awayGoalsAgainst, wins: fx.wins?.away || 0, draws: fx.draws?.away || 0, losses: fx.loses?.away || 0 },
      clean_sheets: cleanSheets,
      clean_sheet_pct: played > 0 ? Math.round((cleanSheets / played) * 100) : 0,
      failed_to_score: failedToScore,
      failed_to_score_pct: played > 0 ? Math.round((failedToScore / played) * 100) : 0,
      yellow_cards_total: totalYellow,
      yellow_cards_avg: played > 0 ? Math.round((totalYellow / played) * 10) / 10 : 0,
      red_cards_total: totalRed,
      biggest_win: biggestWin,
      biggest_loss: biggestLoss,
      penalties_scored: penScored,
      penalties_missed: penMissed,
      top_formation: topFormation,
      form: raw.form || null,
    }
  }

  const homeStats = extractTeamSeasonStats(homeSeasonStats)
  const awayStats = extractTeamSeasonStats(awaySeasonStats)

  // Get prediction data
  const pred = predictions?.[0]
  const aiPrediction = pred ? {
    winner: pred.predictions?.winner?.name,
    advice: pred.predictions?.advice,
    homeWinPercent: pred.predictions?.percent?.home,
    drawPercent: pred.predictions?.percent?.draw,
    awayWinPercent: pred.predictions?.percent?.away,
    goals: pred.predictions?.goals,
    underOver: pred.predictions?.under_over,
  } : null

  return NextResponse.json({
    fixture: {
      id: fixture.fixture?.id,
      date: fixture.fixture?.date,
      status: fixture.fixture?.status?.short,
      elapsed: fixture.fixture?.status?.elapsed,
      venue: fixture.fixture?.venue?.name,
      city: fixture.fixture?.venue?.city,
      referee: fixture.fixture?.referee,
    },
    league: {
      id: fixture.league?.id,
      name: fixture.league?.name,
      logo: fixture.league?.logo,
      round: fixture.league?.round,
    },
    home: {
      id: homeTeamId,
      name: fixture.teams?.home?.name,
      logo: fixture.teams?.home?.logo,
      goals: fixture.goals?.home,
      injuries: homeInjuries,
      form: homeFormProcessed,
    },
    away: {
      id: awayTeamId,
      name: fixture.teams?.away?.name,
      logo: fixture.teams?.away?.logo,
      goals: fixture.goals?.away,
      injuries: awayInjuries,
      form: awayFormProcessed,
    },
    h2h: h2hMatches,
    prediction: aiPrediction,
    statistics,
    home_stats: homeStats,
    away_stats: awayStats,
    home_lineup: homeLineup,
    away_lineup: awayLineup,
    events,
  })
}
