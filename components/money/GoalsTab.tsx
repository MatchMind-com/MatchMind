'use client'

import { useEffect, useState } from 'react'
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
 * On top we surface a small editorial CTA pointing the user at the AI Daily
 * Plan tab — only when they actually have an active goal.
 */

interface Props {
  currency: Currency
  /** Switches the parent MoneyClient to the Daily Plan tab. */
  onViewDailyPlan?: () => void
}

export default function GoalsTab({
  currency: _currency,
  onViewDailyPlan,
}: Props) {
  // We only show the "View daily plan" CTA when the user has an active goal —
  // otherwise the daily-plan tab is just an empty-state pointer back here.
  const [hasActiveGoal, setHasActiveGoal] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dream-bet')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d?.goal) setHasActiveGoal(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="space-y-5">
      {hasActiveGoal && onViewDailyPlan && (
        <div className="bg-bg-surface border border-brand/30 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow text-brand mb-1">AI DAILY PLAN</p>
            <p className="text-fg text-sm">
              Get a 7-day rolling betting plan sized to your bankroll.
            </p>
          </div>
          <button
            type="button"
            onClick={onViewDailyPlan}
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-bg-base font-bold py-2.5 px-4 text-sm transition-colors whitespace-nowrap"
          >
            View daily plan
            <span aria-hidden>→</span>
          </button>
        </div>
      )}

      <GoalTracker />
    </section>
  )
}
