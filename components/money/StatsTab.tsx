'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Currency } from './MoneyClient'

/**
 * StatsTab — aggregated performance view, sourced from /api/bet-slips so it
 * matches the user's actual logged history (the History tab uses the same
 * endpoint). Was previously /api/track-record (system-wide AI picks),
 * which produced different numbers and confused users.
 *
 * Sections:
 *   1. Filter bar (league, date range with quick-pick chips, result chips)
 *   2. Summary line — "Stats reflect: X bets · Y leagues · date range"
 *   3. Headline metrics (4 big numbers)
 *   4. Performance by League — clickable, cross-links to History
 *   5. Performance by Market — clickable, cross-links to History
 *   6. Monthly P/L (last 6 months)
 *   7. ROI by Stake Size (vertical bar chart)
 *   8. Day of Week Performance (7-cell grid)
 *   9. Best & Worst Bets (two cards)
 *   10. Streak tracker (current / best ever / worst ever)
 *
 * All charts inline SVG — no external charting library — so we stay
 * Athletic-editorial with zero bundle bloat.
 */

interface Props {
  currency: Currency
}

interface BetRow {
  id: string
  match_name: string
  league: string | null
  bet_type: string | null
  selection: string | null
  odds: number | null
  stake: number | null
  result: 'win' | 'loss' | 'void' | 'pending'
  profit_loss: number | null
  match_date: string | null
  created_at: string | null
}

type ResultFilter = 'all' | 'win' | 'loss'
type RangeKey = '7d' | '30d' | '90d' | 'all' | 'custom'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
function betDate(b: BetRow): string {
  if (b.match_date) return b.match_date.slice(0, 10)
  if (b.created_at) return b.created_at.slice(0, 10)
  return ''
}

export default function StatsTab({ currency }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [records, setRecords] = useState<BetRow[]>([])

  // Filters
  const [league, setLeague] = useState<string>('all')
  const [result, setResult] = useState<ResultFilter>('all')
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d')
  const [from, setFrom] = useState<string>(isoDaysAgo(30))
  const [to, setTo] = useState<string>(todayISO())

  useEffect(() => {
    let cancelled = false
    fetch('/api/bet-slips', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const bets = Array.isArray(data?.bets) ? data.bets : []
        setRecords(bets as BetRow[])
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load stats')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function applyRange(key: RangeKey) {
    setRangeKey(key)
    if (key === '7d') {
      setFrom(isoDaysAgo(7))
      setTo(todayISO())
    } else if (key === '30d') {
      setFrom(isoDaysAgo(30))
      setTo(todayISO())
    } else if (key === '90d') {
      setFrom(isoDaysAgo(90))
      setTo(todayISO())
    } else if (key === 'all') {
      setFrom('')
      setTo('')
    }
    // 'custom' just leaves the inputs as the user set them
  }

  // Unique leagues for the dropdown
  const leagues = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) if (r.league) set.add(r.league)
    return Array.from(set).sort()
  }, [records])

  // Filtered records — drives every chart
  const filtered = useMemo(() => {
    const fromMs = from ? new Date(from).getTime() : 0
    const toMs = to ? new Date(to).getTime() + 86_400_000 : Number.POSITIVE_INFINITY
    return records.filter((r) => {
      if (league !== 'all' && r.league !== league) return false
      if (result !== 'all' && r.result !== result) return false
      const d = betDate(r)
      if (d) {
        const ts = new Date(d).getTime()
        if (ts < fromMs || ts > toMs) return false
      }
      return true
    })
  }, [records, league, result, from, to])

  // ── Aggregations ────────────────────────────────────────────────────
  const headline = useMemo(() => computeHeadline(filtered), [filtered])
  const byLeague = useMemo(() => groupROI(filtered, (r) => r.league || 'Unknown'), [filtered])
  const byMarket = useMemo(() => groupROI(filtered, (r) => r.bet_type || 'Other'), [filtered])
  const months = useMemo(() => monthlyPnL(filtered, 6), [filtered])
  const streaks = useMemo(() => computeStreaks(filtered), [filtered])
  const byStake = useMemo(() => groupByStakeBucket(filtered), [filtered])
  const byDow = useMemo(() => groupByDayOfWeek(filtered), [filtered])
  const extremes = useMemo(() => findExtremes(filtered), [filtered])

  // Range label for the summary line
  const rangeLabel = useMemo(() => {
    if (rangeKey === '7d') return 'last 7 days'
    if (rangeKey === '30d') return 'last 30 days'
    if (rangeKey === '90d') return 'last 90 days'
    if (rangeKey === 'all' || (!from && !to)) return 'all time'
    if (from && to) {
      const f = new Date(from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      const t = new Date(to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      return `${f} → ${t}`
    }
    return 'custom range'
  }, [rangeKey, from, to])

  // Distinct leagues in the filtered set (for the summary line)
  const filteredLeagueCount = useMemo(() => {
    const set = new Set<string>()
    for (const r of filtered) if (r.league) set.add(r.league)
    return set.size
  }, [filtered])

  // ── Cross-links to History ──────────────────────────────────────────
  function goToHistory(extras: Record<string, string>) {
    const params = new URLSearchParams()
    params.set('tab', 'history')
    for (const [k, v] of Object.entries(extras)) {
      if (v) params.set(k, v)
    }
    router.push(`/dashboard/money?${params.toString()}`)
  }

  // ── Render ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-bg-surface border border-border-subtle animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-bg-surface border border-border-subtle animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-bg-surface border border-border-subtle animate-pulse" />
        <div className="h-64 bg-bg-surface border border-border-subtle animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-loss/10 border border-loss/30 text-loss text-sm p-4">
        {error}
      </div>
    )
  }

  // Empty state — no bets logged at all
  if (records.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-subtle p-10 text-center">
        <p className="text-fg font-bold text-base mb-2">No bets tracked yet</p>
        <p className="text-fg-muted text-sm mb-5">
          Place a bet, then see your stats here.
        </p>
        <a
          href="/dashboard/picks"
          className="inline-block px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider transition-colors"
        >
          Browse picks →
        </a>
      </div>
    )
  }

  return (
    <section className="space-y-5 lg:space-y-6">
      {/* FILTERS */}
      <div className="bg-bg-surface border border-border-subtle p-4 lg:p-5">
        <div className="flex flex-wrap items-end gap-3 lg:gap-4">
          {/* League */}
          <div className="min-w-[160px]">
            <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
              League
            </label>
            <select
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              className="w-full bg-bg-base border border-border-subtle px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand"
            >
              <option value="all">All leagues</option>
              {leagues.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Result chips */}
          <div>
            <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
              Result
            </label>
            <div className="flex gap-1.5">
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'win', label: 'Won' },
                  { key: 'loss', label: 'Lost' },
                ] as Array<{ key: ResultFilter; label: string }>
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setResult(key)}
                  className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors border ${
                    result === key
                      ? 'bg-brand text-white border-brand'
                      : 'bg-bg-base text-fg-secondary border-border-subtle hover:border-border-strong'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick range */}
          <div>
            <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
              Range
            </label>
            <div className="flex gap-1.5">
              {(
                [
                  { key: '7d', label: '7d' },
                  { key: '30d', label: '30d' },
                  { key: '90d', label: '90d' },
                  { key: 'all', label: 'All time' },
                ] as Array<{ key: RangeKey; label: string }>
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyRange(key)}
                  className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors border ${
                    rangeKey === key
                      ? 'bg-brand text-white border-brand'
                      : 'bg-bg-base text-fg-secondary border-border-subtle hover:border-border-strong'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom from/to */}
          <div>
            <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setRangeKey('custom')
              }}
              className="bg-bg-base border border-border-subtle px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
              To
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setRangeKey('custom')
              }}
              className="bg-bg-base border border-border-subtle px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand"
            />
          </div>
        </div>
      </div>

      {/* SUMMARY LINE */}
      <p className="text-fg-secondary text-xs lg:text-sm font-stat">
        Stats reflect: <span className="text-fg font-bold">{filtered.length}</span>{' '}
        {filtered.length === 1 ? 'bet' : 'bets'} ·{' '}
        <span className="text-fg font-bold">{filteredLeagueCount}</span>{' '}
        {filteredLeagueCount === 1 ? 'league' : 'leagues'} ·{' '}
        <span className="text-fg font-bold">{rangeLabel}</span>
      </p>

      {/* HEADLINE METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigStat label="Total bets" value={String(headline.totalBets)} />
        <BigStat
          label="Win rate"
          value={`${headline.winRate}%`}
          accent={headline.winRate >= 55 ? 'success' : 'neutral'}
        />
        <BigStat
          label="ROI"
          value={`${headline.roi >= 0 ? '+' : ''}${headline.roi}%`}
          accent={headline.roi >= 0 ? 'success' : 'loss'}
        />
        <BigStat
          label="Total P/L"
          value={`${headline.totalProfit >= 0 ? '+' : ''}${headline.totalProfit.toFixed(1)}u`}
          accent={headline.totalProfit >= 0 ? 'success' : 'loss'}
        />
      </div>

      {/* If filters wipe the set, stop here with a friendly nudge */}
      {filtered.length === 0 ? (
        <div className="bg-bg-surface border border-border-subtle p-8 text-center">
          <p className="text-fg-muted text-sm">No bets match these filters.</p>
        </div>
      ) : (
        <>
          {/* BY LEAGUE */}
          <Panel title="Performance by League" subtitle="Top 8 by volume — ROI per bet · click to see those bets">
            {byLeague.length === 0 ? (
              <Empty msg="No leagues yet." />
            ) : (
              <RoiBarChart
                rows={byLeague.slice(0, 8)}
                onRowClick={(key) => goToHistory({ league: key })}
              />
            )}
          </Panel>

          {/* BY MARKET */}
          <Panel title="Performance by Market" subtitle="Top 6 by volume — ROI per bet · click to see those bets">
            {byMarket.length === 0 ? (
              <Empty msg="No markets yet." />
            ) : (
              <RoiBarChart
                rows={byMarket.slice(0, 6)}
                onRowClick={(key) => goToHistory({ bet_type: key })}
              />
            )}
          </Panel>

          {/* MONTHLY P/L */}
          <Panel title="Monthly P/L" subtitle="Last 6 months · units">
            <MonthlyChart months={months} />
          </Panel>

          {/* ROI BY STAKE SIZE */}
          <Panel title="ROI by Stake Size" subtitle="Are you better at small or big stakes?">
            <StakeBucketChart buckets={byStake} />
          </Panel>

          {/* DAY OF WEEK */}
          <Panel title="Day of Week" subtitle="Where do you actually win?">
            <DayOfWeekGrid days={byDow} />
          </Panel>

          {/* BEST & WORST */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ExtremeCard title="Biggest win" bet={extremes.bestWin} kind="win" />
            <ExtremeCard title="Worst loss" bet={extremes.worstLoss} kind="loss" />
          </div>

          {/* STREAKS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StreakCard
              label="Current streak"
              count={Math.abs(streaks.current.length)}
              kind={streaks.current.kind}
            />
            <StreakCard label="Best streak ever" count={streaks.bestWin} kind="win" />
            <StreakCard label="Worst streak ever" count={streaks.worstLoss} kind="loss" />
          </div>
        </>
      )}

      <p className="text-fg-muted text-[11px] text-center font-stat">
        All amounts in units · {currency} amount = unit × your unit size
      </p>
    </section>
  )
}

// ── Aggregation helpers ─────────────────────────────────────────────

function computeHeadline(records: BetRow[]) {
  const wins = records.filter((r) => r.result === 'win').length
  const losses = records.filter((r) => r.result === 'loss').length
  const settled = wins + losses
  const totalBets = records.length
  const winRate = settled > 0 ? Math.round((wins / settled) * 100) : 0
  const totalProfit = records.reduce((s, r) => s + (r.profit_loss ?? 0), 0)
  const stakedTotal = records
    .filter((r) => r.result === 'win' || r.result === 'loss')
    .reduce((s, r) => s + (r.stake ?? 0), 0)
  const roi = stakedTotal > 0 ? Math.round((totalProfit / stakedTotal) * 1000) / 10 : 0
  return { totalBets, winRate, roi, totalProfit }
}

interface ROIRow {
  key: string
  bets: number
  wins: number
  losses: number
  roi: number
}

function groupROI(records: BetRow[], keyFn: (r: BetRow) => string): ROIRow[] {
  const map = new Map<
    string,
    { bets: number; wins: number; losses: number; profit: number; staked: number }
  >()
  for (const r of records) {
    const k = keyFn(r)
    const cur = map.get(k) ?? { bets: 0, wins: 0, losses: 0, profit: 0, staked: 0 }
    cur.bets++
    if (r.result === 'win') {
      cur.wins++
      cur.staked += r.stake ?? 0
    }
    if (r.result === 'loss') {
      cur.losses++
      cur.staked += r.stake ?? 0
    }
    cur.profit += r.profit_loss ?? 0
    map.set(k, cur)
  }
  const rows: ROIRow[] = []
  for (const [k, s] of map.entries()) {
    const roi = s.staked > 0 ? Math.round((s.profit / s.staked) * 1000) / 10 : 0
    rows.push({ key: k, bets: s.bets, wins: s.wins, losses: s.losses, roi })
  }
  return rows.sort((a, b) => b.bets - a.bets)
}

interface MonthRow {
  label: string
  pnl: number
}

function monthlyPnL(records: BetRow[], lastN: number): MonthRow[] {
  const map = new Map<string, number>()
  for (const r of records) {
    const d = betDate(r)
    if (!d) continue
    const date = new Date(d)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + (r.profit_loss ?? 0))
  }
  const now = new Date()
  const out: MonthRow[] = []
  for (let i = lastN - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
      pnl: Math.round((map.get(key) ?? 0) * 100) / 100,
    })
  }
  return out
}

interface StreaksOut {
  current: { kind: 'win' | 'loss' | 'none'; length: number }
  bestWin: number
  worstLoss: number
}

function computeStreaks(records: BetRow[]): StreaksOut {
  const chrono = [...records]
    .filter((r) => r.result === 'win' || r.result === 'loss')
    .sort((a, b) => new Date(betDate(a)).getTime() - new Date(betDate(b)).getTime())

  let bestWin = 0
  let worstLoss = 0
  let runWin = 0
  let runLoss = 0

  for (const r of chrono) {
    if (r.result === 'win') {
      runWin++
      runLoss = 0
      if (runWin > bestWin) bestWin = runWin
    } else {
      runLoss++
      runWin = 0
      if (runLoss > worstLoss) worstLoss = runLoss
    }
  }

  let current: StreaksOut['current'] = { kind: 'none', length: 0 }
  if (chrono.length > 0) {
    const last = chrono[chrono.length - 1]
    if (last.result === 'win') current = { kind: 'win', length: runWin }
    else if (last.result === 'loss') current = { kind: 'loss', length: runLoss }
  }
  return { current, bestWin, worstLoss }
}

// ── Stake-bucket aggregation ───────────────────────────────────────

interface StakeBucket {
  label: string
  bets: number
  roi: number
  profit: number
}

const STAKE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '<£1', min: 0, max: 1 },
  { label: '£1–5', min: 1, max: 5 },
  { label: '£5–10', min: 5, max: 10 },
  { label: '£10–25', min: 10, max: 25 },
  { label: '£25–50', min: 25, max: 50 },
  { label: '£50+', min: 50, max: Number.POSITIVE_INFINITY },
]

function groupByStakeBucket(records: BetRow[]): StakeBucket[] {
  const out: StakeBucket[] = STAKE_BUCKETS.map((b) => ({
    label: b.label,
    bets: 0,
    roi: 0,
    profit: 0,
  }))
  const stakedByBucket: number[] = STAKE_BUCKETS.map(() => 0)

  for (const r of records) {
    const stake = r.stake ?? 0
    if (stake <= 0) continue
    const idx = STAKE_BUCKETS.findIndex((b) => stake >= b.min && stake < b.max)
    if (idx === -1) continue
    out[idx].bets++
    if (r.result === 'win' || r.result === 'loss') {
      stakedByBucket[idx] += stake
      out[idx].profit += r.profit_loss ?? 0
    }
  }

  for (let i = 0; i < out.length; i++) {
    out[i].roi =
      stakedByBucket[i] > 0
        ? Math.round((out[i].profit / stakedByBucket[i]) * 1000) / 10
        : 0
  }
  return out
}

// ── Day-of-week aggregation ────────────────────────────────────────

interface DayBucket {
  label: string
  bets: number
  wins: number
  winRate: number
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function groupByDayOfWeek(records: BetRow[]): DayBucket[] {
  const counts = DAY_LABELS.map(() => ({ bets: 0, wins: 0, settled: 0 }))
  for (const r of records) {
    const d = betDate(r)
    if (!d) continue
    // Mon=0..Sun=6 (JS getDay: Sun=0..Sat=6 → shift)
    const jsDay = new Date(d).getDay()
    const idx = (jsDay + 6) % 7
    counts[idx].bets++
    if (r.result === 'win') {
      counts[idx].wins++
      counts[idx].settled++
    } else if (r.result === 'loss') {
      counts[idx].settled++
    }
  }
  return DAY_LABELS.map((label, i) => ({
    label,
    bets: counts[i].bets,
    wins: counts[i].wins,
    winRate:
      counts[i].settled > 0 ? Math.round((counts[i].wins / counts[i].settled) * 100) : 0,
  }))
}

// ── Best & worst ───────────────────────────────────────────────────

interface Extremes {
  bestWin: BetRow | null
  worstLoss: BetRow | null
}

function findExtremes(records: BetRow[]): Extremes {
  let bestWin: BetRow | null = null
  let worstLoss: BetRow | null = null
  for (const r of records) {
    if (r.profit_loss == null) continue
    if (r.result === 'win' && (!bestWin || r.profit_loss > (bestWin.profit_loss ?? 0))) {
      bestWin = r
    }
    if (r.result === 'loss' && (!worstLoss || r.profit_loss < (worstLoss.profit_loss ?? 0))) {
      worstLoss = r
    }
  }
  return { bestWin, worstLoss }
}

// ── Chart components ────────────────────────────────────────────────

function RoiBarChart({
  rows,
  onRowClick,
}: {
  rows: ROIRow[]
  onRowClick?: (key: string) => void
}) {
  const X_MIN = -50
  const X_MAX = 200

  function xPct(v: number) {
    const clamped = Math.max(X_MIN, Math.min(X_MAX, v))
    return ((clamped - X_MIN) / (X_MAX - X_MIN)) * 100
  }
  const zeroPct = xPct(0)

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const positive = r.roi >= 0
        const left = positive ? zeroPct : xPct(r.roi)
        const right = positive ? xPct(r.roi) : zeroPct
        const width = Math.max(0.5, right - left)
        const RowEl = onRowClick ? 'button' : 'div'
        const interactive = onRowClick != null
        return (
          <RowEl
            key={r.key}
            type={interactive ? 'button' : undefined}
            onClick={interactive ? () => onRowClick!(r.key) : undefined}
            className={`w-full text-left grid grid-cols-[140px_1fr_64px] items-center gap-3 lg:gap-4 ${
              interactive
                ? 'cursor-pointer hover:bg-bg-elevated/40 -mx-2 px-2 py-1 transition-colors'
                : ''
            }`}
            title={interactive ? `View ${r.key} bets in History` : undefined}
          >
            <div className="min-w-0">
              <p className="text-fg text-xs font-semibold truncate">{r.key}</p>
              <p className="text-fg-muted text-[10px] font-stat">
                {r.bets} bets · {r.wins}W·{r.losses}L
              </p>
            </div>
            <div className="relative h-6 bg-bg-base border border-border-subtle overflow-hidden">
              <span
                className="absolute top-0 bottom-0 w-px bg-border-strong"
                style={{ left: `${zeroPct}%` }}
                aria-hidden
              />
              <span
                className={`absolute top-0 bottom-0 ${positive ? 'bg-success/70' : 'bg-loss/70'}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                aria-hidden
              />
            </div>
            <p
              className={`text-right text-xs font-stat font-bold ${
                positive ? 'text-success' : 'text-loss'
              }`}
            >
              {positive ? '+' : ''}
              {r.roi}%
            </p>
          </RowEl>
        )
      })}
      <div className="grid grid-cols-[140px_1fr_64px] gap-3 lg:gap-4 text-fg-muted text-[10px] font-stat pt-2">
        <span />
        <div className="flex justify-between">
          <span>−50%</span>
          <span>0%</span>
          <span>+200%</span>
        </div>
        <span />
      </div>
    </div>
  )
}

function MonthlyChart({ months }: { months: MonthRow[] }) {
  if (months.length === 0) return <Empty msg="No monthly data yet." />
  const maxAbs = Math.max(1, ...months.map((m) => Math.abs(m.pnl)))
  const W = 600
  const H = 200
  const padX = 24
  const padY = 24
  const innerW = W - 2 * padX
  const innerH = H - 2 * padY
  const midY = padY + innerH / 2
  const barW = innerW / months.length - 14

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[200px]"
      preserveAspectRatio="none"
      role="img"
      aria-label="Monthly profit and loss chart"
    >
      <line
        x1={padX}
        x2={W - padX}
        y1={midY}
        y2={midY}
        stroke="currentColor"
        className="text-border-strong"
        strokeWidth="1"
      />
      {months.map((m, i) => {
        const cx = padX + (innerW / months.length) * i + (innerW / months.length) / 2
        const x = cx - barW / 2
        const positive = m.pnl >= 0
        const halfH = (Math.abs(m.pnl) / maxAbs) * (innerH / 2)
        const y = positive ? midY - halfH : midY
        return (
          <g key={i}>
            {halfH > 0.5 && (
              <rect
                x={x}
                y={y}
                width={barW}
                height={halfH}
                rx="3"
                fill={positive ? '#10B981' : '#F43F5E'}
                opacity="0.85"
              />
            )}
            <text
              x={cx}
              y={H - 6}
              textAnchor="middle"
              fontSize="10"
              fontFamily="ui-monospace, monospace"
              className="text-fg-muted"
              fill="currentColor"
            >
              {m.label}
            </text>
            {Math.abs(m.pnl) >= 0.1 && (
              <text
                x={cx}
                y={positive ? y - 4 : y + halfH + 12}
                textAnchor="middle"
                fontSize="10"
                fontFamily="ui-monospace, monospace"
                fill={positive ? '#10B981' : '#F43F5E'}
              >
                {positive ? '+' : ''}
                {m.pnl.toFixed(1)}u
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function StakeBucketChart({ buckets }: { buckets: StakeBucket[] }) {
  // Hide buckets with no bets so the chart isn't all gaps
  const nonEmpty = buckets.filter((b) => b.bets > 0)
  if (nonEmpty.length === 0) {
    return <Empty msg="No stakes recorded yet." />
  }
  const maxAbs = Math.max(1, ...nonEmpty.map((b) => Math.abs(b.roi)))

  const W = 600
  const H = 220
  const padX = 24
  const padY = 30
  const innerW = W - 2 * padX
  const innerH = H - 2 * padY
  const midY = padY + innerH / 2
  const barW = innerW / nonEmpty.length - 16

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[220px]"
      preserveAspectRatio="none"
      role="img"
      aria-label="ROI by stake size chart"
    >
      <line
        x1={padX}
        x2={W - padX}
        y1={midY}
        y2={midY}
        stroke="currentColor"
        className="text-border-strong"
        strokeWidth="1"
      />
      {nonEmpty.map((b, i) => {
        const cx = padX + (innerW / nonEmpty.length) * i + (innerW / nonEmpty.length) / 2
        const x = cx - barW / 2
        const positive = b.roi >= 0
        const halfH = (Math.abs(b.roi) / maxAbs) * (innerH / 2)
        const y = positive ? midY - halfH : midY
        return (
          <g key={i}>
            {halfH > 0.5 && (
              <rect
                x={x}
                y={y}
                width={barW}
                height={halfH}
                rx="3"
                fill={positive ? '#10B981' : '#F43F5E'}
                opacity="0.85"
              />
            )}
            <text
              x={cx}
              y={H - 14}
              textAnchor="middle"
              fontSize="10"
              fontFamily="ui-monospace, monospace"
              className="text-fg"
              fill="currentColor"
            >
              {b.label}
            </text>
            <text
              x={cx}
              y={H - 2}
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              className="text-fg-muted"
              fill="currentColor"
            >
              {b.bets} bet{b.bets === 1 ? '' : 's'}
            </text>
            {Math.abs(b.roi) >= 0.1 && (
              <text
                x={cx}
                y={positive ? y - 4 : y + halfH + 12}
                textAnchor="middle"
                fontSize="10"
                fontFamily="ui-monospace, monospace"
                fill={positive ? '#10B981' : '#F43F5E'}
              >
                {positive ? '+' : ''}
                {b.roi}%
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function DayOfWeekGrid({ days }: { days: DayBucket[] }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const has = d.bets > 0
        const accent =
          !has || d.winRate === 0
            ? 'text-fg-muted'
            : d.winRate >= 55
              ? 'text-success'
              : d.winRate >= 40
                ? 'text-fg'
                : 'text-loss'
        return (
          <div
            key={d.label}
            className="bg-bg-base border border-border-subtle p-3 text-center"
          >
            <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1">
              {d.label}
            </p>
            <p className={`font-stat font-bold text-lg leading-none ${accent}`}>
              {has ? `${d.winRate}%` : '—'}
            </p>
            <p className="text-fg-muted text-[10px] font-stat mt-1">
              {d.bets} bet{d.bets === 1 ? '' : 's'}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function ExtremeCard({
  title,
  bet,
  kind,
}: {
  title: string
  bet: BetRow | null
  kind: 'win' | 'loss'
}) {
  const accentText = kind === 'win' ? 'text-success' : 'text-loss'
  return (
    <div className="bg-bg-surface border border-border-subtle p-5">
      <p className="eyebrow mb-3">{title}</p>
      {!bet ? (
        <p className="text-fg-muted text-sm">No {kind === 'win' ? 'wins' : 'losses'} yet.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-fg font-bold text-base leading-snug">{bet.match_name}</p>
          <p className="text-fg-secondary text-xs">
            {bet.bet_type ?? '—'}
            {bet.selection ? ` · ${bet.selection}` : ''}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-2">
            <span className="text-fg-muted text-[10px] uppercase tracking-wider font-bold">
              Odds <span className="font-stat text-fg ml-1">{bet.odds?.toFixed(2) ?? '—'}</span>
            </span>
            <span className="text-fg-muted text-[10px] uppercase tracking-wider font-bold">
              Stake{' '}
              <span className="font-stat text-fg ml-1">
                {bet.stake != null ? `${bet.stake.toFixed(2)}u` : '—'}
              </span>
            </span>
            <span className={`font-stat font-bold text-xl ${accentText}`}>
              {bet.profit_loss == null
                ? '—'
                : `${bet.profit_loss >= 0 ? '+' : ''}${bet.profit_loss.toFixed(2)}u`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Card / shell components ─────────────────────────────────────────

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-bg-surface border border-border-subtle p-5 lg:p-6">
      <div className="mb-4 lg:mb-5">
        <h3 className="text-fg font-bold text-base">{title}</h3>
        {subtitle && <p className="text-fg-muted text-xs mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function BigStat({
  label,
  value,
  accent = 'neutral',
}: {
  label: string
  value: string
  accent?: 'neutral' | 'success' | 'loss'
}) {
  const color =
    accent === 'success' ? 'text-success' : accent === 'loss' ? 'text-loss' : 'text-fg'
  return (
    <div className="bg-bg-surface border border-border-subtle p-4 lg:p-5">
      <p className="eyebrow mb-2">{label}</p>
      <p className={`font-stat font-bold leading-none text-3xl lg:text-5xl ${color}`}>{value}</p>
    </div>
  )
}

function StreakCard({
  label,
  count,
  kind,
}: {
  label: string
  count: number
  kind: 'win' | 'loss' | 'none'
}) {
  const color = kind === 'win' ? 'text-success' : kind === 'loss' ? 'text-loss' : 'text-fg-muted'
  const suffix = kind === 'win' ? 'wins' : kind === 'loss' ? 'losses' : ''
  return (
    <div className="bg-bg-surface border border-border-subtle p-4 lg:p-5">
      <p className="eyebrow mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`font-stat font-bold text-3xl lg:text-4xl leading-none ${color}`}>{count}</p>
        {suffix && <span className="text-fg-muted text-xs uppercase tracking-wider">{suffix}</span>}
      </div>
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-fg-muted text-sm py-6 text-center">{msg}</p>
}
