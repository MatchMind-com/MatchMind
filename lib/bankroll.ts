/**
 * Shared bankroll math helpers.
 *
 * All functions are pure so they can run on server AND client without worry.
 * No React / DB / fetch in here — just numbers in, numbers out.
 */

export type Snapshot = {
  balance: number | string
  recorded_at: string
  note?: string | null
}

// ─── Kelly staking ────────────────────────────────────────────────────────────

/**
 * Kelly Criterion — mathematically optimal stake fraction.
 *
 *   f* = (b·p - q) / b
 *
 * where b = decimalOdds - 1, p = true win probability, q = 1 - p.
 *
 * We derive p from the +EV the AI reports:
 *   EV = p * decimalOdds - 1  →  p = (EV + 1) / decimalOdds
 *
 * Most pros use FRACTIONAL Kelly (0.25–0.5×) because full Kelly is emotionally
 * unbearable. Default here is half-Kelly. `fraction=1` for aggressive.
 *
 * Returns a stake amount in the same currency as bankroll. Never returns more
 * than 10% of bankroll regardless of Kelly's answer (sanity cap — full Kelly
 * on high-edge picks can demand insane stakes that amplify variance).
 */
export function kellyStake(
  bankroll: number,
  evPercent: number,
  decimalOdds: number,
  fraction = 0.5
): number {
  if (bankroll <= 0 || evPercent <= 0 || decimalOdds <= 1) return 0
  const p = (evPercent / 100 + 1) / decimalOdds
  if (p <= 0 || p >= 1) return 0
  const b = decimalOdds - 1
  const q = 1 - p
  const kellyFraction = (b * p - q) / b
  if (kellyFraction <= 0) return 0
  const scaled = kellyFraction * fraction
  const capped = Math.min(scaled, 0.10) // never more than 10% of bankroll
  return Math.round(bankroll * capped * 100) / 100
}

// ─── Snapshot stats ───────────────────────────────────────────────────────────

export type BankrollStats = {
  peak: number
  peakDate: string | null
  current: number
  currentDrawdownPct: number
  maxDrawdownPct: number
  growthPct: number
  startingBalance: number
}

export function computeStats(snapshots: Snapshot[], startingBankroll: number): BankrollStats {
  if (snapshots.length === 0) {
    return {
      peak: startingBankroll,
      peakDate: null,
      current: startingBankroll,
      currentDrawdownPct: 0,
      maxDrawdownPct: 0,
      growthPct: 0,
      startingBalance: startingBankroll,
    }
  }
  const sorted = [...snapshots].sort((a, b) =>
    new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  )
  let peak = Number(sorted[0].balance)
  let peakDate = sorted[0].recorded_at
  let maxDrawdown = 0
  let runningPeak = peak
  for (const s of sorted) {
    const bal = Number(s.balance)
    if (bal > runningPeak) runningPeak = bal
    if (bal > peak) { peak = bal; peakDate = s.recorded_at }
    const dd = runningPeak > 0 ? ((bal - runningPeak) / runningPeak) * 100 : 0
    if (dd < maxDrawdown) maxDrawdown = dd
  }
  const current = Number(sorted[sorted.length - 1].balance)
  const currentDrawdown = peak > 0 ? ((current - peak) / peak) * 100 : 0
  const starting = startingBankroll > 0 ? startingBankroll : Number(sorted[0].balance)
  const growth = starting > 0 ? ((current - starting) / starting) * 100 : 0
  return {
    peak: Math.round(peak * 100) / 100,
    peakDate,
    current: Math.round(current * 100) / 100,
    currentDrawdownPct: Math.round(currentDrawdown * 10) / 10,
    maxDrawdownPct: Math.round(maxDrawdown * 10) / 10,
    growthPct: Math.round(growth * 10) / 10,
    startingBalance: starting,
  }
}

// ─── Monthly P&L ──────────────────────────────────────────────────────────────

export type MonthlyPnL = { month: string; pnl: number; start: number; end: number }

export function monthlyPnL(snapshots: Snapshot[]): MonthlyPnL[] {
  if (snapshots.length === 0) return []
  const sorted = [...snapshots].sort((a, b) =>
    new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  )
  const byMonth = new Map<string, Snapshot[]>()
  for (const s of sorted) {
    const m = s.recorded_at.slice(0, 7) // YYYY-MM
    if (!byMonth.has(m)) byMonth.set(m, [])
    byMonth.get(m)!.push(s)
  }
  const out: MonthlyPnL[] = []
  let prevClose = Number(sorted[0].balance)
  for (const [month, items] of byMonth) {
    const endBal = Number(items[items.length - 1].balance)
    const startBal = prevClose
    out.push({
      month,
      pnl: Math.round((endBal - startBal) * 100) / 100,
      start: Math.round(startBal * 100) / 100,
      end: Math.round(endBal * 100) / 100,
    })
    prevClose = endBal
  }
  return out
}

// ─── Variance simulator (Monte Carlo) ─────────────────────────────────────────

export type SimParams = {
  bankroll: number
  avgEdgePct: number   // e.g. 8 for +8% EV
  avgOdds: number      // e.g. 2.0
  stakePct: number     // e.g. 2 for staking 2% of bankroll per bet
  betsPerWeek: number  // e.g. 10
  weeks: number        // e.g. 26 (half season)
}

export type SimResult = {
  runs: number
  finalBalances: number[]
  median: number
  p10: number   // 10th percentile (pessimistic)
  p90: number   // 90th percentile (optimistic)
  bustProb: number      // % of runs where bankroll hit 0
  doubleProb: number    // % of runs where bankroll doubled
  mean: number
}

/**
 * Run N simulated seasons with the given params. Each bet is a Bernoulli
 * trial with win probability implied by edge + odds.
 */
export function simulateVariance(params: SimParams, runs = 1000): SimResult {
  const { bankroll, avgEdgePct, avgOdds, stakePct, betsPerWeek, weeks } = params
  const totalBets = Math.round(betsPerWeek * weeks)
  const winProb = Math.min(0.95, Math.max(0.05, (avgEdgePct / 100 + 1) / avgOdds))
  const winPayoff = avgOdds - 1
  const startingBankroll = bankroll

  const finals: number[] = []
  let busts = 0
  let doubles = 0

  for (let r = 0; r < runs; r++) {
    let bal = startingBankroll
    let doubled = false
    for (let i = 0; i < totalBets; i++) {
      if (bal <= 0) break
      const stake = bal * (stakePct / 100)
      const won = Math.random() < winProb
      bal = won ? bal + stake * winPayoff : bal - stake
      if (bal >= startingBankroll * 2 && !doubled) doubled = true
    }
    if (bal <= 0) busts++
    if (doubled) doubles++
    finals.push(Math.max(0, bal))
  }
  finals.sort((a, b) => a - b)
  const p = (q: number) => finals[Math.min(finals.length - 1, Math.floor(runs * q))]
  return {
    runs,
    finalBalances: finals,
    median: Math.round(p(0.5) * 100) / 100,
    p10: Math.round(p(0.10) * 100) / 100,
    p90: Math.round(p(0.90) * 100) / 100,
    bustProb: Math.round((busts / runs) * 1000) / 10,
    doubleProb: Math.round((doubles / runs) * 1000) / 10,
    mean: Math.round((finals.reduce((s, v) => s + v, 0) / runs) * 100) / 100,
  }
}
