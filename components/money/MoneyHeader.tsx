'use client'

/**
 * MoneyHeader — editorial top-of-page block for /dashboard/money.
 *
 * Mirrors PicksHeader's visual rhythm (eyebrow → headline-xl → secondary
 * stat line). The summary line is a tiny one-liner that surfaces the user's
 * current bankroll, this-month delta and active-goal count — the three
 * numbers a habitual user wants to see at a glance.
 *
 * Pure presentational: parent owns all state and recomputes the deltas.
 */

interface Props {
  /** Wallet (banked, free to stake) — current_bankroll minus locked stakes
   *  in pending bets. Drops when the user places a bet so the headline
   *  matches their mental model. The all-time growth % below is computed
   *  in the parent against the true total bankroll, not this. */
  currentBankroll: number
  /** Currency symbol — currently always £, kept as a prop so we can swap later. */
  currency?: string
  /** All-time growth % vs starting bankroll. */
  growthPct?: number | null
  /** Number of active dream-bet goals — 0 or 1 today; future-proofed. */
  activeGoalCount?: number
}

function fmtMoney(n: number, currency: string): string {
  return `${currency}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export default function MoneyHeader({
  currentBankroll,
  currency = '£',
  growthPct = null,
  activeGoalCount = 0,
}: Props) {
  const segments: string[] = [fmtMoney(currentBankroll, currency)]
  if (growthPct != null) {
    const sign = growthPct >= 0 ? '+' : ''
    segments.push(`${sign}${growthPct}% all-time`)
  }
  segments.push(
    `${activeGoalCount} ${activeGoalCount === 1 ? 'active goal' : 'active goals'}`
  )

  return (
    <header className="space-y-2">
      <p className="eyebrow">MONEY</p>
      <h1 className="headline-xl text-fg">
        Manage <span className="text-brand">the roll</span>
      </h1>
      <p className="text-fg-secondary text-sm md:text-base font-stat">
        {segments.join(' · ')}
      </p>
    </header>
  )
}
