'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Currency } from './MoneyClient'

/**
 * HistoryTab — filterable, sortable, exportable history of every settled
 * prediction. Sources from /api/track-record and aggregates client-side so
 * filtering and sorting feel instant.
 *
 * Layout:
 *   - Filters row (league + result chips + date range + Export CSV)
 *   - Summary stats (total bets · win rate · ROI · net P/L)
 *   - Sortable table (date · match · league · pick · odds · stake · result · P/L)
 *   - Load-more pagination (50 / page)
 */

interface Props {
  currency: Currency
}

interface RecentRecord {
  id: string
  home_team: string
  away_team: string
  league: string
  kick_off: string
  bet_type: string | null
  odds: number | null
  ev_percent: number | null
  is_value_bet: boolean
  result: 'win' | 'loss' | 'void' | null
  profit_loss: number | null
  home_score: number | null
  away_score: number | null
  closing_odds: number | null
  clv_percent: number | null
}

type ResultFilter = 'all' | 'win' | 'loss' | 'pending'
type SortKey = 'date' | 'odds' | 'pl' | 'league'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 50

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function HistoryTab({ currency }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [records, setRecords] = useState<RecentRecord[]>([])

  // Filters
  const [league, setLeague] = useState<string>('all')
  const [result, setResult] = useState<ResultFilter>('all')
  const [from, setFrom] = useState<string>(isoDaysAgo(30))
  const [to, setTo] = useState<string>(todayISO())

  // Sort + paginate
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [shown, setShown] = useState(PAGE_SIZE)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/track-record', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const recent: RecentRecord[] = Array.isArray(data?.recent) ? data.recent : []
        setRecords(recent)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load history')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Unique leagues for the dropdown
  const leagues = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) if (r.league) set.add(r.league)
    return Array.from(set).sort()
  }, [records])

  // Filtered + sorted
  const filtered = useMemo(() => {
    const fromMs = from ? new Date(from).getTime() : 0
    const toMs = to ? new Date(to).getTime() + 86_400_000 : Number.POSITIVE_INFINITY

    let rows = records.filter((r) => {
      if (league !== 'all' && r.league !== league) return false
      if (result === 'pending' && r.result != null) return false
      if (result === 'win' && r.result !== 'win') return false
      if (result === 'loss' && r.result !== 'loss') return false
      const ts = r.kick_off ? new Date(r.kick_off).getTime() : 0
      if (ts < fromMs || ts > toMs) return false
      return true
    })

    rows = [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'date') {
        return (new Date(a.kick_off).getTime() - new Date(b.kick_off).getTime()) * dir
      }
      if (sortKey === 'odds') {
        return ((a.odds ?? 0) - (b.odds ?? 0)) * dir
      }
      if (sortKey === 'pl') {
        return ((a.profit_loss ?? 0) - (b.profit_loss ?? 0)) * dir
      }
      if (sortKey === 'league') {
        return (a.league ?? '').localeCompare(b.league ?? '') * dir
      }
      return 0
    })

    return rows
  }, [records, league, result, from, to, sortKey, sortDir])

  // Reset paginate when filters change
  useEffect(() => {
    setShown(PAGE_SIZE)
  }, [league, result, from, to])

  // Summary stats over the filtered set
  const summary = useMemo(() => {
    const wins = filtered.filter((r) => r.result === 'win').length
    const losses = filtered.filter((r) => r.result === 'loss').length
    const settled = wins + losses
    const totalBets = filtered.length
    const winRate = settled > 0 ? Math.round((wins / settled) * 100) : 0
    // Treat 1 unit per bet as the stake (matches /api/track-record convention)
    const totalProfit = filtered.reduce((s, r) => s + (r.profit_loss ?? 0), 0)
    const roi = settled > 0 ? Math.round((totalProfit / settled) * 1000) / 10 : 0
    return { totalBets, winRate, roi, totalProfit, settled }
  }, [filtered])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'desc')
    }
  }

  function exportCSV() {
    const header = ['Date', 'Match', 'League', 'Pick', 'Odds', 'Stake (units)', 'Result', 'P/L (units)']
    const rows = filtered.map((r) => [
      r.kick_off ? r.kick_off.slice(0, 10) : '',
      `${r.home_team} vs ${r.away_team}`,
      r.league ?? '',
      r.bet_type ?? '',
      r.odds != null ? String(r.odds) : '',
      '1',
      r.result ?? 'pending',
      r.profit_loss != null ? String(r.profit_loss) : '',
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `matchmind-history-${todayISO()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Render ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-bg-surface border border-border-subtle rounded-2xl animate-pulse" />
        <div className="h-24 bg-bg-surface border border-border-subtle rounded-2xl animate-pulse" />
        <div className="h-64 bg-bg-surface border border-border-subtle rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-loss/10 border border-loss/30 text-loss text-sm rounded-2xl p-4">
        {error}
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-10 text-center">
        <p className="text-fg font-bold text-base mb-2">No bets yet</p>
        <p className="text-fg-muted text-sm">
          Add some from the{' '}
          <a href="/dashboard/picks" className="text-brand hover:underline">
            Picks
          </a>{' '}
          page.
        </p>
      </div>
    )
  }

  const visible = filtered.slice(0, shown)
  const hasMore = filtered.length > visible.length

  return (
    <section className="space-y-5">
      {/* FILTERS */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-4 lg:p-5">
        <div className="flex flex-wrap items-end gap-3 lg:gap-4">
          {/* League */}
          <div className="min-w-[160px]">
            <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
              League
            </label>
            <select
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand"
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
                  { key: 'pending', label: 'Pending' },
                ] as Array<{ key: ResultFilter; label: string }>
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setResult(key)}
                  className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors border ${
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

          {/* Date range */}
          <div>
            <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
              To
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand"
            />
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="px-4 py-2 bg-bg-base hover:bg-bg-elevated border border-border-subtle hover:border-border-strong text-fg text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total bets" value={String(summary.totalBets)} />
        <SummaryCard label="Win rate" value={`${summary.winRate}%`} accent={summary.winRate >= 55 ? 'success' : 'neutral'} />
        <SummaryCard label="ROI" value={`${summary.roi >= 0 ? '+' : ''}${summary.roi}%`} accent={summary.roi >= 0 ? 'success' : 'loss'} />
        <SummaryCard
          label="Net P/L"
          value={`${summary.totalProfit >= 0 ? '+' : ''}${summary.totalProfit.toFixed(2)}u`}
          accent={summary.totalProfit >= 0 ? 'success' : 'loss'}
        />
      </div>

      {/* TABLE */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-fg-muted text-sm">
            No bets match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-fg-muted text-[10px] font-bold uppercase tracking-wider">
                  <Th sortable onClick={() => toggleSort('date')} active={sortKey === 'date'} dir={sortDir}>
                    Date
                  </Th>
                  <Th>Match</Th>
                  <Th sortable onClick={() => toggleSort('league')} active={sortKey === 'league'} dir={sortDir}>
                    League
                  </Th>
                  <Th>Pick</Th>
                  <Th sortable onClick={() => toggleSort('odds')} active={sortKey === 'odds'} dir={sortDir} align="right">
                    Odds
                  </Th>
                  <Th align="right">Stake</Th>
                  <Th>Result</Th>
                  <Th sortable onClick={() => toggleSort('pl')} active={sortKey === 'pl'} dir={sortDir} align="right">
                    P/L
                  </Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const rowTint =
                    r.result === 'win'
                      ? 'bg-success/[0.04]'
                      : r.result === 'loss'
                        ? 'bg-loss/[0.04]'
                        : ''
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-border-subtle ${rowTint} hover:bg-bg-elevated/40 transition-colors`}
                    >
                      <Td className="font-stat text-fg-secondary whitespace-nowrap">
                        {r.kick_off
                          ? new Date(r.kick_off).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: '2-digit',
                            })
                          : '—'}
                      </Td>
                      <Td className="text-fg font-semibold whitespace-nowrap">
                        {r.home_team} vs {r.away_team}
                      </Td>
                      <Td className="text-fg-secondary text-xs whitespace-nowrap">{r.league}</Td>
                      <Td className="text-fg whitespace-nowrap">{r.bet_type ?? '—'}</Td>
                      <Td className="font-stat text-fg text-right whitespace-nowrap">
                        {r.odds != null ? r.odds.toFixed(2) : '—'}
                      </Td>
                      <Td className="font-stat text-fg-muted text-right whitespace-nowrap">1u</Td>
                      <Td>
                        <ResultPill result={r.result} />
                      </Td>
                      <Td
                        className={`font-stat font-semibold text-right whitespace-nowrap ${
                          r.profit_loss == null
                            ? 'text-fg-muted'
                            : r.profit_loss >= 0
                              ? 'text-success'
                              : 'text-loss'
                        }`}
                      >
                        {r.profit_loss == null
                          ? '—'
                          : `${r.profit_loss >= 0 ? '+' : ''}${r.profit_loss.toFixed(2)}u`}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LOAD MORE */}
      {hasMore && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE_SIZE)}
            className="px-5 py-2.5 bg-bg-surface hover:bg-bg-elevated border border-border-subtle hover:border-border-strong text-fg text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
          >
            Load more ({filtered.length - visible.length} remaining)
          </button>
        </div>
      )}

      <p className="text-fg-muted text-[11px] text-center font-stat">
        Stake & P/L expressed in units · {currency} amount = unit × your unit size
      </p>
    </section>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function SummaryCard({
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
    <div className="bg-bg-surface border border-border-subtle rounded-2xl p-4 lg:p-5">
      <p className="eyebrow mb-2">{label}</p>
      <p className={`font-stat text-2xl lg:text-3xl font-bold leading-none ${color}`}>{value}</p>
    </div>
  )
}

function Th({
  children,
  sortable,
  onClick,
  active,
  dir,
  align = 'left',
}: {
  children: React.ReactNode
  sortable?: boolean
  onClick?: () => void
  active?: boolean
  dir?: SortDir
  align?: 'left' | 'right'
}) {
  const alignClass = align === 'right' ? 'text-right' : 'text-left'
  const base = `px-3 lg:px-4 py-3 ${alignClass} ${active ? 'text-fg' : ''}`
  if (!sortable) return <th className={base}>{children}</th>
  return (
    <th className={base}>
      <button
        type="button"
        onClick={onClick}
        className={`uppercase tracking-wider hover:text-fg transition-colors ${
          align === 'right' ? 'inline-flex items-center justify-end gap-1' : 'inline-flex items-center gap-1'
        }`}
      >
        {children}
        {active && <span className="text-brand">{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  )
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={`px-3 lg:px-4 py-3 ${className}`}>{children}</td>
}

function ResultPill({ result }: { result: 'win' | 'loss' | 'void' | null }) {
  if (result == null) {
    return (
      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border-subtle text-fg-muted">
        Pending
      </span>
    )
  }
  if (result === 'void') {
    return (
      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border-subtle text-fg-muted">
        Void
      </span>
    )
  }
  const isWin = result === 'win'
  const cls = isWin
    ? 'bg-success/15 border-success/30 text-success'
    : 'bg-loss/15 border-loss/30 text-loss'
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
      {isWin ? 'Won' : 'Lost'}
    </span>
  )
}
