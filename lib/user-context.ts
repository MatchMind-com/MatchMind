/**
 * Unified user-context helper — the "shared brain" for every AI on MatchMind.
 *
 * Every AI feature (Coach, Live Co-Pilot, Pre-Bet Pause, etc.) calls
 * `getUserContext(userId)` to know the user's bankroll, money goal, recent
 * bets, loss streak, and relevant memories — so stake recommendations and
 * tone are consistent across the whole product.
 *
 * Everything is best-effort and wrapped in try/catch — never fails the AI
 * response. Uses the SERVICE ROLE key (server-only).
 */
import { createClient as createAdmin, type SupabaseClient } from '@supabase/supabase-js'
import { retrieveMemories } from './memory-lane'

export type UserContext = {
  userId: string
  bankroll: {
    current: number
    starting: number
    profitLoss: number
    profitPct: number
    unitSize: number // 1% of current bankroll
  } | null
  goal: {
    startingBankroll: number
    target: number
    currentBankroll: number
    endDate: string
    daysLeft: number
    riskLevel: 'conservative' | 'balanced' | 'aggressive'
    progressPct: number
    onTrack: boolean
    requiredDailyGrowthPct: number
    kellyMultiplier: number // 0.25 / 0.5 / 0.75
  } | null
  recentBets: Array<{
    homeTeam: string
    awayTeam: string
    betType: string
    odds: number
    result: 'win' | 'loss' | 'pending' | null
    date: string
  }>
  recentLossStreak: number
  memories: Array<{ content: string; role: string; date: string }>
}

const RISK_FRACTION: Record<'conservative' | 'balanced' | 'aggressive', number> = {
  conservative: 0.25,
  balanced: 0.5,
  aggressive: 0.75,
}

function getAdmin(): SupabaseClient | null {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return null
    return createAdmin(url, key, { auth: { persistSession: false } })
  } catch {
    return null
  }
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000))
}

function emptyContext(userId: string): UserContext {
  return {
    userId,
    bankroll: null,
    goal: null,
    recentBets: [],
    recentLossStreak: 0,
    memories: [],
  }
}

/**
 * Returns full per-user context for AI prompts. If `memoryQuery` is provided,
 * the most semantically relevant memories are retrieved; otherwise newest 5.
 */
export async function getUserContext(
  userId: string,
  memoryQuery?: string,
): Promise<UserContext> {
  const supa = getAdmin()
  if (!supa || !userId) return emptyContext(userId)

  const ctx = emptyContext(userId)

  // Pull everything in parallel — each piece is independently try/catched.
  const [bankrollRes, goalRes, betsRes, memoryRes] = await Promise.allSettled([
    (async () => {
      const [{ data: snapshots }, { data: profile }] = await Promise.all([
        supa
          .from('bankroll_snapshots')
          .select('balance, recorded_at')
          .eq('user_id', userId)
          .order('recorded_at', { ascending: true }),
        supa
          .from('profiles')
          .select('starting_bankroll')
          .eq('user_id', userId)
          .single(),
      ])
      const starting = Number(profile?.starting_bankroll ?? 0)
      if (!starting && (!snapshots || snapshots.length === 0)) return null
      const current =
        snapshots && snapshots.length > 0
          ? Number(snapshots[snapshots.length - 1].balance)
          : starting
      const pl = current - starting
      const pct = starting > 0 ? (pl / starting) * 100 : 0
      return {
        current: Math.round(current * 100) / 100,
        starting: Math.round(starting * 100) / 100,
        profitLoss: Math.round(pl * 100) / 100,
        profitPct: Math.round(pct * 10) / 10,
        unitSize: Math.round(current * 0.01 * 100) / 100,
      }
    })(),
    (async () => {
      const { data } = await supa
        .from('dream_bet_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!data) return null
      const today = new Date()
      const end = new Date(data.end_date)
      const created = new Date(data.created_at)
      const daysLeft = daysBetween(today, end)
      const totalDays = Math.max(1, daysBetween(created, end))
      const elapsed = Math.max(0, totalDays - daysLeft)
      const remainingMultiple =
        data.current_bankroll > 0 ? data.target / data.current_bankroll : 0
      const requiredDailyGrowthPct =
        daysLeft > 0 && remainingMultiple > 0
          ? (Math.pow(remainingMultiple, 1 / daysLeft) - 1) * 100
          : 0
      const progressPct =
        data.target > data.starting_bankroll
          ? Math.max(
              0,
              Math.min(
                100,
                ((data.current_bankroll - data.starting_bankroll) /
                  (data.target - data.starting_bankroll)) *
                  100,
              ),
            )
          : 0
      const expected =
        data.starting_bankroll +
        ((data.target - data.starting_bankroll) * elapsed) / totalDays
      const onTrack = data.current_bankroll >= expected
      const risk = (data.risk_level as 'conservative' | 'balanced' | 'aggressive') ?? 'balanced'
      return {
        startingBankroll: Number(data.starting_bankroll),
        target: Number(data.target),
        currentBankroll: Number(data.current_bankroll),
        endDate: data.end_date,
        daysLeft,
        riskLevel: risk,
        progressPct: Math.round(progressPct * 10) / 10,
        onTrack,
        requiredDailyGrowthPct: Math.round(requiredDailyGrowthPct * 100) / 100,
        kellyMultiplier: RISK_FRACTION[risk] ?? 0.5,
      }
    })(),
    (async () => {
      // Pull from bet_slips — that's the user's actual bet history.
      // (prediction_records is site-wide AI picks, not per-user.)
      const { data } = await supa
        .from('bet_slips')
        .select('home_team, away_team, match_name, bet_type, odds, result, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
      return (data ?? []).map((b: any) => {
        let home = b.home_team ?? ''
        let away = b.away_team ?? ''
        if ((!home || !away) && typeof b.match_name === 'string') {
          const parts = b.match_name.split(/\s+vs\s+/i)
          if (parts.length === 2) {
            home = home || parts[0].trim()
            away = away || parts[1].trim()
          }
        }
        return {
          homeTeam: home,
          awayTeam: away,
          betType: b.bet_type ?? 'unknown',
          odds: Number(b.odds) || 0,
          result: (b.result as any) ?? null,
          date: b.created_at,
        }
      })
    })(),
    (async () => {
      if (memoryQuery) {
        const mems = await retrieveMemories(supa, userId, memoryQuery, 5)
        return mems.map((m) => ({
          content: m.content,
          role: m.role,
          date: m.created_at,
        }))
      }
      const { data } = await supa
        .from('user_memories')
        .select('content, role, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
      return (data ?? []).map((m: any) => ({
        content: m.content,
        role: m.role,
        date: m.created_at,
      }))
    })(),
  ])

  if (bankrollRes.status === 'fulfilled' && bankrollRes.value) ctx.bankroll = bankrollRes.value
  if (goalRes.status === 'fulfilled' && goalRes.value) ctx.goal = goalRes.value
  if (betsRes.status === 'fulfilled' && Array.isArray(betsRes.value)) ctx.recentBets = betsRes.value
  if (memoryRes.status === 'fulfilled' && Array.isArray(memoryRes.value)) ctx.memories = memoryRes.value

  // Loss streak — consecutive losses (most-recent-first walk) within last 7 days.
  const sevenDaysAgo = Date.now() - 7 * 86_400_000
  let streak = 0
  for (const b of ctx.recentBets) {
    if (b.result !== 'loss') break
    if (new Date(b.date).getTime() < sevenDaysAgo) break
    streak++
  }
  ctx.recentLossStreak = streak

  return ctx
}

/**
 * Render a UserContext as a compact human-readable block, suitable for
 * dropping straight into a GPT system prompt. Returns '' when there's
 * essentially nothing useful to say.
 */
export function renderContextBlock(ctx: UserContext): string {
  const lines: string[] = []
  if (ctx.bankroll) {
    const b = ctx.bankroll
    lines.push(
      `- Bankroll: £${b.current} (started £${b.starting}, ${b.profitLoss >= 0 ? '+' : ''}£${b.profitLoss} / ${b.profitPct >= 0 ? '+' : ''}${b.profitPct}%). 1 unit = £${b.unitSize}.`,
    )
  } else {
    lines.push('- Bankroll: not set yet (encourage user to set one for sizing recommendations).')
  }
  if (ctx.goal) {
    const g = ctx.goal
    lines.push(
      `- Goal: turn £${g.startingBankroll} → £${g.target} by ${g.endDate} (${g.daysLeft} days left, ${g.progressPct}% there, ${g.onTrack ? 'ON-TRACK' : 'BEHIND PACE'}).`,
    )
    lines.push(
      `- Risk profile: ${g.riskLevel} (Kelly multiplier ${g.kellyMultiplier}). Required daily growth to hit goal: ${g.requiredDailyGrowthPct}%.`,
    )
  } else {
    lines.push('- Money goal: not set yet.')
  }
  if (ctx.recentBets.length) {
    const formatted = ctx.recentBets
      .map((b) => {
        const match = b.homeTeam && b.awayTeam ? `${b.homeTeam} v ${b.awayTeam}` : 'match'
        return `${match} ${b.betType} @ ${b.odds} (${b.result ?? 'pending'})`
      })
      .join('; ')
    lines.push(`- Recent bets: ${formatted}.`)
  }
  if (ctx.recentLossStreak >= 2) {
    lines.push(`- WARNING: user is on a ${ctx.recentLossStreak}-bet losing streak. Suggest sizing down and avoid chase-bet language.`)
  }
  if (lines.length === 0) return ''
  return `=== USER FINANCIAL CONTEXT ===\n${lines.join('\n')}\nWhen discussing bets, recommend stakes appropriate to this bankroll and goal. Never suggest a stake that would risk more than 5% of bankroll.`
}
