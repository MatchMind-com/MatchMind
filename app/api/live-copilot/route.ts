/**
 * /api/live-copilot — Live Match Co-Pilot
 *
 * GET ?fixtureId=123
 *  - Pulls live fixture data from API-Football
 *  - Compares against the in-memory snapshot of the last call
 *  - If something materially changed (goal, red card, big xG shift, odds movement),
 *    asks GPT-4o for a short, punchy commentary line
 *  - Otherwise returns 'silent'
 *
 * In-memory cache is fine for MVP — the panel polls a single fixtureId at a time
 * and stale state just means the AI may speak once after a serverless cold start.
 */
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

type Snapshot = {
  minute: number | null
  status: string | null
  homeGoals: number | null
  awayGoals: number | null
  homeRed: number
  awayRed: number
  homeYellow: number
  awayYellow: number
  homeXg: number | null
  awayXg: number | null
  homeShots: number | null
  awayShots: number | null
  homeCorners: number | null
  awayCorners: number | null
  homeOdds: number | null
  drawOdds: number | null
  awayOdds: number | null
  lastCommentary: string | null
  lastSpokeAt: number
}

// Module-level Map persists across requests in the same Lambda instance.
const snapshots = new Map<string, Snapshot>()

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

async function apiFetch(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      // Live data — never cache.
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.response || null
  } catch {
    return null
  }
}

function extractStat(teamStats: any[], statType: string): number | null {
  const entry = teamStats?.find((s: any) => s.type === statType)
  const val = entry?.value
  if (val === null || val === undefined) return null
  if (typeof val === 'string' && val.endsWith('%')) return parseFloat(val)
  return typeof val === 'number' ? val : parseFloat(val) || null
}

function pickBookmakerOdds(oddsResp: any): { home: number | null; draw: number | null; away: number | null } {
  if (!oddsResp || oddsResp.length === 0) return { home: null, draw: null, away: null }
  const bookmakers = oddsResp[0]?.bookmakers || []
  // Prefer Bet365 (id 8), else first available
  const bm = bookmakers.find((b: any) => b.id === 8) || bookmakers[0]
  if (!bm) return { home: null, draw: null, away: null }
  const matchWinner = bm.bets?.find((b: any) => b.name === 'Match Winner')
  if (!matchWinner) return { home: null, draw: null, away: null }
  const home = parseFloat(matchWinner.values?.find((v: any) => v.value === 'Home')?.odd) || null
  const draw = parseFloat(matchWinner.values?.find((v: any) => v.value === 'Draw')?.odd) || null
  const away = parseFloat(matchWinner.values?.find((v: any) => v.value === 'Away')?.odd) || null
  return { home, draw, away }
}

function hasAnyData(s: Snapshot): boolean {
  // True if there's enough live signal to actually say something useful.
  return (
    (s.homeGoals ?? 0) > 0 ||
    (s.awayGoals ?? 0) > 0 ||
    (s.homeShots ?? 0) > 0 ||
    (s.awayShots ?? 0) > 0 ||
    (s.homeCorners ?? 0) > 0 ||
    (s.awayCorners ?? 0) > 0 ||
    s.homeRed > 0 ||
    s.awayRed > 0 ||
    (s.homeXg !== null && s.homeXg > 0) ||
    (s.awayXg !== null && s.awayXg > 0)
  )
}

function diffIsMaterial(prev: Snapshot | undefined, curr: Snapshot): { material: boolean; reason: string } {
  // FIRST OBSERVATION — always speak. The user just opened the panel and
  // needs context immediately. Set the scene.
  if (!prev) {
    return { material: true, reason: 'opening — setting the scene' }
  }

  // Goals — always material
  if (curr.homeGoals !== null && curr.awayGoals !== null && prev.homeGoals !== null && prev.awayGoals !== null) {
    if (curr.homeGoals !== prev.homeGoals || curr.awayGoals !== prev.awayGoals) {
      return { material: true, reason: 'goal scored' }
    }
  }
  // Red cards
  if (curr.homeRed > prev.homeRed || curr.awayRed > prev.awayRed) {
    return { material: true, reason: 'red card' }
  }
  // xG shift — lowered threshold from 0.4 to 0.25
  const xgShift = (a: number | null, b: number | null) =>
    a !== null && b !== null && Math.abs(a - b) >= 0.25
  if (xgShift(curr.homeXg, prev.homeXg) || xgShift(curr.awayXg, prev.awayXg)) {
    return { material: true, reason: 'xG swing' }
  }
  // Odds shift — lowered threshold from 15% to 10%
  const oddsShift = (a: number | null, b: number | null) =>
    a !== null && b !== null && b > 0 && Math.abs((a - b) / b) >= 0.10
  if (
    oddsShift(curr.homeOdds, prev.homeOdds) ||
    oddsShift(curr.awayOdds, prev.awayOdds) ||
    oddsShift(curr.drawOdds, prev.drawOdds)
  ) {
    return { material: true, reason: 'odds moved' }
  }

  // KEY MATCH MOMENTS — speak when crossing important minute thresholds.
  // Triggers once per threshold via the prev.minute comparison.
  const milestones = [
    { mark: 30, label: '30-minute mark' },
    { mark: 45, label: 'half-time approaching' },
    { mark: 60, label: 'hour mark — final third of regulation' },
    { mark: 75, label: 'final 15 — game opening up' },
    { mark: 85, label: 'closing minutes' },
    { mark: 90, label: 'full-time approaching' },
    { mark: 105, label: 'extra-time half-way' },
    { mark: 115, label: 'final minutes of extra time' },
  ]
  if (curr.minute !== null && prev.minute !== null) {
    for (const m of milestones) {
      if (prev.minute < m.mark && curr.minute >= m.mark) {
        return { material: true, reason: m.label }
      }
    }
  }

  // PERIODIC CHECK-IN — every 4 minutes (was 8). Always speak, even if quiet,
  // so the panel feels alive. The system prompt tells it what to say in quiet matches.
  const minutesSinceSpoke = (Date.now() - prev.lastSpokeAt) / 60000
  if (minutesSinceSpoke >= 4 && curr.minute !== null && curr.minute > 0) {
    return { material: true, reason: 'periodic update' }
  }

  return { material: false, reason: 'no material change yet' }
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fixtureId = req.nextUrl.searchParams.get('fixtureId')
  if (!fixtureId) {
    return NextResponse.json({ error: 'fixtureId required' }, { status: 400 })
  }

  // Pull live fixture, statistics, odds in parallel
  const [fixtureResp, statsResp, oddsResp] = await Promise.all([
    apiFetch(`/fixtures?id=${fixtureId}`),
    apiFetch(`/fixtures/statistics?fixture=${fixtureId}`),
    apiFetch(`/odds?fixture=${fixtureId}`),
  ])

  if (!fixtureResp || fixtureResp.length === 0) {
    return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
  }

  const fx = fixtureResp[0]
  const homeId = fx.teams?.home?.id
  const awayId = fx.teams?.away?.id
  const homeName = fx.teams?.home?.name
  const awayName = fx.teams?.away?.name
  const homeLogo = fx.teams?.home?.logo
  const awayLogo = fx.teams?.away?.logo
  const status = fx.fixture?.status?.short
  const minute = fx.fixture?.status?.elapsed ?? null
  const homeGoals = fx.goals?.home ?? null
  const awayGoals = fx.goals?.away ?? null
  const league = fx.league?.name

  // Stats
  const homeTeamStats = statsResp?.find((s: any) => s.team?.id === homeId)?.statistics || []
  const awayTeamStats = statsResp?.find((s: any) => s.team?.id === awayId)?.statistics || []
  const homeXg = extractStat(homeTeamStats, 'expected_goals')
  const awayXg = extractStat(awayTeamStats, 'expected_goals')
  const homeShots = extractStat(homeTeamStats, 'Total Shots')
  const awayShots = extractStat(awayTeamStats, 'Total Shots')
  const homeCorners = extractStat(homeTeamStats, 'Corner Kicks')
  const awayCorners = extractStat(awayTeamStats, 'Corner Kicks')
  const homeRed = extractStat(homeTeamStats, 'Red Cards') || 0
  const awayRed = extractStat(awayTeamStats, 'Red Cards') || 0
  const homeYellow = extractStat(homeTeamStats, 'Yellow Cards') || 0
  const awayYellow = extractStat(awayTeamStats, 'Yellow Cards') || 0
  const homePossession = extractStat(homeTeamStats, 'Ball Possession')
  const awayPossession = extractStat(awayTeamStats, 'Ball Possession')

  // Odds
  const odds = pickBookmakerOdds(oddsResp)

  const prev = snapshots.get(fixtureId)
  const curr: Snapshot = {
    minute,
    status,
    homeGoals,
    awayGoals,
    homeRed,
    awayRed,
    homeYellow,
    awayYellow,
    homeXg,
    awayXg,
    homeShots,
    awayShots,
    homeCorners,
    awayCorners,
    homeOdds: odds.home,
    drawOdds: odds.draw,
    awayOdds: odds.away,
    lastCommentary: prev?.lastCommentary ?? null,
    lastSpokeAt: prev?.lastSpokeAt ?? 0,
  }

  const currentState = {
    minute,
    status,
    score: { home: homeGoals, away: awayGoals },
    teams: { home: homeName, away: awayName, homeLogo, awayLogo },
    league,
    xg: { home: homeXg, away: awayXg },
    shots: { home: homeShots, away: awayShots },
    corners: { home: homeCorners, away: awayCorners },
    cards: { homeRed, awayRed, homeYellow, awayYellow },
    possession: { home: homePossession, away: awayPossession },
    odds,
  }

  const { material, reason } = diffIsMaterial(prev, curr)
  if (!material) {
    snapshots.set(fixtureId, curr)
    return NextResponse.json({ status: 'silent', currentState })
  }

  // Speak — call GPT-4o
  const isOpening = !prev

  // Only include stat lines when the API actually returned values.
  // For lower-tier leagues, shots/xG/corners/possession are usually null —
  // showing them as "0" misleads the AI into saying "no shots taken".
  const statLines: string[] = []
  if (homeXg !== null || awayXg !== null) statLines.push(`xG: ${homeName} ${homeXg ?? '?'} | ${awayName} ${awayXg ?? '?'}`)
  if (homeShots !== null || awayShots !== null) statLines.push(`Shots: ${homeShots ?? '?'} - ${awayShots ?? '?'}`)
  if (homeCorners !== null || awayCorners !== null) statLines.push(`Corners: ${homeCorners ?? '?'} - ${awayCorners ?? '?'}`)
  if ((homeYellow + homeRed + awayYellow + awayRed) > 0) statLines.push(`Cards: ${homeName} ${homeYellow}Y/${homeRed}R | ${awayName} ${awayYellow}Y/${awayRed}R`)
  if (homePossession !== null || awayPossession !== null) statLines.push(`Possession: ${homePossession ?? '?'}% - ${awayPossession ?? '?'}%`)
  const statsBlock = statLines.length > 0
    ? statLines.join('\n')
    : '(Detailed live stats not available for this league — only score, minute and odds are reliable.)'

  const userPrompt = `Live match: ${homeName} ${homeGoals ?? 0} - ${awayGoals ?? 0} ${awayName} (${minute ?? '?'}' ${status})
League: ${league}

${statsBlock}

Odds (Match Winner): Home ${odds.home ?? 'n/a'} / Draw ${odds.draw ?? 'n/a'} / Away ${odds.away ?? 'n/a'}

Trigger: ${reason}.
Last thing you said: ${prev?.lastCommentary ?? '(nothing yet)'}.

${isOpening
  ? 'This is the user OPENING the panel. Set the scene in 2 sentences — the score, the minute, what stands out, what to watch for. Be the friend on the couch giving them the lay of the land.'
  : "Speak in 1–2 sentences as an analytical co-pilot watching with the user. Reference what actually changed, the tactical situation, or what's worth watching next. Tie to odds only when there's a real value or risk angle."}

CRITICAL: Only reference stats that appear above. If shots/corners/xG/possession are NOT listed, do NOT mention them and do NOT say "no shots" or "no corners" — those stats simply aren't tracked for this league. Focus on what you DO know: score, minute, momentum, odds, who's leading, late-game pressure, etc. Never invent stats. Keep it conversational, never dismissive.`

  let commentary: string | null = null
  try {
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 200,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content:
            "You are MatchMind's Live Co-Pilot — a sharp, friendly football analyst watching a live match with the user. Speak naturally, like a friend on the couch with deep tactical knowledge. Reference the score, minute, and ANY stats that are explicitly given to you. ABSOLUTE RULE: never claim 'no shots', 'no corners', 'quiet game', 'snoozefest' or anything similar based on missing data — many lower-tier leagues simply don't have detailed stats from our provider. If stats aren't given, talk about what you DO know: score, minute, late-game pressure, who's leading, the implied odds, what to watch for tactically. Never invent stats. Never be dismissive.",
        },
        { role: 'user', content: userPrompt },
      ],
    })
    commentary = completion.choices[0]?.message?.content?.trim() || null
  } catch (err) {
    console.error('[live-copilot] OpenAI error:', err)
  }

  if (commentary) {
    curr.lastCommentary = commentary
    curr.lastSpokeAt = Date.now()
  }
  snapshots.set(fixtureId, curr)

  return NextResponse.json({
    status: commentary ? 'speaking' : 'silent',
    commentary: commentary || undefined,
    reason,
    currentState,
  })
}
