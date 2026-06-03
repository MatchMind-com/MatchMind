'use client'

import { useState } from 'react'
import MyLiveBets from '@/components/home/MyLiveBets'
import HistoryTab from './HistoryTab'
import StatsTab from './StatsTab'
import type { Currency } from './MoneyClient'

/**
 * MyBetsTab — combined "active bets" page on Money.
 *
 * Layout:
 *   - MyLiveBets at the top (the same component used on the Home page —
 *     active bets w/ live scores, "+ New bet" CTA, click-to-detail)
 *   - Sub-toggle below: HISTORY (default) / STATS
 *   - Whichever sub-view is selected renders below the toggle.
 *
 * This consolidates what used to be three separate top-level tabs
 * (My Bets, History, Stats) into one editorial page so the user lands
 * on what's happening NOW first, with deeper retrospection one click away.
 */

interface Props {
  currency: Currency
  initialLeague?: string | null
  initialBetType?: string | null
}

type SubView = 'history' | 'stats'

export default function MyBetsTab({ currency, initialLeague, initialBetType }: Props) {
  // Default to History — most users want to see "did I win?" first.
  // If we arrived from a Stats cross-link (league/bet_type filters in URL),
  // start on history with those filters applied.
  const [view, setView] = useState<SubView>('history')

  return (
    <div className="space-y-8">
      {/* TOP — live bets feed (same as Home page) */}
      <MyLiveBets />

      {/* SUB-TOGGLE — History / Stats */}
      <div className="border-t border-border-subtle pt-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <p className="eyebrow">Past performance</p>
          <nav
            role="tablist"
            aria-label="Past performance view"
            className="inline-flex bg-bg-elevated p-0.5"
          >
            {([
              { id: 'history', label: 'History' },
              { id: 'stats', label: 'Stats' },
            ] as Array<{ id: SubView; label: string }>).map((t) => {
              const active = view === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(t.id)}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    active
                      ? 'bg-brand text-white'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </nav>
        </div>

        {view === 'history' && (
          <HistoryTab
            currency={currency}
            initialLeague={initialLeague}
            initialBetType={initialBetType}
          />
        )}
        {view === 'stats' && <StatsTab currency={currency} />}
      </div>
    </div>
  )
}
