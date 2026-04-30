/**
 * GET /api/dream-bet/daily-plan
 *
 * Returns a 30-day rolling betting plan for the user's active Dream Bet goal.
 * For EACH day in the next 30 days we surface up to 3 of the highest-EV picks
 * across all 25+ tracked leagues (no per-day risk-tier filter — the user wants
 * to SEE everything, then we mark which ones fall outside their preferred odds
 * window). When the user is well behind a stretch goal we additionally bundle
 * the top 2-3 picks of the day into an ACCA suggestion to push toward the
 * required growth rate (high variance, smaller stake, clearly labelled).
 *
 * Days with no fixtures yet (typical 14+ days out) render as a "picks not yet
 * available" placeholder rather than a guilt-trip rest day.
 *
 * Cache: per-user 1 hour (in-memory). One OpenAI call generates all 30 notes
 * in a single batch.
 */

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getUserContext, type UserContext } from '@/lib/user-context'
import { recommendStake } from '@/lib/stake-recommender'

export const dynamic = 'force-dynamic'

type RiskLevel = 'conservative' | 'balanced' | 'aggressive'

type SuggestedBet = {
  home: string
  away: string
  league: string
  market: string
  selection: string
  odds: number
  stake: number
  ev: number
  fixtureId: number | null
  reasoning: string
  kickoff: string
  /** 'in-range' if odds match the user's risk window, otherwise 'out-of-range'. */
  tierMatch: 'in-range' | 'out-of-range'
  /** True when this row is an accumulator built from multiple legs. */
  isAcca?: boolean
  accaLegs?: Array<{
    home: string
    away: string
    selection: string
    odds: number
    league: string
  }>
}

type DayPlan = {
  date: string
  label: string
  targetBankroll: number
  suggestedBets: SuggestedBet[]
  note: string
  /** True when the day is too far out for fixtures to exist yet. */
  fixturesPending: boolean
}

type GoalSummary = {
  target: number
  daysLeft: number
  onTrack: boolean
  requiredDailyGrowthPct: number
}

type PlanSummary = {
  totalPicksScanned: number
  positiveEvPicks: number
  topMarkets: Array<{ market: string; pct: number }>
  daysCovered: number
  daysWithPicks: number
}

type ApiResponse =
  | {
      plan: DayPlan[]
      goal: GoalSummary
      bankroll: number
      summary: PlanSummary
    }
  | {
      plan: null
      goal: null
      bankroll: number
      message: string
    }

// ── Tiny in-memory cache (per-user, 1 hour) ─────────────────────────
type CacheEntry = { at: number; data: ApiResponse }
const CACHE = new Map<string, CacheEntry>()
const TTL_MS = 60 * 60 * 1000

const PLAN_HORIZON_DAYS = 30

// ── Helpers ─────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(base: Date, days: number): Date {
  const x = new Date(base)
  x.setDate(x.getDate() + days)
  return x
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dayLabel(d: Date, today: Date, tomorrow: Date): string {
  const dStart = startOfDay(d).getTime()
  if (dStart === startOfDay(today).getTime()) {
    return `TODAY · ${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}`
  }
  if (dStart === startOfDay(tomorrow).getTime()) {
    return `TOMORROW · ${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}`
  }
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()
}

function deriveBetType(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('over') || l.includes('under')) return 'Over/Under'
  if (l.includes('btts') || l.includes('both teams')) return 'BTTS'
  return 'Match Result (1X2)'
}

const RISK_ODDS_RANGE: Record<RiskLevel, [number, number]> = {
  conservative: [1.4, 1.85],
  balanced: [1.7, 2.6],
  aggressive: [2.2, 4.0],
}

function topPicksForDay(
  predictions: any[],
  dayStart: Date,
  riskLevel: RiskLevel,
  maxPicks: number,
): any[] {
  const dayEnd = addDays(dayStart, 1)
  const dayStartMs = dayStart.getTime()
  const dayEndMs = dayEnd.getTime()
  const [oddsMin, oddsMax] = RISK_ODDS_RANGE[riskLevel]

  // Generous filter: fixture is on this day, has odds + an EV signal.
  // We DON'T filter on odds-range or even strict EV>0 — the goal is to
  // always show SOMETHING. We sort by EV desc and tag tier_match.
  const candidates = predictions.filter((p) => {
    if (!p?.date) return false
    const t = new Date(p.date).getTime()
    if (Number.isNaN(t)) return false
    if (t < dayStartMs || t >= dayEndMs) return false
    const odds = p?.best_value?.odds ?? null
    if (odds == null) return false
    return true
  })

  const seen = new Set<number>()
  const sorted = candidates.sort((a, b) => {
    const evA = Number(a?.value_score ?? a?.best_value?.ev ?? 0)
    const evB = Number(b?.value_score ?? b?.best_value?.ev ?? 0)
    return evB - evA
  })

  const out: any[] = []
  for (const p of sorted) {
    const id = Number(p?.id)
    if (id && seen.has(id)) continue
    if (id) seen.add(id)
    // Mark tier match against the user's preferred odds window.
    const odds = Number(p?.best_value?.odds ?? 0)
    p.__tierMatch = odds >= oddsMin && odds <= oddsMax ? 'in-range' : 'out-of-range'
    out.push(p)
    if (out.length >= maxPicks) break
  }
  return out
}

function maxPicksFor(risk: RiskLevel): number {
  if (risk === 'aggressive') return 3
  if (risk === 'conservative') return 2
  return 3
}

function compoundTargetFor(
  startBankroll: number,
  daysAhead: number,
  requiredDailyGrowthPct: number,
): number {
  const growth = 1 + requiredDailyGrowthPct / 100
  const v = startBankroll * Math.pow(growth, daysAhead)
  return Math.round(v * 100) / 100
}

/**
 * Build an ACCA from the top 2-3 single picks. Returns null when fewer than
 * 2 viable legs exist or when the combined odds don't push above ~2.5x (no
 * point — the user could just take the singles).
 */
function buildAcca(
  picks: SuggestedBet[],
  ctx: UserContext,
): SuggestedBet | null {
  if (picks.length < 2) return null
  const legs = picks.slice(0, Math.min(3, picks.length))
  const combinedOdds = legs.reduce((acc, p) => acc * p.odds, 1)
  if (combinedOdds < 2.5) return null

  // Combined EV (rough) — average leg EV penalised by leg count (variance grows fast).
  const avgEv = legs.reduce((s, p) => s + p.ev, 0) / legs.length
  const combinedEv = Math.round((avgEv - (legs.length - 1) * 1.5) * 10) / 10

  // Size SMALLER than a single — ACCAs are high variance.
  // Take the smallest single stake, halve it for 2-leg, third for 3-leg.
  const minSingleStake = Math.min(...legs.map((p) => (p.stake > 0 ? p.stake : 0)))
  const sizingFactor = legs.length === 2 ? 0.5 : 0.33
  let accaStake = Math.round(minSingleStake * sizingFactor * 2) / 2
  // Floor on stake — if bankroll exists, never go below £0.50 (so the row is meaningful).
  if (accaStake < 0.5 && ctx.bankroll && ctx.bankroll.current > 10) accaStake = 0.5
  if (accaStake <= 0) return null

  const home = legs.map((l) => l.home).join(' / ')
  const away = legs.map((l) => l.away).join(' / ')
  const selection = legs.map((l) => l.selection).join(' + ')

  return {
    home,
    away,
    league: `${legs.length}-leg ACCA`,
    market: 'Accumulator',
    selection,
    odds: Math.round(combinedOdds * 100) / 100,
    stake: accaStake,
    ev: combinedEv,
    fixtureId: null,
    reasoning: `${legs.length}-leg accumulator combining the day's top single picks. Higher variance but a single £${accaStake} stake returns ~£${Math.round(accaStake * combinedOdds)} if all legs land — pushes the bankroll closer to the required daily growth.`,
    kickoff: legs[0]?.kickoff ?? '',
    tierMatch: 'in-range',
    isAcca: true,
    accaLegs: legs.map((l) => ({
      home: l.home,
      away: l.away,
      selection: l.selection,
      odds: l.odds,
      league: l.league,
    })),
  }
}

function defaultNote(
  picks: SuggestedBet[],
  dayLabelStr: string,
  isOnTrack: boolean,
  fixturesPending: boolean,
  riskLevel: RiskLevel,
): string {
  if (fixturesPending) {
    return `Day ${dayLabelStr.split('·')[1]?.trim() ?? ''}: fixtures not yet published — refresh closer to the date.`
  }
  if (picks.length === 0) {
    return 'No fixtures yet for the tracked leagues today — likely a slow midweek. Focus on the busier days.'
  }
  const inRange = picks.filter((p) => p.tierMatch === 'in-range' && !p.isAcca).length
  const outOfRange = picks.filter((p) => p.tierMatch === 'out-of-range' && !p.isAcca).length
  const hasAcca = picks.some((p) => p.isAcca)

  if (hasAcca) {
    return `Aggressive goal — built an ACCA to push toward target. High variance, sized smaller. ${inRange} singles also in your odds range.`
  }
  if (inRange === 0 && outOfRange > 0) {
    const top = picks[0]
    return `No picks in your ${riskLevel} odds range today — top option is ${top.selection} @ ${top.odds.toFixed(2)} (out of range). Take it anyway, or wait for tomorrow.`
  }
  if (!isOnTrack) {
    return `${inRange} qualifying ${inRange === 1 ? 'bet' : 'bets'} — bigger sizing today to claw back the gap, but stick to the math.`
  }
  return `${inRange} qualifying ${inRange === 1 ? 'bet' : 'bets'} for ${dayLabelStr.toLowerCase()} — keep the discipline.`
}

async function generateDailyNotes(
  ctx: UserContext,
  days: Array<{
    label: string
    picks: SuggestedBet[]
    targetBankroll: number
    isToday: boolean
    fixturesPending: boolean
  }>,
  riskLevel: RiskLevel,
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    return days.map((d) =>
      defaultNote(d.picks, d.label, ctx.goal?.onTrack ?? true, d.fixturesPending, riskLevel),
    )
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const goal = ctx.goal
    const summary = days
      .map((d, i) => {
        if (d.fixturesPending) {
          return `Day ${i + 1} (${d.label}, target £${d.targetBankroll}): fixtures not yet published`
        }
        const picks = d.picks
          .map((b) => {
            const tag = b.isAcca ? '[ACCA] ' : b.tierMatch === 'out-of-range' ? '[out-of-range] ' : ''
            return `${tag}${b.selection} @${b.odds} (+${b.ev}% EV, £${b.stake})`
          })
          .join('; ')
        return `Day ${i + 1} (${d.label}, target £${d.targetBankroll}): ${picks || 'no fixtures'}`
      })
      .join('\n')
    const prompt = `You are a friendly, honest betting coach. The user's goal:
- Bankroll: £${ctx.bankroll?.current ?? 0}
- Target: £${goal?.target ?? 0} by ${goal?.endDate ?? 'soon'}
- Days left: ${goal?.daysLeft ?? 0}
- ${goal?.onTrack ? 'On track' : 'Behind pace'}
- Risk: ${riskLevel} (preferred odds ${RISK_ODDS_RANGE[riskLevel][0]}-${RISK_ODDS_RANGE[riskLevel][1]})

Here is the ${days.length}-day plan (picks tagged [ACCA] are bundled accumulators; [out-of-range] means odds outside the user's window):
${summary}

For EACH day, write ONE short note (≤24 words). Honest, not hype. No emojis. Rules:
- If picks include an ACCA: explain it's an aggressive push toward target, high variance, size carefully.
- If picks are only out-of-range: tell user the top pick + odds, suggest take it anyway or wait.
- If fixtures-pending: say picks aren't published yet, refresh closer to date.
- If no picks: frame as a slow day — focus on busier days.
- Otherwise: short, factual, encourage discipline.

Reply as a JSON object: { "notes": ["day 1 note", "day 2 note", ... ${days.length} notes total] }.`

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1800,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    })
    const raw = resp.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as { notes?: unknown }
    if (Array.isArray(parsed.notes) && parsed.notes.length === days.length) {
      return parsed.notes.map((n, i) =>
        typeof n === 'string' && n.trim()
          ? n.trim()
          : defaultNote(
              days[i].picks,
              days[i].label,
              ctx.goal?.onTrack ?? true,
              days[i].fixturesPending,
              riskLevel,
            ),
      )
    }
  } catch (err) {
    console.error('[daily-plan] OpenAI note generation failed:', err)
  }
  return days.map((d) =>
    defaultNote(d.picks, d.label, ctx.goal?.onTrack ?? true, d.fixturesPending, riskLevel),
  )
}

// ── Route handler ───────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const force = url.searchParams.get('refresh') === '1'

  // Cache hit
  const cached = CACHE.get(user.id)
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.data)
  }

  try {
    // Pull user context — bankroll + goal in one call (handles its own try/catch)
    const ctx = await getUserContext(user.id)
    const bankrollNow = ctx.bankroll?.current ?? 0

    // No active goal → return early with friendly empty state
    if (!ctx.goal) {
      const empty: ApiResponse = {
        plan: null,
        goal: null,
        bankroll: bankrollNow,
        message: 'Set a goal first to get a daily plan.',
      }
      CACHE.set(user.id, { at: Date.now(), data: empty })
      return NextResponse.json(empty)
    }

    const goal = ctx.goal
    const riskLevel = goal.riskLevel
    const today = startOfDay(new Date())
    const tomorrow = addDays(today, 1)

    // Pull all upcoming predictions across the next 30 days from the cache table.
    let predictions: any[] = []
    try {
      const admin = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      )
      const { data: rows, error } = await admin
        .from('predictions_by_league')
        .select('payload')
        .order('generated_at', { ascending: false })
      if (error) {
        console.error('[daily-plan] predictions_by_league query failed:', error)
      } else if (rows) {
        for (const r of rows) {
          if (Array.isArray(r.payload)) predictions.push(...(r.payload as any[]))
        }
      }
    } catch (err) {
      console.error('[daily-plan] predictions read exception:', err)
    }

    // ── Decide whether to build ACCAs ─────────────────────────────
    // User wants high stretch (target / current > 2.0) AND aggressive risk
    // AND is behind pace OR has very high required daily growth (>2%).
    const stretchMultiple = bankrollNow > 0 ? goal.target / bankrollNow : 0
    const wantsAcca =
      riskLevel === 'aggressive' &&
      stretchMultiple > 2.0 &&
      (!goal.onTrack || goal.requiredDailyGrowthPct > 2)

    // ── Build the 30-day plan ─────────────────────────────────────
    const dayBuckets: Array<{
      date: string
      label: string
      isoDate: string
      targetBankroll: number
      picks: SuggestedBet[]
      isToday: boolean
      fixturesPending: boolean
    }> = []

    // For "fixtures pending" detection — find the latest kickoff in the cache.
    const latestFixtureMs = predictions.reduce((max, p) => {
      const t = new Date(p?.date ?? 0).getTime()
      return Number.isNaN(t) ? max : Math.max(max, t)
    }, 0)

    let totalPicksScanned = 0
    let positiveEvPicks = 0
    const marketCounter: Record<string, number> = {}

    for (let i = 0; i < PLAN_HORIZON_DAYS; i++) {
      const d = addDays(today, i)
      const dStartMs = d.getTime()
      const dayPicks = topPicksForDay(predictions, d, riskLevel, maxPicksFor(riskLevel))
      totalPicksScanned += dayPicks.length

      const targetBankroll = compoundTargetFor(
        bankrollNow,
        i + 1,
        goal.requiredDailyGrowthPct || 0,
      )

      const suggestedBets: SuggestedBet[] = dayPicks.map((p) => {
        const odds = Number(p?.best_value?.odds ?? 2.0)
        const ev = Number(p?.value_score ?? p?.best_value?.ev ?? 0)
        const label: string = p?.best_value?.label ?? p?.recommended_bet ?? 'Top pick'
        const market = deriveBetType(label)
        if (ev > 0) positiveEvPicks++
        marketCounter[market] = (marketCounter[market] ?? 0) + 1
        // For sizing: only positive-EV picks get a real Kelly stake. Out-of-range
        // is ok (we still show them), but a 0-EV pick gets no recommended stake.
        const rec = recommendStake(ctx, odds, ev > 0 ? ev : 0)
        return {
          home: String(p?.home_team ?? ''),
          away: String(p?.away_team ?? ''),
          league: String(p?.league ?? ''),
          market,
          selection: label,
          odds: Math.round(odds * 100) / 100,
          stake: rec.suggestedStake > 0 ? rec.suggestedStake : 0,
          ev: Math.round(ev * 10) / 10,
          fixtureId: p?.id ? Number(p.id) : null,
          reasoning:
            (typeof p?.edge_explanation === 'string' && p.edge_explanation) ||
            `${label} — top value pick (+${ev}% EV).`,
          kickoff: String(p?.date ?? ''),
          tierMatch: (p?.__tierMatch as 'in-range' | 'out-of-range') ?? 'in-range',
        }
      })

      // ACCA bundle — only if the user qualifies AND there are 2+ in-range
      // singles with positive EV to combine.
      if (wantsAcca) {
        const accaCandidates = suggestedBets.filter(
          (b) => b.tierMatch === 'in-range' && b.ev > 0 && b.stake > 0,
        )
        const acca = buildAcca(accaCandidates, ctx)
        if (acca) suggestedBets.unshift(acca)
      }

      // Fixtures-pending heuristic: this day is beyond the latest known fixture
      // AND the day produced zero picks AND it's >= 7 days out.
      const fixturesPending =
        suggestedBets.length === 0 &&
        i >= 7 &&
        latestFixtureMs > 0 &&
        dStartMs > latestFixtureMs

      dayBuckets.push({
        date: d.toISOString(),
        isoDate: isoDate(d),
        label: dayLabel(d, today, tomorrow),
        targetBankroll,
        picks: suggestedBets,
        isToday: i === 0,
        fixturesPending,
      })
    }

    // Generate AI notes (one batch call covers the whole horizon)
    const notes = await generateDailyNotes(
      ctx,
      dayBuckets.map((d) => ({
        label: d.label,
        picks: d.picks,
        targetBankroll: d.targetBankroll,
        isToday: d.isToday,
        fixturesPending: d.fixturesPending,
      })),
      riskLevel,
    )

    const plan: DayPlan[] = dayBuckets.map((d, i) => ({
      date: d.date,
      label: d.label,
      targetBankroll: d.targetBankroll,
      suggestedBets: d.picks,
      note:
        notes[i] ??
        defaultNote(d.picks, d.label, goal.onTrack, d.fixturesPending, riskLevel),
      fixturesPending: d.fixturesPending,
    }))

    // Top-3 markets as percentages
    const totalMarkets = Object.values(marketCounter).reduce((a, b) => a + b, 0)
    const topMarkets =
      totalMarkets > 0
        ? Object.entries(marketCounter)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([market, count]) => ({
              market,
              pct: Math.round((count / totalMarkets) * 100),
            }))
        : []

    const summary: PlanSummary = {
      totalPicksScanned,
      positiveEvPicks,
      topMarkets,
      daysCovered: PLAN_HORIZON_DAYS,
      daysWithPicks: dayBuckets.filter((d) => d.picks.length > 0).length,
    }

    const payload: ApiResponse = {
      plan,
      goal: {
        target: goal.target,
        daysLeft: goal.daysLeft,
        onTrack: goal.onTrack,
        requiredDailyGrowthPct: goal.requiredDailyGrowthPct,
      },
      bankroll: bankrollNow,
      summary,
    }

    CACHE.set(user.id, { at: Date.now(), data: payload })
    return NextResponse.json(payload)
  } catch (err: any) {
    console.error('[daily-plan] unexpected error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Failed to build daily plan' },
      { status: 500 },
    )
  }
}
