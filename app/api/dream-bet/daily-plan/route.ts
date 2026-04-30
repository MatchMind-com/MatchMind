/**
 * GET /api/dream-bet/daily-plan
 *
 * Returns a 7-day rolling betting plan for the user's active Dream Bet goal.
 * For each of the next 7 days the AI picks 1-3 of the highest-EV upcoming
 * predictions that match the user's risk profile, sizes each stake using the
 * shared `recommendStake` helper, computes the bankroll target the user should
 * hit by EOD, and asks GPT-4o-mini for a one-line note (encouraging, honest,
 * suggests rest days when no value).
 *
 * If the user has no active goal we return a 200 with a friendly message — the
 * UI surfaces an editorial CTA in that case.
 *
 * Cache: per-user 1 hour (in-memory). Plenty for the editorial tab; the heavy
 * lift is the OpenAI call for 7 daily notes.
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
}

type DayPlan = {
  date: string
  label: string
  targetBankroll: number
  suggestedBets: SuggestedBet[]
  note: string
}

type GoalSummary = {
  target: number
  daysLeft: number
  onTrack: boolean
  requiredDailyGrowthPct: number
}

type ApiResponse =
  | {
      plan: DayPlan[]
      goal: GoalSummary
      bankroll: number
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

function picksForDay(
  predictions: any[],
  dayStart: Date,
  riskLevel: RiskLevel,
  maxPicks: number,
): any[] {
  const dayEnd = addDays(dayStart, 1)
  const dayStartMs = dayStart.getTime()
  const dayEndMs = dayEnd.getTime()
  const [oddsMin, oddsMax] = RISK_ODDS_RANGE[riskLevel]

  const candidates = predictions.filter((p) => {
    if (!p?.date) return false
    const t = new Date(p.date).getTime()
    if (Number.isNaN(t)) return false
    if (t < dayStartMs || t >= dayEndMs) return false
    const odds = p?.best_value?.odds ?? null
    const ev = p?.value_score ?? p?.best_value?.ev ?? null
    if (odds == null || ev == null) return false
    if (odds < oddsMin || odds > oddsMax) return false
    if (ev <= 0) return false
    return true
  })

  // Highest EV first; stable de-dupe on fixture id.
  const seen = new Set<number>()
  const sorted = candidates.sort((a, b) => {
    const evA = a?.value_score ?? a?.best_value?.ev ?? 0
    const evB = b?.value_score ?? b?.best_value?.ev ?? 0
    return evB - evA
  })
  const out: any[] = []
  for (const p of sorted) {
    const id = Number(p?.id)
    if (id && seen.has(id)) continue
    if (id) seen.add(id)
    out.push(p)
    if (out.length >= maxPicks) break
  }
  return out
}

function maxPicksFor(risk: RiskLevel): number {
  if (risk === 'aggressive') return 3
  if (risk === 'conservative') return 1
  return 2
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

function defaultNote(picks: SuggestedBet[], dayLabelStr: string, isOnTrack: boolean): string {
  if (picks.length === 0) {
    return 'Rest day — no +EV picks worth taking. Patience is a position. Save the variance.'
  }
  if (!isOnTrack) {
    return `${picks.length} qualifying ${picks.length === 1 ? 'bet' : 'bets'} — bigger sizing today to claw back the gap, but stick to the math.`
  }
  return `${picks.length} qualifying ${picks.length === 1 ? 'bet' : 'bets'} for ${dayLabelStr.toLowerCase()} — keep the discipline.`
}

async function generateDailyNotes(
  ctx: UserContext,
  days: Array<{ label: string; picks: SuggestedBet[]; targetBankroll: number; isToday: boolean }>,
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    return days.map((d) => defaultNote(d.picks, d.label, ctx.goal?.onTrack ?? true))
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const goal = ctx.goal
    const summary = days
      .map((d, i) => {
        const picks = d.picks
          .map((b) => `${b.selection} @${b.odds} (+${b.ev}% EV, £${b.stake})`)
          .join('; ')
        return `Day ${i + 1} (${d.label}, target £${d.targetBankroll}): ${picks || 'no qualifying picks'}`
      })
      .join('\n')
    const prompt = `You are a friendly, honest betting coach. The user's goal:
- Bankroll: £${ctx.bankroll?.current ?? 0}
- Target: £${goal?.target ?? 0} by ${goal?.endDate ?? 'soon'}
- Days left: ${goal?.daysLeft ?? 0}
- ${goal?.onTrack ? 'On track' : 'Behind pace'}
- Risk: ${goal?.riskLevel ?? 'balanced'}

Here is the 7-day plan:
${summary}

For EACH day, write ONE short note (≤22 words). Honest, not hype. No emojis. If a day has no picks, frame it as a deliberate rest day. Reply as a JSON object: { "notes": ["day 1 note", "day 2 note", ... 7 notes total] }.`

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    })
    const raw = resp.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as { notes?: unknown }
    if (Array.isArray(parsed.notes) && parsed.notes.length === days.length) {
      return parsed.notes.map((n, i) =>
        typeof n === 'string' && n.trim()
          ? n.trim()
          : defaultNote(days[i].picks, days[i].label, ctx.goal?.onTrack ?? true),
      )
    }
  } catch (err) {
    console.error('[daily-plan] OpenAI note generation failed:', err)
  }
  return days.map((d) => defaultNote(d.picks, d.label, ctx.goal?.onTrack ?? true))
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

    // Pull all upcoming predictions across the next 7 days from the cache table.
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

    // Build the 7-day plan
    const dayBuckets: Array<{
      date: string
      label: string
      isoDate: string
      targetBankroll: number
      picks: SuggestedBet[]
      isToday: boolean
    }> = []

    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i)
      const dayPicks = picksForDay(predictions, d, riskLevel, maxPicksFor(riskLevel))
      const targetBankroll = compoundTargetFor(
        bankrollNow,
        i + 1,
        goal.requiredDailyGrowthPct || 0,
      )

      const suggestedBets: SuggestedBet[] = dayPicks.map((p) => {
        const odds = Number(p?.best_value?.odds ?? 2.0)
        const ev = Number(p?.value_score ?? p?.best_value?.ev ?? 0)
        const label: string = p?.best_value?.label ?? p?.recommended_bet ?? 'Top pick'
        const rec = recommendStake(ctx, odds, ev)
        return {
          home: String(p?.home_team ?? ''),
          away: String(p?.away_team ?? ''),
          league: String(p?.league ?? ''),
          market: deriveBetType(label),
          selection: label,
          odds: Math.round(odds * 100) / 100,
          stake: rec.suggestedStake > 0 ? rec.suggestedStake : 0,
          ev: Math.round(ev * 10) / 10,
          fixtureId: p?.id ? Number(p.id) : null,
          reasoning:
            (typeof p?.edge_explanation === 'string' && p.edge_explanation) ||
            `${label} — top value pick (+${ev}% EV).`,
          kickoff: String(p?.date ?? ''),
        }
      })

      dayBuckets.push({
        date: d.toISOString(),
        isoDate: isoDate(d),
        label: dayLabel(d, today, tomorrow),
        targetBankroll,
        picks: suggestedBets,
        isToday: i === 0,
      })
    }

    // Generate AI notes (one batch call, 7 short notes)
    const notes = await generateDailyNotes(
      ctx,
      dayBuckets.map((d) => ({
        label: d.label,
        picks: d.picks,
        targetBankroll: d.targetBankroll,
        isToday: d.isToday,
      })),
    )

    const plan: DayPlan[] = dayBuckets.map((d, i) => ({
      date: d.date,
      label: d.label,
      targetBankroll: d.targetBankroll,
      suggestedBets: d.picks,
      note: notes[i] ?? defaultNote(d.picks, d.label, goal.onTrack),
    }))

    const payload: ApiResponse = {
      plan,
      goal: {
        target: goal.target,
        daysLeft: goal.daysLeft,
        onTrack: goal.onTrack,
        requiredDailyGrowthPct: goal.requiredDailyGrowthPct,
      },
      bankroll: bankrollNow,
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
