/**
 * /api/fixtures/[fixtureId]/all-markets
 *
 * Comprehensive markets endpoint for a single fixture. Returns every supported
 * bet type (1X2, double chance, HT/FT, totals, BTTS, corners, cards, halftime,
 * specials, handicap) with AI verdict + EV per selection — so the UI can show
 * a "what should I bet on this match?" panel that actually covers everything.
 *
 * Uses a single GPT-4o-mini call to evaluate ALL markets in one shot. If the
 * GPT call fails, every selection is returned with verdict=skip + a friendly
 * fallback reason. Per-fixture in-memory cache (1h TTL) keeps API/$$$ in check.
 */
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// 60s function budget — Vercel Pro supports up to 300s.
// API-Football can be slow on international/lower-tier fixtures (10-20s per
// call); with a 7s per-call abort in apiFetch the worst case is now ~20s
// for the two parallel fetches, leaving ≥35s for GPT-4o-mini.
export const maxDuration = 60
const TOTAL_BUDGET_MS = 55000 // leave 5s of buffer for response serialisation

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

// ---- Types ---------------------------------------------------------------

type MarketCategory =
  | 'main'
  | 'goals'
  | 'btts'
  | 'corners'
  | 'cards'
  | 'halftime'
  | 'handicap'
  | 'specials'

type Verdict = 'bet' | 'lean' | 'skip' | 'avoid'

interface Selection {
  label: string
  odds: number
  impliedProb: number
  aiVerdict: Verdict
  aiReason: string
  aiProb: number
  ev: number
}

interface Market {
  category: MarketCategory
  name: string
  line: string | null
  selections: Selection[]
}

interface AllMarketsResponse {
  fixture: {
    id: number
    home: string
    away: string
    league: string
    kickoff: string
    status: string
  }
  markets: Market[]
  generatedAt: string
  /** Diagnostic flags so the UI can render a meaningful empty state. */
  diagnostics: {
    bookmakers_count: number
    odds_available: boolean
    ai_evaluated: boolean
    note?: string
  }
}

// ---- Cache ---------------------------------------------------------------

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const cache = new Map<string, { at: number; payload: AllMarketsResponse }>()

// ---- API-Football helper -------------------------------------------------

async function apiFetch(path: string): Promise<any> {
  const aborter = new AbortController()
  const tid = setTimeout(() => aborter.abort(), 7_000) // 7s hard cap per call
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 600 },
      signal: aborter.signal,
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.response || null
  } catch {
    return null
  } finally {
    clearTimeout(tid)
  }
}

function getCurrentSeason(): number {
  const now = new Date()
  return now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

// ---- Bookmaker preferences ----------------------------------------------
//
// Pinnacle (29) is sharpest for corners/cards (low margin, sharp lines).
// Bet365 (8) has best coverage on goals/winners.
// Fall back to anything that has the market.

const BOOKMAKER_PINNACLE = 29
const BOOKMAKER_BET365 = 8

interface ApiBookmaker {
  id: number
  name: string
  bets: ApiBet[]
}
interface ApiBet {
  id: number
  name: string
  values: ApiBetValue[]
}
interface ApiBetValue {
  value: string
  odd: string
}

function findBet(books: ApiBookmaker[], betId: number, preferredId: number | null = null): {
  bookmaker: ApiBookmaker
  bet: ApiBet
} | null {
  if (preferredId != null) {
    const preferred = books.find((b) => b.id === preferredId)
    if (preferred) {
      const bet = preferred.bets.find((bet) => bet.id === betId)
      if (bet) return { bookmaker: preferred, bet }
    }
  }
  for (const bm of books) {
    const bet = bm.bets.find((bet) => bet.id === betId)
    if (bet) return { bookmaker: bm, bet }
  }
  return null
}

function impliedFromOdds(odds: number): number {
  if (!odds || odds <= 1) return 0
  return Math.round((1 / odds) * 100)
}

/** Rule-based fallback verdict when GPT is unavailable — purely from implied prob. */
function fallbackVerdict(impliedProb: number): Verdict {
  if (impliedProb > 60) return 'lean'
  if (impliedProb < 35) return 'avoid'
  return 'skip'
}

// ---- Market extraction ---------------------------------------------------
//
// Each helper returns `Market | null` (null = bookmaker didn't offer it).
// Selections are returned with `aiVerdict='skip'`, `aiProb=0` placeholders;
// the GPT pass mutates those in place. We extract only the most popular lines
// to keep the prompt + UI scannable.

function makeSelection(label: string, oddRaw: string): Selection | null {
  const odds = parseFloat(oddRaw)
  if (!odds || odds <= 1.01) return null
  return {
    label,
    odds,
    impliedProb: impliedFromOdds(odds),
    aiVerdict: 'skip',
    aiReason: '',
    aiProb: 0,
    ev: 0,
  }
}

function extractSimple(
  category: MarketCategory,
  name: string,
  found: { bookmaker: ApiBookmaker; bet: ApiBet } | null,
  labelMap: Record<string, string>
): Market | null {
  if (!found) return null
  const sels: Selection[] = []
  for (const v of found.bet.values) {
    const label = labelMap[v.value] ?? v.value
    const sel = makeSelection(label, v.odd)
    if (sel) sels.push(sel)
  }
  if (!sels.length) return null
  return { category, name, line: null, selections: sels }
}

function extractOverUnderLines(
  category: MarketCategory,
  baseName: string,
  found: { bookmaker: ApiBookmaker; bet: ApiBet } | null,
  wantedLines: string[]
): Market[] {
  if (!found) return []
  // API-Football returns values like "Over 2.5", "Under 2.5"
  const byLine = new Map<string, { over: ApiBetValue | null; under: ApiBetValue | null }>()
  for (const v of found.bet.values) {
    const m = /^(Over|Under)\s+([\d.]+)$/i.exec(v.value.trim())
    if (!m) continue
    const side = m[1].toLowerCase()
    const line = m[2]
    if (!byLine.has(line)) byLine.set(line, { over: null, under: null })
    const bucket = byLine.get(line)!
    if (side === 'over') bucket.over = v
    else bucket.under = v
  }
  const result: Market[] = []
  for (const line of wantedLines) {
    const b = byLine.get(line)
    if (!b) continue
    const sels: Selection[] = []
    if (b.over) {
      const s = makeSelection(`Over ${line}`, b.over.odd)
      if (s) sels.push(s)
    }
    if (b.under) {
      const s = makeSelection(`Under ${line}`, b.under.odd)
      if (s) sels.push(s)
    }
    if (sels.length) {
      result.push({
        category,
        name: `${baseName} O/U ${line}`,
        line,
        selections: sels,
      })
    }
  }
  return result
}

function extractAllMarkets(books: ApiBookmaker[]): Market[] {
  const markets: Market[] = []

  // Main — Match Winner (id 1) — Bet365 preferred
  const matchWinner = extractSimple(
    'main',
    'Match Winner',
    findBet(books, 1, BOOKMAKER_BET365),
    { Home: 'Home Win', Draw: 'Draw', Away: 'Away Win' }
  )
  if (matchWinner) markets.push(matchWinner)

  // Main — Double Chance (id 12)
  const dc = extractSimple(
    'main',
    'Double Chance',
    findBet(books, 12, BOOKMAKER_BET365),
    { 'Home/Draw': '1X (Home or Draw)', 'Home/Away': '12 (Either Win)', 'Draw/Away': 'X2 (Draw or Away)' }
  )
  if (dc) markets.push(dc)

  // Main — Half Time/Full Time (id 4)
  const htft = findBet(books, 4, BOOKMAKER_BET365)
  if (htft) {
    const sels: Selection[] = []
    for (const v of htft.bet.values) {
      const sel = makeSelection(v.value, v.odd)
      if (sel) sels.push(sel)
    }
    if (sels.length) {
      markets.push({ category: 'main', name: 'Half Time / Full Time', line: null, selections: sels.slice(0, 9) })
    }
  }

  // Goals — Total Goals O/U (id 5)
  markets.push(
    ...extractOverUnderLines(
      'goals',
      'Total Goals',
      findBet(books, 5, BOOKMAKER_BET365),
      ['1.5', '2.5', '3.5']
    )
  )

  // Goals — HT Goals O/U (id 6)
  markets.push(
    ...extractOverUnderLines(
      'goals',
      'HT Goals',
      findBet(books, 6, BOOKMAKER_BET365),
      ['0.5', '1.5']
    )
  )

  // BTTS — Both Teams Score (id 8)
  const btts = extractSimple('btts', 'Both Teams to Score', findBet(books, 8, BOOKMAKER_BET365), {
    Yes: 'Yes',
    No: 'No',
  })
  if (btts) markets.push(btts)

  // BTTS in 1H (id 33)
  const btts1h = extractSimple('btts', 'BTTS in 1st Half', findBet(books, 33, BOOKMAKER_BET365), {
    Yes: 'Yes',
    No: 'No',
  })
  if (btts1h) markets.push(btts1h)

  // Corners — Total (id 45)
  markets.push(
    ...extractOverUnderLines(
      'corners',
      'Total Corners',
      findBet(books, 45, BOOKMAKER_PINNACLE),
      ['8.5', '9.5', '10.5']
    )
  )

  // Corners — Home (id 77)
  markets.push(
    ...extractOverUnderLines(
      'corners',
      'Home Corners',
      findBet(books, 77, BOOKMAKER_PINNACLE),
      ['4.5', '5.5']
    )
  )

  // Corners — Away (id 78)
  markets.push(
    ...extractOverUnderLines(
      'corners',
      'Away Corners',
      findBet(books, 78, BOOKMAKER_PINNACLE),
      ['3.5', '4.5']
    )
  )

  // Cards — Total (id 80)
  markets.push(
    ...extractOverUnderLines(
      'cards',
      'Total Cards',
      findBet(books, 80, BOOKMAKER_PINNACLE),
      ['3.5', '4.5']
    )
  )

  // Cards — Home (id 81)
  markets.push(
    ...extractOverUnderLines(
      'cards',
      'Home Cards',
      findBet(books, 81, BOOKMAKER_PINNACLE),
      ['1.5', '2.5']
    )
  )

  // Halftime — HT Result (id 9)
  const ht = extractSimple('halftime', 'Half Time Result', findBet(books, 9, BOOKMAKER_BET365), {
    Home: 'Home',
    Draw: 'Draw',
    Away: 'Away',
  })
  if (ht) markets.push(ht)

  // Specials — Win to Nil (id 22)
  const wtn = findBet(books, 22, BOOKMAKER_BET365)
  if (wtn) {
    const sels: Selection[] = []
    for (const v of wtn.bet.values) {
      const sel = makeSelection(v.value, v.odd)
      if (sel) sels.push(sel)
    }
    if (sels.length) markets.push({ category: 'specials', name: 'Win to Nil', line: null, selections: sels.slice(0, 4) })
  }

  // Handicap — Asian Handicap (id 26)
  const ah = findBet(books, 26, BOOKMAKER_PINNACLE)
  if (ah) {
    const sels: Selection[] = []
    for (const v of ah.bet.values) {
      const sel = makeSelection(v.value, v.odd)
      if (sel) sels.push(sel)
    }
    if (sels.length) markets.push({ category: 'handicap', name: 'Asian Handicap', line: null, selections: sels.slice(0, 6) })
  }

  return markets
}

// ---- GPT batch evaluator -------------------------------------------------
//
// We use deterministic numeric IDs of the form "M.S" (market index + selection
// index) instead of asking GPT to echo back the market_name and selection
// label. GPT routinely paraphrases — "Match Winner" → "Home/Away", "Over 2.5"
// → "O 2.5" — which broke the lookup and caused reasoning to be attached to
// the wrong selection (e.g. an "Over 2.5" verdict displaying a "Home Win"
// reason). Numeric IDs are unambiguous and cheap.

interface GptVerdict {
  id: string // "marketIdx.selectionIdx"
  verdict: Verdict
  prob: number
  reason: string
}

function buildPrompt(
  fixture: {
    home: string
    away: string
    league: string
    kickoff: string
  },
  formSummary: string,
  markets: Market[]
): { system: string; user: string } {
  const lines: string[] = []
  markets.forEach((m, mi) => {
    lines.push(`MARKET ${mi}: ${m.name}`)
    m.selections.forEach((s, si) => {
      lines.push(
        `  id=${mi}.${si} selection="${s.label}" odds=${s.odds.toFixed(2)} implied=${s.impliedProb}%`
      )
    })
  })

  const system = `You are a calibrated football betting analyst. Evaluate every (market, selection) pair you are given. For EACH selection return:
- id: the EXACT id string from the input (e.g. "3.1") — copy it verbatim.
- verdict: "bet" (clear edge, EV >= 5%), "lean" (slight edge, EV 1-5%), "skip" (neutral, EV ~0), or "avoid" (implied too generous, negative EV).
- prob: your 0-100 estimate of true probability (integer).
- reason: ONE short sentence (max 14 words) directly justifying THIS selection — never reference a different market or selection.

Calibration:
1. Implied probabilities reflect sharp money — usually within ±5pts of truth.
2. Your prob must be within ±10pts of implied UNLESS you have a specific concrete reason.
3. Probabilities for mutually exclusive selections in the same market should sum near 100-110% (allowing for vig).
4. Be conservative — most markets are efficient. Default to "skip" when uncertain.

CRITICAL: Your reason for a selection like "Over 2.5" must be ABOUT goals — never about home/away winning. Your reason for "Home Win" must be about which side wins — never about totals or BTTS. Each reason is read directly under its selection, so a mismatch is misleading.

Return strict JSON: { "verdicts": [{ "id": "0.0", "verdict": "lean", "prob": 60, "reason": "..." }, ...] } with one entry for EVERY id you were given.`

  const user = `Fixture: ${fixture.home} vs ${fixture.away}
League: ${fixture.league}
Kickoff: ${fixture.kickoff}

Context:
${formSummary || 'No additional form data available.'}

Evaluate every selection below — return one verdict per id.

${lines.join('\n')}`
  return { system, user }
}

async function evaluateWithGpt(
  fixture: { home: string; away: string; league: string; kickoff: string },
  formSummary: string,
  markets: Market[],
  /** Hard wall-clock budget in ms — Vercel Hobby caps at 10s total. */
  budgetMs: number
): Promise<Map<string, GptVerdict>> {
  if (!markets.length) return new Map()
  const { system, user } = buildPrompt(fixture, formSummary, markets)

  // Race the OpenAI call against a tight timeout so this can never burn
  // the entire 10s function budget on a slow GPT response. If it times
  // out we return an empty Map and the caller falls back to neutral.
  const aborter = new AbortController()
  const timer = setTimeout(() => aborter.abort(), Math.max(2000, budgetMs))

  let raw = '{"verdicts":[]}'
  try {
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        temperature: 0,
        seed: 42,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        // 1200 is plenty for ~30 verdicts (id + verdict + prob + 14-word
        // reason, ~30 tokens each → ~900 tokens). Down from 2500.
        max_tokens: 1200,
      },
      { signal: aborter.signal as any }
    )
    raw = completion.choices[0]?.message?.content || '{"verdicts":[]}'
  } finally {
    clearTimeout(timer)
  }

  const parsed = JSON.parse(raw)
  const out = new Map<string, GptVerdict>()
  for (const v of parsed.verdicts || []) {
    if (!v?.id) continue
    const id = String(v.id).trim()
    if (!/^\d+\.\d+$/.test(id)) continue
    out.set(id, {
      id,
      verdict: (['bet', 'lean', 'skip', 'avoid'].includes(v.verdict) ? v.verdict : 'skip') as Verdict,
      prob: Math.max(0, Math.min(100, Number(v.prob) || 0)),
      reason: String(v.reason || '').slice(0, 160),
    })
  }
  return out
}

function applyVerdicts(markets: Market[], verdicts: Map<string, GptVerdict>): Market[] {
  markets.forEach((m, mi) => {
    m.selections.forEach((sel, si) => {
      const id = `${mi}.${si}`
      const v = verdicts.get(id)
      if (v) {
        sel.aiVerdict = v.verdict
        sel.aiProb = v.prob
        sel.aiReason = v.reason
        // EV = (prob/100 × odds) - 1
        sel.ev = Math.round(((v.prob / 100) * sel.odds - 1) * 100)
      } else {
        // No verdict for this selection — neutral skip with implied prob,
        // and a generic reason that is at least correct (refers to the right
        // selection by label, never inherits text from another row).
        sel.aiVerdict = 'skip'
        sel.aiReason = `Neutral on ${sel.label} — no clear edge found.`
        sel.aiProb = sel.impliedProb
        sel.ev = 0
      }
    })
    // Sort selections within a market: bet → lean → skip → avoid
    m.selections.sort((a, b) => verdictRank(a.aiVerdict) - verdictRank(b.aiVerdict))
  })
  return markets
}

function verdictRank(v: Verdict): number {
  switch (v) {
    case 'bet':
      return 0
    case 'lean':
      return 1
    case 'skip':
      return 2
    case 'avoid':
      return 3
  }
}

// ---- Form summary --------------------------------------------------------

function summarizeForm(homeForm: any[], awayForm: any[], homeName: string, awayName: string): string {
  function fmt(matches: any[], teamName: string, teamId: number): string {
    if (!matches?.length) return ''
    const parts = matches.slice(0, 5).map((f: any) => {
      const isHome = f.teams?.home?.id === teamId
      const tg = isHome ? f.goals?.home : f.goals?.away
      const og = isHome ? f.goals?.away : f.goals?.home
      const r = tg > og ? 'W' : tg < og ? 'L' : 'D'
      return `${r}${tg}-${og}`
    })
    return `${teamName} L5: ${parts.join(' ')}`
  }
  // Identify the team by matching name in the first match (works whether they
  // were home or away in that game).
  const lines: string[] = []
  if (homeForm?.length) {
    const firstMatchHomeId =
      homeForm[0]?.teams?.home?.name === homeName
        ? homeForm[0]?.teams?.home?.id
        : homeForm[0]?.teams?.away?.id
    if (firstMatchHomeId) lines.push(fmt(homeForm, homeName, firstMatchHomeId))
  }
  if (awayForm?.length) {
    const firstMatchAwayId =
      awayForm[0]?.teams?.home?.name === awayName
        ? awayForm[0]?.teams?.home?.id
        : awayForm[0]?.teams?.away?.id
    if (firstMatchAwayId) lines.push(fmt(awayForm, awayName, firstMatchAwayId))
  }
  return lines.join(' | ')
}

// ---- Route ---------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: { fixtureId: string } }
) {
  const t0 = Date.now()
  const remaining = () => Math.max(500, TOTAL_BUDGET_MS - (Date.now() - t0))
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const fixtureId = params.fixtureId
    if (!fixtureId || !/^\d+$/.test(fixtureId)) {
      return NextResponse.json({ error: 'Invalid fixture id' }, { status: 400 })
    }

    // Cache hit?
    const cached = cache.get(fixtureId)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return NextResponse.json(cached.payload)
    }

    // Fetch fixture meta + odds in parallel.
    const [fixtureData, oddsData] = await Promise.all([
      apiFetch(`/fixtures?id=${fixtureId}`),
      apiFetch(`/odds?fixture=${fixtureId}`),
    ])

    if (!fixtureData?.length) {
      // Return an empty-but-shaped response instead of 404 so the UI can render
      // a friendly message rather than a hard error.
      return NextResponse.json({
        fixture: { id: Number(fixtureId), home: '—', away: '—', league: '—', kickoff: '', status: 'NS' },
        markets: [],
        generatedAt: new Date().toISOString(),
        diagnostics: {
          bookmakers_count: 0,
          odds_available: false,
          ai_evaluated: false,
          note: 'Fixture not found in our data feed. It may have been postponed or the ID is wrong.',
        },
      })
    }
    const fx = fixtureData[0]
    const homeName = fx.teams?.home?.name ?? 'Home'
    const awayName = fx.teams?.away?.name ?? 'Away'
    const homeId = fx.teams?.home?.id
    const awayId = fx.teams?.away?.id
    const leagueName = fx.league?.name ?? '—'
    const status = fx.fixture?.status?.short ?? 'NS'
    const kickoff = fx.fixture?.date ?? ''

    // Pull bookmakers from the first odds entry for this fixture.
    const oddsEntry = (oddsData ?? []).find((o: any) => o.fixture?.id === Number(fixtureId)) || (oddsData ?? [])[0]
    const bookmakers: ApiBookmaker[] = (oddsEntry?.bookmakers ?? []).map((b: any) => ({
      id: b.id,
      name: b.name,
      bets: (b.bets ?? []).map((bt: any) => ({
        id: bt.id,
        name: bt.name,
        values: (bt.values ?? []).map((v: any) => ({ value: String(v.value), odd: String(v.odd) })),
      })),
    }))

    let markets = extractAllMarkets(bookmakers)
    // Cap at 18 markets — covers the popular ones (1X2, Double Chance,
    // BTTS, Total/HT goals, Corners, Cards, HT result, Win to Nil) AND
    // keeps the GPT prompt small enough to evaluate inside our 10s budget.
    // Was 30 — caused timeouts because 30 markets × 3 selections = up to
    // 90 verdicts which sometimes blew the budget on slower OpenAI calls.
    markets = markets.slice(0, 18)

    // Decide on a useful diagnostic note for the UI when there's nothing to show.
    // Live/finished games and lower-tier fixtures often have no bookmaker odds.
    const finishedStatuses = ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST']
    const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE']
    let diagnosticNote: string | undefined
    if (!bookmakers.length) {
      if (finishedStatuses.includes(status)) {
        diagnosticNote = 'This fixture has finished — bookmakers no longer offer odds.'
      } else if (liveStatuses.includes(status)) {
        diagnosticNote = 'Live fixture — pre-match odds have closed and live odds are not available here.'
      } else {
        diagnosticNote = 'No bookmaker has posted odds for this fixture yet. Check back closer to kickoff.'
      }
    } else if (markets.length === 0) {
      diagnosticNote = 'Bookmakers are listed but none currently offer the markets we track for this fixture.'
    }

    // Pull recent form for AI context — but only if we have at least 5
    // seconds of budget left. The form fetch is cheap (~500ms) but not
    // worth the risk of timing out the whole route on slow upstream.
    let formSummary = ''
    if (markets.length && homeId && awayId && remaining() > 5000) {
      const [homeForm, awayForm] = await Promise.all([
        apiFetch(`/fixtures?team=${homeId}&last=5`),
        apiFetch(`/fixtures?team=${awayId}&last=5`),
      ])
      formSummary = summarizeForm(homeForm || [], awayForm || [], homeName, awayName)
    }

    // Single GPT call to evaluate every market — racing against the
    // remaining wall-clock budget. If the budget is too tight we skip
    // the AI step entirely and return markets with neutral verdicts.
    let evaluated = markets
    let aiEvaluated = false
    const gptBudget = remaining() - 1500 // reserve 1.5s for serialisation
    if (markets.length && gptBudget >= 2000) {
      try {
        const verdicts = await evaluateWithGpt(
          { home: homeName, away: awayName, league: leagueName, kickoff },
          formSummary,
          markets,
          gptBudget
        )
        evaluated = applyVerdicts(markets, verdicts)
        aiEvaluated = verdicts.size > 0
        if (!aiEvaluated && !diagnosticNote) {
          diagnosticNote = 'AI verdicts not ready yet — refresh in a moment to grade these markets.'
        }
      } catch (err: any) {
        console.warn('[all-markets] GPT eval failed:', err?.name, err?.message)
        // Rule-based fallback: derive verdict from implied probability so the
        // UI shows meaningful colors even when GPT is unavailable.
        for (const m of evaluated) {
          for (const s of m.selections) {
            s.aiVerdict = fallbackVerdict(s.impliedProb)
            s.aiReason = ''
            s.aiProb = s.impliedProb
            s.ev = 0
          }
        }
        if (!diagnosticNote) {
          diagnosticNote = err?.name === 'AbortError'
            ? 'AI verdicts timed out — markets shown with neutral grading. Try refresh.'
            : 'AI evaluator unavailable — markets shown with neutral grading.'
        }
      }
    } else if (markets.length && gptBudget <= 2000) {
      // Not enough budget left for AI — rule-based fallback verdicts from
      // implied probability so the UI shows meaningful colors.
      for (const m of evaluated) {
        for (const s of m.selections) {
          s.aiVerdict = fallbackVerdict(s.impliedProb)
          s.aiReason = ''
          s.aiProb = s.impliedProb
          s.ev = 0
        }
      }
      if (!diagnosticNote) {
        diagnosticNote = 'Markets loaded — refresh to grade with AI.'
      }
    }

    const payload: AllMarketsResponse = {
      fixture: {
        id: Number(fixtureId),
        home: homeName,
        away: awayName,
        league: leagueName,
        kickoff,
        status,
      },
      markets: evaluated,
      generatedAt: new Date().toISOString(),
      diagnostics: {
        bookmakers_count: bookmakers.length,
        odds_available: bookmakers.length > 0,
        ai_evaluated: aiEvaluated,
        note: diagnosticNote,
      },
    }

    cache.set(fixtureId, { at: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (err: any) {
    // Last-ditch safety net — never let the panel see a generic 500. Return
    // a shaped empty payload so the UI explains *why* it can't show anything,
    // rather than rendering "Couldn't load markets — HTTP 500" to the user.
    console.error('[all-markets] unexpected error:', err?.message, err?.stack)
    return NextResponse.json({
      fixture: { id: Number(params.fixtureId) || 0, home: '—', away: '—', league: '—', kickoff: '', status: 'NS' },
      markets: [],
      generatedAt: new Date().toISOString(),
      diagnostics: {
        bookmakers_count: 0,
        odds_available: false,
        ai_evaluated: false,
        note: 'Markets temporarily unavailable — our data feed had a hiccup. Try refresh in a moment.',
      },
    })
  }
}
