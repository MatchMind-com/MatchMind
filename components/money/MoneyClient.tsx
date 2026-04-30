'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import MoneyHeader from './MoneyHeader'
import BankrollTab from './BankrollTab'
import GoalsTab from './GoalsTab'
import HistoryTab from './HistoryTab'
import StatsTab from './StatsTab'
import MyLiveBets from '@/components/home/MyLiveBets'

/**
 * MoneyClient — orchestrator for /dashboard/money.
 *
 * Owns:
 *  - URL-synced tab state via ?tab=
 *  - Shared bankroll snapshots (so the header summary line can show
 *    growth % without each tab re-fetching).
 *  - Currency preference (browser-saved, currently informational —
 *    Stripe-side amounts live in £ today).
 *
 * The four tabs are independent and self-fetch their own additional
 * data (goals, track-record). We pass the shared snapshots+starting
 * bankroll down so the BankrollTab doesn't duplicate the request.
 */

type TabKey = 'bankroll' | 'goals' | 'mybets' | 'history' | 'stats'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'bankroll', label: 'Bankroll' },
  { key: 'goals', label: 'Goals' },
  { key: 'mybets', label: 'My Bets' },
  { key: 'history', label: 'History' },
  { key: 'stats', label: 'Stats' },
]

// Back-compat: any old `?tab=dailyplan` link from the previous version
// silently routes to the new `mybets` tab so bookmarks don't 404 the
// user into Bankroll.
function normalizeTabParam(raw: string | null): TabKey | null {
  if (!raw) return null
  if (raw === 'dailyplan') return 'mybets'
  return TABS.some((t) => t.key === raw) ? (raw as TabKey) : null
}

interface Snapshot {
  id: string
  balance: number | string
  note: string | null
  recorded_at: string
}

interface Props {
  userId: string
  initialBankroll: number
  startingBankroll: number
  lossLimit?: number | null
}

export type Currency = '£' | '$' | '€'

const CURRENCY_KEY = 'mm_money_currency'

export default function MoneyClient({
  userId,
  initialBankroll,
  startingBankroll,
  lossLimit,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── URL-synced tab ─────────────────────────────────────────────────
  const initialTab = normalizeTabParam(searchParams.get('tab')) ?? 'bankroll'
  const [tab, setTab] = useState<TabKey>(initialTab)

  const writeTab = useCallback(
    (next: TabKey) => {
      const params = new URLSearchParams()
      if (next !== 'bankroll') params.set('tab', next)
      const qs = params.toString()
      router.replace(qs ? `/dashboard/money?${qs}` : '/dashboard/money', {
        scroll: false,
      })
    },
    [router]
  )

  function handleTabChange(next: TabKey) {
    setTab(next)
    writeTab(next)
  }

  // Cross-link filters: when Stats tab links to History with ?league=X or
  // ?bet_type=X, HistoryTab needs to know about it on mount. We pull them
  // off the URL and pass them down — HistoryTab consumes them as initial
  // filter state. We also keep a key bound to these so the component
  // re-mounts cleanly when navigating Stats → History.
  const initialLeague = searchParams.get('league') ?? null
  const initialBetType = searchParams.get('bet_type') ?? null
  const historyKey = `${initialLeague ?? ''}|${initialBetType ?? ''}`

  // ── Shared currency preference (browser-saved) ─────────────────────
  const [currency, setCurrency] = useState<Currency>('£')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const v = localStorage.getItem(CURRENCY_KEY) as Currency | null
    if (v === '£' || v === '$' || v === '€') setCurrency(v)
  }, [])
  function saveCurrency(next: Currency) {
    setCurrency(next)
    if (typeof window !== 'undefined') localStorage.setItem(CURRENCY_KEY, next)
  }

  // ── Shared bankroll snapshots — fetched once, reused by Bankroll tab + header ──
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false)
  const [currentBankroll, setCurrentBankroll] = useState(initialBankroll)

  const reloadSnapshots = useCallback(async () => {
    try {
      const res = await fetch('/api/bankroll', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as {
        snapshots: Snapshot[]
        starting_bankroll: number
        current_bankroll: number
      }
      setSnapshots(data.snapshots ?? [])
      setCurrentBankroll(Number(data.current_bankroll ?? initialBankroll))
    } catch {
      // Silent — fall back to SSR-bootstrapped values.
    } finally {
      setSnapshotsLoaded(true)
    }
  }, [initialBankroll])

  useEffect(() => {
    void reloadSnapshots()
  }, [reloadSnapshots])

  // ── Active goal count — fetched once for the header summary ──
  const [activeGoalCount, setActiveGoalCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    fetch('/api/dream-bet')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d?.goal) setActiveGoalCount(1)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // ── Header growth — derived from snapshots vs starting ──
  const growthPct = useMemo<number | null>(() => {
    if (!snapshotsLoaded || startingBankroll <= 0) return null
    const pnl = currentBankroll - startingBankroll
    return Math.round((pnl / startingBankroll) * 1000) / 10
  }, [snapshotsLoaded, currentBankroll, startingBankroll])

  return (
    <main className="max-w-5xl mx-auto px-5 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">
      <MoneyHeader
        currentBankroll={currentBankroll}
        currency={currency}
        growthPct={growthPct}
        activeGoalCount={activeGoalCount}
      />

      {/* Tab bar — editorial pill row, brand-orange active border (matches Picks) */}
      <nav
        className="-mx-5 lg:mx-0 px-5 lg:px-0 overflow-x-auto scrollbar-hide border-b border-border-subtle"
        aria-label="Money tabs"
      >
        <div className="flex items-stretch gap-1 min-w-max">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTabChange(t.key)}
                className={`relative px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-150 ${
                  active ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {t.label}
                <span
                  className={`absolute left-0 right-0 bottom-0 h-[3px] ${
                    active ? 'bg-brand' : 'bg-transparent'
                  }`}
                  aria-hidden
                />
              </button>
            )
          })}
        </div>
      </nav>

      {tab === 'bankroll' && (
        <BankrollTab
          userId={userId}
          snapshots={snapshots}
          snapshotsLoaded={snapshotsLoaded}
          startingBankroll={startingBankroll}
          currentBankroll={currentBankroll}
          lossLimit={lossLimit}
          currency={currency}
          onCurrencyChange={saveCurrency}
          onSnapshotsChange={reloadSnapshots}
        />
      )}
      {tab === 'goals' && (
        <GoalsTab
          currency={currency}
          onViewDailyPlan={() => handleTabChange('mybets')}
        />
      )}
      {tab === 'mybets' && (
        <div className="space-y-5">
          <MyLiveBets />
        </div>
      )}
      {tab === 'history' && (
        <HistoryTab
          key={historyKey}
          currency={currency}
          initialLeague={initialLeague}
          initialBetType={initialBetType}
        />
      )}
      {tab === 'stats' && <StatsTab currency={currency} />}
    </main>
  )
}
