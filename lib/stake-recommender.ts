/**
 * Stake recommender — translates a (bankroll + goal + recent form) context
 * plus an opportunity (odds + edge) into a concrete recommended stake.
 *
 * Uses fractional Kelly with the user's risk-profile multiplier, then
 * adjusts up/down based on goal pacing and recent loss streak.
 */
import type { UserContext } from './user-context'

export type StakeRecommendation = {
  suggestedStake: number
  unitsOfBankroll: number // suggestedStake as % of current bankroll
  kellyFraction: number // 0..1 — fraction of full Kelly being used
  reasoning: string
  warning?: string
}

const KELLY_CAP = 0.25 // never recommend more than 25% raw Kelly (sanity)

// Hard cap on stake as % of bankroll, varies by risk profile.
// Aggressive users with big goals need bigger swings; conservative users need protection.
const STAKE_CAP_BY_RISK: Record<string, number> = {
  conservative: 0.03, // max 3% per bet
  balanced: 0.06,     // max 6% per bet
  aggressive: 0.12,   // max 12% per bet — meaningful swings for ambitious goals
}

function roundStake(amount: number): number {
  if (amount <= 0) return 0
  if (amount < 20) return Math.round(amount * 2) / 2 // nearest £0.50
  return Math.round(amount) // nearest £1
}

export function recommendStake(
  ctx: UserContext,
  odds: number,
  edgePct: number,
): StakeRecommendation {
  if (!ctx.bankroll || ctx.bankroll.current <= 0) {
    return {
      suggestedStake: 0,
      unitsOfBankroll: 0,
      kellyFraction: 0,
      reasoning: 'No bankroll on file — set one in the Bankroll page so I can size bets for you.',
      warning: 'no_bankroll',
    }
  }

  if (odds <= 1 || !isFinite(odds)) {
    return {
      suggestedStake: 0,
      unitsOfBankroll: 0,
      kellyFraction: 0,
      reasoning: 'Invalid odds — cannot size a stake.',
      warning: 'invalid_odds',
    }
  }

  const bankroll = ctx.bankroll.current

  // Standard Kelly using edge directly: f = edge / (odds - 1).
  // edgePct is e.g. 5 → 0.05 EV; the simplified form below is conservative.
  let kelly = edgePct > 0 ? edgePct / 100 / (odds - 1) : 0
  if (kelly <= 0) {
    return {
      suggestedStake: 0,
      unitsOfBankroll: 0,
      kellyFraction: 0,
      reasoning: 'No mathematical edge — Kelly says skip.',
      warning: 'no_edge',
    }
  }
  kelly = Math.min(kelly, KELLY_CAP)

  // Apply user's risk multiplier (default half-Kelly).
  let multiplier = ctx.goal?.kellyMultiplier ?? 0.5
  let warning: string | undefined
  const reasoningBits: string[] = []

  // Behind on goal — more aggressive (cap depends on risk level)
  if (ctx.goal && !ctx.goal.onTrack) {
    const maxMult = ctx.goal.riskLevel === 'aggressive' ? 1.5 : 1.0
    multiplier = Math.min(maxMult, multiplier * 1.4)
    reasoningBits.push("you're behind on your goal — sizing larger to catch up")
    warning = 'behind_goal'
  }

  // Loss streak — more conservative.
  if (ctx.recentLossStreak >= 3) {
    multiplier = multiplier * 0.75
    reasoningBits.push(`${ctx.recentLossStreak} losses in a row — sizing down to protect the roll`)
    warning = 'loss_streak'
  }

  const riskLabel = ctx.goal?.riskLevel ?? 'balanced'
  const stakeCapPct = STAKE_CAP_BY_RISK[riskLabel] ?? 0.06

  const fraction = kelly * multiplier
  const cappedPct = Math.min(fraction, stakeCapPct)
  const rawStake = bankroll * cappedPct
  const stake = roundStake(rawStake)
  const unitsPct = bankroll > 0 ? Math.round((stake / bankroll) * 1000) / 10 : 0

  const baseReason = `Based on +${edgePct}% edge at ${odds} odds and your ${riskLabel} risk profile, stake £${stake} (${unitsPct}% of bankroll).`
  const reasoning = reasoningBits.length
    ? `${baseReason} ${reasoningBits.join('; ')}.`
    : baseReason

  return {
    suggestedStake: stake,
    unitsOfBankroll: unitsPct,
    kellyFraction: Math.round(fraction * 1000) / 1000,
    reasoning,
    warning,
  }
}

/**
 * Render a stake recommendation as a one-liner the AI can quote verbatim.
 */
export function renderStakeHint(rec: StakeRecommendation): string {
  if (rec.suggestedStake <= 0) {
    return `[Stake guidance: ${rec.reasoning}]`
  }
  return `[Stake guidance for this bet — quote naturally if asked: £${rec.suggestedStake} (${rec.unitsOfBankroll}% of bankroll). Reasoning: ${rec.reasoning}]`
}
