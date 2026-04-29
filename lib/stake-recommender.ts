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
const STAKE_CAP_PCT = 0.05 // never recommend more than 5% of bankroll regardless

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

  // Behind on goal — slightly more aggressive (still capped).
  if (ctx.goal && !ctx.goal.onTrack) {
    multiplier = Math.min(0.75, multiplier * 1.25)
    reasoningBits.push("you're behind on your goal — sizing slightly larger")
    warning = 'behind_goal'
  }

  // Loss streak — slightly more conservative.
  if (ctx.recentLossStreak >= 3) {
    multiplier = multiplier * 0.75
    reasoningBits.push(`${ctx.recentLossStreak} losses in a row — sizing down to protect the roll`)
    warning = 'loss_streak'
  }

  const fraction = kelly * multiplier
  const cappedPct = Math.min(fraction, STAKE_CAP_PCT)
  const rawStake = bankroll * cappedPct
  const stake = roundStake(rawStake)
  const unitsPct = bankroll > 0 ? Math.round((stake / bankroll) * 1000) / 10 : 0
  const riskLabel = ctx.goal?.riskLevel ?? 'balanced'

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
