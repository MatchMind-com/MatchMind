import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient as createAdmin } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const revalidate = 1800

function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 8 ? year : year - 1
}

function getDatePlusDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

async function apiFetch(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 1800 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.response || null
  } catch { return null }
}

function extractOdds(bookmaker: any) {
  if (!bookmaker) return null
  const bets = bookmaker.bets || []

  const mw   = bets.find((b: any) => b.id === 1)  // Match Winner 1X2
  const ou   = bets.find((b: any) => b.id === 5)  // Goals Over/Under
  const btts = bets.find((b: any) => b.id === 8)  // Both Teams Score
  const dc   = bets.find((b: any) => b.id === 12) // Double Chance

  const home   = parseFloat(mw?.values?.find((v: any) => v.value === 'Home')?.odd   || '0')
  const draw   = parseFloat(mw?.values?.find((v: any) => v.value === 'Draw')?.odd   || '0')
  const away   = parseFloat(mw?.values?.find((v: any) => v.value === 'Away')?.odd   || '0')
  const over25 = parseFloat(ou?.values?.find((v: any) => v.value === 'Over 2.5')?.odd  || '0')
  const under25= parseFloat(ou?.values?.find((v: any) => v.value === 'Under 2.5')?.odd || '0')
  const bttsYes= parseFloat(btts?.values?.find((v: any) => v.value === 'Yes')?.odd  || '0')
  const bttsNo = parseFloat(btts?.values?.find((v: any) => v.value === 'No')?.odd   || '0')
  const dcHome = parseFloat(dc?.values?.find((v: any) => v.value === 'Home/Draw')?.odd || '0')
  const dcAway = parseFloat(dc?.values?.find((v: any) => v.value === 'Draw/Away')?.odd || '0')

  if (!home && !draw && !away) return null
  return { home, draw, away, over25, under25, bttsYes, bttsNo, dcHome, dcAway }
}

function calcEV(aiPct: number, decimalOdds: number): number | null {
  if (!decimalOdds || decimalOdds <= 1) return null
  return Math.round(((aiPct / 100) * decimalOdds - 1) * 100)
}

// Map bet label → correct AI probability field
function getProbabilityForBet(label: string, pred: any): number {
  switch (label) {
    case 'Home Win':      return pred.home_win_pct ?? 40
    case 'Draw':          return pred.draw_pct ?? 25
    case 'Away Win':      return pred.away_win_pct ?? 35
    case 'Over 2.5':      return pred.over_2_5_pct ?? 50
    case 'Under 2.5':     return 100 - (pred.over_2_5_pct ?? 50)
    case 'BTTS':          return pred.btts_pct ?? 45
    case 'BTTS — No':     return 100 - (pred.btts_pct ?? 45)
    case 'Home/Draw DC':  return (pred.home_win_pct ?? 40) + (pred.draw_pct ?? 25)
    case 'Away/Draw DC':  return (pred.away_win_pct ?? 35) + (pred.draw_pct ?? 25)
    default:              return 50
  }
}

// Diversity filter: pick top N value bets with no more than maxPerType of same type
function applyDiversityFilter(
  allBets: Array<{ match: string; label: string; ev: number; odds: number; aiProb: number; fixtureId: number; leagueName: string }>,
  maxPerType = 3,
  maxTotal = 10
) {
  const sorted = [...allBets].sort((a, b) => b.ev - a.ev)
  const typeCounts: Record<string, number> = {}
  const selected: typeof allBets = []

  for (const bet of sorted) {
    if (selected.length >= maxTotal) break
    const count = typeCounts[bet.label] ?? 0
    if (count >= maxPerType) continue
    typeCounts[bet.label] = count + 1
    selected.push(bet)
  }

  return selected
}

const TOP_LEAGUES = [
  { id: 39,  name: 'Premier League',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga',           flag: '🇪🇸' },
  { id: 135, name: 'Serie A',           flag: '🇮🇹' },
  { id: 78,  name: 'Bundesliga',        flag: '🇩🇪' },
  { id: 61,  name: 'Ligue 1',           flag: '🇫🇷' },
  { id: 2,   name: 'Champions League',  flag: '🏆' },
  { id: 3,   name: 'Europa League',     flag: '🥈' },
  { id: 848, name: 'Conference League', flag: '🥉' },
  { id: 88,  name: 'Eredivisie',        flag: '🇳🇱' },
  { id: 94,  name: 'Primeira Liga',     flag: '🇵🇹' },
]

export async function GET() {
  try {
    const season = getCurrentSeason()
    const today = new Date().toISOString().split('T')[0]
    const in3days = getDatePlusDays(3)

    const leagueResults = await Promise.all(
      TOP_LEAGUES.map(async (league) => {
        const [fixtures, oddsData, injuries] = await Promise.all([
          apiFetch(`/fixtures?league=${league.id}&season=${season}&from=${today}&to=${in3days}&status=NS`),
          apiFetch(`/odds?league=${league.id}&season=${season}&date=${today}&bookmaker=1`),
          apiFetch(`/injuries?league=${league.id}&season=${season}&date=${today}`),
        ])

        const oddsMap: Record<number, ReturnType<typeof extractOdds>> = {}
        if (oddsData) {
          for (const entry of oddsData) {
            const fid = entry.fixture?.id
            const bk = entry.bookmakers?.[0]
            if (fid && bk) oddsMap[fid] = extractOdds(bk)
          }
        }

        const injuryMap: Record<number, string[]> = {}
        if (injuries) {
          for (const inj of injuries) {
            const teamId = inj.team?.id
            const playerName = inj.player?.name
            const reason = inj.player?.reason
            if (teamId && playerName) {
              if (!injuryMap[teamId]) injuryMap[teamId] = []
              injuryMap[teamId].push(`${playerName}${reason ? ` (${reason})` : ''}`)
            }
          }
        }

        return (fixtures || []).slice(0, 2).map((f: any) => ({
          ...f,
          _leagueName: league.name,
          _leagueFlag: league.flag,
          _odds: oddsMap[f.fixture?.id] ?? null,
          _homeInjuries: injuryMap[f.teams?.home?.id] ?? [],
          _awayInjuries: injuryMap[f.teams?.away?.id] ?? [],
        }))
      })
    )

    const allFixtures = leagueResults.flat().slice(0, 20)

    if (allFixtures.length === 0) {
      return NextResponse.json({ success: true, predictions: [], message: 'No upcoming fixtures found' })
    }

    const fixtureList = allFixtures.map((f: any, i: number) => {
      const home = f.teams?.home?.name
      const away = f.teams?.away?.name
      const date = new Date(f.fixture?.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      const o = f._odds
      const oddsStr = o?.home ? ` | Bet365: H ${o.home} / D ${o.draw} / A ${o.away} / O2.5 ${o.over25} / BTTS ${o.bttsYes}` : ''
      const homeInj = f._homeInjuries?.length ? ` | ${home} injuries: ${f._homeInjuries.slice(0, 3).join(', ')}` : ''
      const awayInj = f._awayInjuries?.length ? ` | ${away} injuries: ${f._awayInjuries.slice(0, 3).join(', ')}` : ''
      return `${i + 1}. ${home} vs ${away} | ${f._leagueName} | ${date}${oddsStr}${homeInj}${awayInj}`
    }).join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: `You are an expert football analyst. Generate precise match predictions using current form, league position, H2H history, injuries, and tactical factors.

CRITICAL DIVERSITY RULE: You MUST vary your recommended_bet types. Do NOT recommend "Over 2.5" for more than 3 matches. Spread picks across: Home Win, Away Win, Draw, Over 2.5, Under 2.5, BTTS, Double Chance. Only recommend Over 2.5 if you have very high confidence (over_2_5_pct ≥ 68%) AND the bookmaker odds are at least 1.75+.

When Bet365 odds are shown, use them to cross-check your probability estimates. If the bookmaker prices something at 1.50 (implying 67%), your AI probability for that market should be close unless you have very specific insider factors to justify a big deviation.

Return valid JSON only.`
      }, {
        role: 'user',
        content: `Generate diverse predictions for these ${season}/${String(season + 1).slice(2)} season matches. Vary your recommended bet types — mix match results, goals, and BTTS picks.

Matches:
${fixtureList}

Return JSON with this exact structure:
{
  "predictions": [
    {
      "index": 1,
      "home_win_pct": 55,
      "draw_pct": 25,
      "away_win_pct": 20,
      "over_2_5_pct": 58,
      "btts_pct": 52,
      "confidence": 8,
      "recommended_bet": "Home Win",
      "recommended_odds_range": "1.85-2.10",
      "key_factors": ["5-game home winning run", "Away striker suspended", "H2H: home won 4 of last 5"],
      "risk_level": "Low"
    }
  ]
}`
      }],
      max_tokens: 2500,
    })

    const gptData = JSON.parse(completion.choices[0]?.message?.content || '{"predictions":[]}')
    const gptMap: Record<number, any> = {}
    ;(gptData.predictions || []).forEach((p: any) => { gptMap[p.index] = p })

    const todayFixtureIds = allFixtures
      .filter((f: any) => f.fixture?.date?.startsWith(today))
      .map((f: any) => f.fixture?.id)
      .filter(Boolean)
      .slice(0, 6)

    const lineupMap: Record<number, { home: string[]; away: string[] }> = {}
    await Promise.all(
      todayFixtureIds.map(async (fid: number) => {
        const data = await apiFetch(`/fixtures/lineups?fixture=${fid}`)
        if (data && data.length >= 2) {
          const extract = (team: any) =>
            (team.startXI || []).map((p: any) => `${p.player?.number ?? ''} ${p.player?.name ?? ''}`.trim()).filter(Boolean)
          lineupMap[fid] = { home: extract(data[0]), away: extract(data[1]) }
        }
      })
    )

    // Build all candidate value bets for diversity filtering (DB save)
    const allCandidateValueBets: Array<{
      match: string; label: string; ev: number; odds: number; aiProb: number
      fixtureId: number; leagueName: string; kickOff: string
      homeTeam: string; awayTeam: string; betType: string; prediction: string
    }> = []

    const predictions = allFixtures.map((f: any, i: number) => {
      const pred = gptMap[i + 1] || {}
      const o = f._odds

      const homeWinPct = pred.home_win_pct ?? 40
      const drawPct    = pred.draw_pct    ?? 25
      const awayWinPct = pred.away_win_pct ?? 35
      const over25Pct  = pred.over_2_5_pct ?? 55
      const under25Pct = 100 - over25Pct
      const bttsPct    = pred.btts_pct    ?? 50
      const bttsNoPct  = 100 - bttsPct
      const dcHomePct  = homeWinPct + drawPct
      const dcAwayPct  = awayWinPct + drawPct

      const homeEV    = o?.home    ? calcEV(homeWinPct,  o.home)    : null
      const drawEV    = o?.draw    ? calcEV(drawPct,     o.draw)    : null
      const awayEV    = o?.away    ? calcEV(awayWinPct,  o.away)    : null
      const over25EV  = o?.over25  ? calcEV(over25Pct,   o.over25)  : null
      const under25EV = o?.under25 ? calcEV(under25Pct,  o.under25) : null
      const bttsEV    = o?.bttsYes ? calcEV(bttsPct,     o.bttsYes) : null
      const bttsNoEV  = o?.bttsNo  ? calcEV(bttsNoPct,   o.bttsNo)  : null
      const dcHomeEV  = o?.dcHome  ? calcEV(dcHomePct,   o.dcHome)  : null
      const dcAwayEV  = o?.dcAway  ? calcEV(dcAwayPct,   o.dcAway)  : null

      const valueBets = [
        { label: 'Home Win',      ev: homeEV,    odds: o?.home,    aiProb: homeWinPct,  betType: 'Match Result',   prediction: 'home_win' },
        { label: 'Draw',          ev: drawEV,    odds: o?.draw,    aiProb: drawPct,     betType: 'Match Result',   prediction: 'draw' },
        { label: 'Away Win',      ev: awayEV,    odds: o?.away,    aiProb: awayWinPct,  betType: 'Match Result',   prediction: 'away_win' },
        { label: 'Over 2.5',      ev: over25EV,  odds: o?.over25,  aiProb: over25Pct,   betType: 'Over / Under',   prediction: 'over_2_5' },
        { label: 'Under 2.5',     ev: under25EV, odds: o?.under25, aiProb: under25Pct,  betType: 'Over / Under',   prediction: 'under_2_5' },
        { label: 'BTTS',          ev: bttsEV,    odds: o?.bttsYes, aiProb: bttsPct,     betType: 'Both Teams Score', prediction: 'btts_yes' },
        { label: 'BTTS — No',     ev: bttsNoEV,  odds: o?.bttsNo,  aiProb: bttsNoPct,   betType: 'Both Teams Score', prediction: 'btts_no' },
        { label: 'Home/Draw DC',  ev: dcHomeEV,  odds: o?.dcHome,  aiProb: dcHomePct,   betType: 'Double Chance',  prediction: 'home_draw' },
        { label: 'Away/Draw DC',  ev: dcAwayEV,  odds: o?.dcAway,  aiProb: dcAwayPct,   betType: 'Double Chance',  prediction: 'away_draw' },
      ]
        .filter(x => x.ev !== null && x.ev > 5 && x.odds && x.odds >= 1.30 && x.odds <= 3.5)
        .sort((a, b) => (b.ev ?? 0) - (a.ev ?? 0))

      const bestValue = valueBets[0] ?? null

      // Collect candidates for DB diversity filter
      if (f.fixture?.id && f.fixture?.date?.startsWith(today)) {
        for (const vb of valueBets.slice(0, 2)) {
          // EV cap at 50%: above this usually means the AI is wildly miscalibrated
          if (vb.ev !== null && vb.ev >= 12 && vb.ev <= 50 && vb.odds) {
            allCandidateValueBets.push({
              match: `${f.teams?.home?.name} vs ${f.teams?.away?.name}`,
              label: vb.label,
              ev: vb.ev,
              odds: vb.odds,
              aiProb: vb.aiProb,
              fixtureId: f.fixture.id,
              leagueName: f._leagueName,
              kickOff: f.fixture.date,
              homeTeam: f.teams?.home?.name,
              awayTeam: f.teams?.away?.name,
              betType: vb.betType,
              prediction: vb.prediction,
            })
          }
        }
      }

      return {
        id: f.fixture?.id,
        date: f.fixture?.date,
        league: f._leagueName,
        leagueFlag: f._leagueFlag,
        home_team: f.teams?.home?.name,
        home_logo: f.teams?.home?.logo,
        away_team: f.teams?.away?.name,
        away_logo: f.teams?.away?.logo,
        home_win_pct: homeWinPct,
        draw_pct: drawPct,
        away_win_pct: awayWinPct,
        over_2_5_pct: over25Pct,
        btts_pct: bttsPct,
        confidence: pred.confidence ?? 6,
        recommended_bet: pred.recommended_bet ?? 'No clear value',
        recommended_odds_range: pred.recommended_odds_range ?? '—',
        key_factors: pred.key_factors ?? [],
        risk_level: pred.risk_level ?? 'Medium',
        bookmaker: o ? {
          home: o.home || null,
          draw: o.draw || null,
          away: o.away || null,
          over25: o.over25 || null,
          under25: o.under25 || null,
          btts: o.bttsYes || null,
          bttsNo: o.bttsNo || null,
        } : null,
        ev: { home: homeEV, draw: drawEV, away: awayEV, over25: over25EV, under25: under25EV, btts: bttsEV },
        best_value: bestValue ? { label: bestValue.label, ev: bestValue.ev, odds: bestValue.odds } : null,
        is_value_bet: bestValue !== null && (bestValue.ev ?? 0) >= 15 && (bestValue.ev ?? 0) <= 50,
        value_score: bestValue?.ev ?? null,
        home_injuries: f._homeInjuries ?? [],
        away_injuries: f._awayInjuries ?? [],
        lineups: lineupMap[f.fixture?.id] ?? null,
      }
    })

    // ── Save to DB with diversity filter ────────────────────────────────────
    try {
      // Apply diversity: max 3 of same bet type per day, top 10 total
      const diversePicks = applyDiversityFilter(allCandidateValueBets, 3, 10)

      const records = diversePicks.map(pick => ({
        fixture_id: pick.fixtureId,
        home_team: pick.homeTeam,
        away_team: pick.awayTeam,
        league: pick.leagueName,
        kick_off: pick.kickOff,
        season,
        bet_type: pick.betType,
        prediction: pick.prediction,
        ai_probability: Math.round(pick.aiProb),  // ✅ Correct probability for selected bet type
        odds: pick.odds,
        ev_percent: pick.ev,
        is_value_bet: pick.ev >= 15 && pick.ev <= 50,
      }))

      if (records.length > 0) {
        await supabaseAdmin
          .from('prediction_records')
          .upsert(records, { onConflict: 'fixture_id,prediction', ignoreDuplicates: true })
      }
    } catch (dbErr) {
      console.error('Failed to save predictions to DB:', dbErr)
    }

    return NextResponse.json({ success: true, predictions })
  } catch (err) {
    console.error('Predictions error:', err)
    return NextResponse.json({ success: false, error: 'Failed to generate predictions' }, { status: 500 })
  }
}
