/**
 * /api/live-copilot/chat — interactive chat with the Live Co-Pilot
 *
 * POST { fixtureId, message, conversation: [{role, content}] }
 *  - Auth-gated
 *  - Pulls current live state from API-Football (same shape as /api/live-copilot)
 *  - Asks GPT-4o to answer the user's question conversationally,
 *    grounded in the live state and the last 10 turns of conversation.
 */
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

async function apiFetch(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
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

function pickBookmakerOdds(oddsResp: any) {
  if (!oddsResp || oddsResp.length === 0) return { home: null, draw: null, away: null }
  const bookmakers = oddsResp[0]?.bookmakers || []
  const bm = bookmakers.find((b: any) => b.id === 8) || bookmakers[0]
  if (!bm) return { home: null, draw: null, away: null }
  const matchWinner = bm.bets?.find((b: any) => b.name === 'Match Winner')
  if (!matchWinner) return { home: null, draw: null, away: null }
  const home = parseFloat(matchWinner.values?.find((v: any) => v.value === 'Home')?.odd) || null
  const draw = parseFloat(matchWinner.values?.find((v: any) => v.value === 'Draw')?.odd) || null
  const away = parseFloat(matchWinner.values?.find((v: any) => v.value === 'Away')?.odd) || null
  return { home, draw, away }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { fixtureId, message, conversation } = body || {}
  if (!fixtureId || !message || typeof message !== 'string') {
    return NextResponse.json({ error: 'fixtureId and message required' }, { status: 400 })
  }

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
  const status = fx.fixture?.status?.short
  const minute = fx.fixture?.status?.elapsed ?? null
  const homeGoals = fx.goals?.home ?? null
  const awayGoals = fx.goals?.away ?? null
  const league = fx.league?.name

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
  const odds = pickBookmakerOdds(oddsResp)

  const stateBlock = `Current live state:
${homeName} ${homeGoals ?? 0} - ${awayGoals ?? 0} ${awayName} (${minute ?? '?'}' ${status ?? ''})
League: ${league}
xG: ${homeXg ?? 'n/a'} - ${awayXg ?? 'n/a'}
Shots: ${homeShots ?? 'n/a'} - ${awayShots ?? 'n/a'}
Corners: ${homeCorners ?? 'n/a'} - ${awayCorners ?? 'n/a'}
Cards: ${homeName} ${homeYellow}Y/${homeRed}R | ${awayName} ${awayYellow}Y/${awayRed}R
Possession: ${homePossession ?? 'n/a'}% - ${awayPossession ?? 'n/a'}%
Match-winner odds: Home ${odds.home ?? 'n/a'} / Draw ${odds.draw ?? 'n/a'} / Away ${odds.away ?? 'n/a'}`

  const history = Array.isArray(conversation) ? conversation.slice(-10) : []
  const historyMessages = history
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m: any) => ({ role: m.role, content: m.content }))

  let reply: string | null = null
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 200,
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content:
            "You are MatchMind's Live Co-Pilot — a calm, analytical football betting assistant. The user is watching a live match and chatting with you about it. Stay observational and respectful, never dismissive. Use the live state provided to ground your answers. If a stat the user asks about isn't available for this match, say so plainly. Keep replies to 1-3 short sentences, conversational tone. Don't invent numbers.",
        },
        { role: 'system', content: stateBlock },
        ...historyMessages,
        { role: 'user', content: message },
      ],
    })
    reply = completion.choices[0]?.message?.content?.trim() || null
  } catch (err) {
    console.error('[live-copilot/chat] OpenAI error:', err)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
  }

  if (!reply) return NextResponse.json({ error: 'No reply' }, { status: 502 })
  return NextResponse.json({ reply })
}
