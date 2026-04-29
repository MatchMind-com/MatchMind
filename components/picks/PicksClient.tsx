'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

import PicksHeader from './PicksHeader'
import LeagueFilterBar, { type LeagueChip } from './LeagueFilterBar'
import PickCard, { type PickPrediction } from './PickCard'
import LiveMatchCard, { type LiveMatch } from './LiveMatchCard'
import AccumulatorCard, { TIERS, collectAllBets, buildTierAcca } from './AccumulatorCard'

/**
 * Lazy-load LiveCoPilot — heavy client component, only loaded when the
 * Live tab is opened and the user hits "Watch with AI".
 */
const LiveCoPilot = dynamic(() => import('@/components/live-copilot'), { ssr: false })

/**
 * PicksClient — the brain of /dashboard/picks.
 *
 * Owns:
 * - Tab state (today / tomorrow / weekend / live / accumulators), URL-synced via ?tab=
 * - League filter state, URL-synced via ?leagues=name1,name2
 * - Predictions fetch (single call → filtered client-side per tab)
 * - Live matches fetch (only fired when Live tab is active or has been visited)
 *
 * Heavily client-side because the user toggles tabs/filters constantly and
 * round-tripping each click would feel sluggish.
 */

type TabKey = 'today' | 'tomorrow' | 'weekend' | 'live' | 'accumulators'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'Weekend' },
  { key: 'live', label: 'Live' },
  { key: 'accumulators', label: 'Accumulators' },
]

/* ── Date helpers ───────────────────────────────────────────────────── */

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

function isWeekend(d: Date, now: Date): boolean {
  // Fri (5) / Sat (6) / Sun (0) — and only the *next* upcoming weekend window
  // (today onward through Sunday). Avoids showing past Friday games on a Mon.
  const day = d.getDay()
  if (![0, 5, 6].includes(day)) return false
  // Within the coming 7 days
  const diffMs = startOfDay(d).getTime() - startOfDay(now).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDays >= 0 && diffDays <= 7
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function PicksClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Read URL state
  const initialTab = (searchParams.get('tab') as TabKey) || 'today'
  const initialLeagueParam = searchParams.get('leagues') ?? ''

  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? initialTab : 'today'
  )
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>(
    initialLeagueParam ? initialLeagueParam.split(',').filter(Boolean) : []
  )

  // Predictions
  const [predictions, setPredictions] = useState<PickPrediction[]>([])
  const [predLoading, setPredLoading] = useState(true)
  const [predError, setPredError] = useState<string | null>(null)

  // Live matches
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([])
  const [liveLoaded, setLiveLoaded] = useState(false)
  const [liveLoading, setLiveLoading] = useState(false)
  const [openLiveFixture, setOpenLiveFixture] = useState<LiveMatch | null>(null)

  // ── URL sync ──
  const writeUrl = useCallback(
    (nextTab: TabKey, nextLeagues: string[]) => {
      const params = new URLSearchParams()
      if (nextTab !== 'today') params.set('tab', nextTab)
      if (nextLeagues.length > 0) params.set('leagues', nextLeagues.join(','))
      const qs = params.toString()
      router.replace(qs ? `/dashboard/picks?${qs}` : '/dashboard/picks', { scroll: false })
    },
    [router]
  )

  function handleTabChange(next: TabKey) {
    setTab(next)
    writeUrl(next, selectedLeagues)
  }

  function handleLeagueToggle(leagueKey: string) {
    setSelectedLeagues((prev) => {
      const next = prev.includes(leagueKey)
        ? prev.filter((k) => k !== leagueKey)
        : [...prev, leagueKey]
      writeUrl(tab, next)
      return next
    })
  }

  function handleLeagueClear() {
    setSelectedLeagues([])
    writeUrl(tab, [])
  }

  // ── Fetch predictions once on mount ──
  useEffect(() => {
    let cancelled = false
    fetch('/api/predictions')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.success) {
          setPredictions((d.predictions ?? []) as PickPrediction[])
          setPredError(null)
        } else if (d.cache_miss) {
          setPredError('__cache_miss__')
        } else {
          setPredError(d.error || 'Failed to load picks')
        }
      })
      .catch(() => {
        if (!cancelled) setPredError('Failed to load picks')
      })
      .finally(() => {
        if (!cancelled) setPredLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── Fetch live matches when Live tab is first visited, then poll ──
  useEffect(() => {
    if (tab !== 'live') return
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function load() {
      setLiveLoading(true)
      try {
        const res = await fetch('/api/fixtures/live', { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled && res.ok) {
          setLiveMatches((data.matches ?? []) as LiveMatch[])
          setLiveLoaded(true)
        }
      } catch {
        // Surface as empty — never block the tab on a live failure.
      } finally {
        if (!cancelled) setLiveLoading(false)
      }
    }

    load()
    intervalId = setInterval(load, 60_000)
    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [tab])

  // ── Date-bucketed predictions ──
  const now = useMemo(() => new Date(), [])

  const todayPicks = useMemo(
    () => predictions.filter((p) => p.date && isSameDay(new Date(p.date), now)),
    [predictions, now]
  )
  const tomorrowPicks = useMemo(() => {
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    return predictions.filter((p) => p.date && isSameDay(new Date(p.date), tomorrow))
  }, [predictions, now])
  const weekendPicks = useMemo(
    () => predictions.filter((p) => p.date && isWeekend(new Date(p.date), now)),
    [predictions, now]
  )

  // ── League filter chips — derived from currently visible (date-filtered) tab data ──
  const tabBeforeLeagueFilter: PickPrediction[] = useMemo(() => {
    if (tab === 'today') return todayPicks
    if (tab === 'tomorrow') return tomorrowPicks
    if (tab === 'weekend') return weekendPicks
    if (tab === 'accumulators') return predictions
    return [] // live tab handles its own data + has its own filtering
  }, [tab, todayPicks, tomorrowPicks, weekendPicks, predictions])

  const leagueChips: LeagueChip[] = useMemo(() => {
    const counts = new Map<string, { flag?: string; n: number }>()
    for (const p of tabBeforeLeagueFilter) {
      const cur = counts.get(p.league)
      if (cur) cur.n += 1
      else counts.set(p.league, { flag: p.leagueFlag, n: 1 })
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1].n - a[1].n)
      .map(([key, v]) => ({ key, label: key, flag: v.flag, count: v.n }))
  }, [tabBeforeLeagueFilter])

  const filteredTabPicks: PickPrediction[] = useMemo(() => {
    if (selectedLeagues.length === 0) return tabBeforeLeagueFilter
    const set = new Set(selectedLeagues)
    return tabBeforeLeagueFilter.filter((p) => set.has(p.league))
  }, [tabBeforeLeagueFilter, selectedLeagues])

  // ── Live tab — also support league filter ──
  const filteredLiveMatches: LiveMatch[] = useMemo(() => {
    if (selectedLeagues.length === 0) return liveMatches
    const set = new Set(selectedLeagues)
    return liveMatches.filter((m) => set.has(m.league.name))
  }, [liveMatches, selectedLeagues])

  // ── Header summary numbers ──
  const topLeagueLabels = useMemo(
    () =>
      Array.from(new Set(todayPicks.map((p) => p.league)))
        .slice(0, 3)
        .map((name) => {
          // Compress common long names for the headline
          if (name === 'UEFA Champions League') return 'UCL'
          if (name === 'UEFA Europa League') return 'UEL'
          if (name === 'UEFA Europa Conference League') return 'Conference'
          return name
        }),
    [todayPicks]
  )

  return (
    <main className="max-w-5xl mx-auto px-5 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">
      {/* Header */}
      <PicksHeader
        liveCount={liveMatches.length}
        todayPicksCount={todayPicks.length}
        todayLeagueCount={new Set(todayPicks.map((p) => p.league)).size}
        topLeagueLabels={topLeagueLabels}
      />

      {/* League filter */}
      {leagueChips.length > 0 && (
        <LeagueFilterBar
          leagues={leagueChips}
          selected={selectedLeagues}
          onToggle={handleLeagueToggle}
          onClear={handleLeagueClear}
        />
      )}

      {/* Tab bar — editorial pill row */}
      <nav
        className="-mx-5 lg:mx-0 px-5 lg:px-0 overflow-x-auto scrollbar-hide border-b border-border-subtle"
        aria-label="Picks tabs"
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
                {/* Editorial active marker — 3px brand-orange bottom border */}
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

      {/* ── Body switch ── */}
      {tab !== 'live' && tab !== 'accumulators' && (
        <PicksGrid
          loading={predLoading}
          error={predError}
          picks={filteredTabPicks}
          tab={tab}
        />
      )}

      {tab === 'live' && (
        <LiveTab
          loading={liveLoading && !liveLoaded}
          matches={filteredLiveMatches}
          upcomingFallback={[...todayPicks, ...tomorrowPicks].slice(0, 3)}
          onWatchWithAI={(m) => setOpenLiveFixture(m)}
        />
      )}

      {tab === 'accumulators' && (
        <AccumulatorsTab
          loading={predLoading}
          error={predError}
          predictions={filteredTabPicks}
        />
      )}

      {/* Live Co-Pilot drawer */}
      {openLiveFixture && (
        <LiveCoPilot
          fixtureId={openLiveFixture.id}
          open={!!openLiveFixture}
          onClose={() => setOpenLiveFixture(null)}
          initialTeams={{
            home: openLiveFixture.home.name,
            away: openLiveFixture.away.name,
          }}
        />
      )}
    </main>
  )
}

/* ── Sub-views ──────────────────────────────────────────────────────── */

function PicksGrid({
  loading,
  error,
  picks,
  tab,
}: {
  loading: boolean
  error: string | null
  picks: PickPrediction[]
  tab: TabKey
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-bg-surface border border-border-subtle rounded-2xl h-48 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (error === '__cache_miss__') {
    return (
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 text-center space-y-2">
        <p className="text-fg font-semibold">Picks are warming up</p>
        <p className="text-fg-secondary text-sm">
          The AI is analysing today&apos;s fixtures right now. This only happens once a day —
          check back in a few minutes.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 text-center">
        <p className="text-fg-secondary text-sm">{error}</p>
      </div>
    )
  }

  if (picks.length === 0) {
    const message =
      tab === 'today'
        ? 'No picks for today yet — try the Tomorrow tab or check back after the next AI refresh (4am UTC).'
        : tab === 'tomorrow'
        ? 'No picks for tomorrow yet — try Weekend or check back later today.'
        : 'No fixtures in this window yet. Check back when the schedule fills out.'
    return (
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 text-center">
        <p className="text-fg-secondary text-sm">{message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {picks.map((p) => (
        <PickCard key={p.id} pred={p} />
      ))}
    </div>
  )
}

function LiveTab({
  loading,
  matches,
  upcomingFallback,
  onWatchWithAI,
}: {
  loading: boolean
  matches: LiveMatch[]
  upcomingFallback: PickPrediction[]
  onWatchWithAI: (m: LiveMatch) => void
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-bg-surface border border-border-subtle rounded-2xl h-44 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 space-y-4">
        <div className="text-center">
          <p className="text-fg font-semibold">No live matches right now</p>
          <p className="text-fg-secondary text-sm mt-1">Next up:</p>
        </div>
        {upcomingFallback.length === 0 ? (
          <p className="text-fg-muted text-xs text-center">
            No upcoming fixtures in the next two days.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcomingFallback.map((p) => {
              const t = p.date
                ? new Date(p.date).toLocaleString('en-GB', {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between text-sm bg-bg-elevated rounded-lg px-3 py-2 border border-border-subtle"
                >
                  <span className="text-fg-secondary truncate">
                    {p.home_team} <span className="text-fg-muted px-1">vs</span> {p.away_team}
                  </span>
                  <span className="font-stat text-fg-muted text-xs whitespace-nowrap">{t}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {matches.map((m) => (
        <LiveMatchCard key={m.id} match={m} onWatchWithAI={onWatchWithAI} />
      ))}
    </div>
  )
}

function AccumulatorsTab({
  loading,
  error,
  predictions,
}: {
  loading: boolean
  error: string | null
  predictions: PickPrediction[]
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-bg-surface border border-border-subtle rounded-2xl h-56 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (error === '__cache_miss__') {
    return (
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 text-center space-y-2">
        <p className="text-fg font-semibold">Accumulators warming up</p>
        <p className="text-fg-secondary text-sm">
          The AI is still analysing today&apos;s fixtures — accumulators will appear once
          the +EV picks are ready.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 text-center">
        <p className="text-fg-secondary text-sm">{error}</p>
      </div>
    )
  }

  const allBets = collectAllBets(predictions)

  return (
    <div className="space-y-4">
      {TIERS.map((tier) => {
        const legs = buildTierAcca(allBets, tier)
        return <AccumulatorCard key={tier.key} tier={tier} legs={legs} />
      })}
      <p className="text-fg-muted text-[10px] text-center pt-2">
        18+ · Gamble responsibly · begambleaware.org
      </p>
    </div>
  )
}
