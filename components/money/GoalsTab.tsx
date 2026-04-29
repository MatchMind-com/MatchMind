'use client'

import GoalTracker from '@/components/bankroll/GoalTracker'
import type { Currency } from './MoneyClient'

/**
 * GoalsTab — thin wrapper around the existing GoalTracker.
 *
 * The GoalTracker component already renders its own internal cards, so we
 * intentionally don't add another wrapping card here — that would create a
 * "card-in-a-card" feel. Instead we sit it in a transparent container so it
 * inherits the editorial spacing of the page while preserving its own
 * pre-existing layout.
 *
 * If we ever rebuild the goal-tracker UI to match the Athletic tokens, this
 * wrapper can be retired in favour of a full rewrite.
 */

interface Props {
  currency: Currency
}

export default function GoalsTab({ currency: _currency }: Props) {
  return (
    <section>
      <GoalTracker />
    </section>
  )
}
