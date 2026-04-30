'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Currency } from './MoneyClient'
import BetCalendar, { type CalendarBet } from './BetCalendar'
import BetSlipScanner from './BetSlipScanner'
import AccaLegsBreakdown from './AccaLegsBreakdown'

/**
 * HistoryTab — editable history of every bet the user has logged.
 *
 * Layout:
 *   - BetCalendar (collapsible) — month grid, click a day to filter
 *   - Filters row (league + result chips + date range + Export CSV + "+ Add manual bet")
 *   - Summary stats (total bets · win rate · ROI · net P/L)
 *   - Sortable table with row checkboxes, edit/delete/mark-won/lost actions
 *   - Bulk-delete bar (visible when ≥1 row selected)
 *   - Load-more pagination (50 / page)
 *
 * Source: /api/bet-slips (the user's own logged bets, RLS-scoped). Distinct
 * from the system-wide /api/track-record feed used elsewhere.
 */

interface Props {
  currency: Currency
  /** Optional initial league filter (cross-link from Stats tab). */
  initialLeague?: string | null
  /** Optional initial bet-type filter (cross-link from Stats tab). */
  initialBetType?: string | null
}

interface BetRow {
  id: string
  user_id: string
  match_name: string
  league: string | null
  bet_type: string | null
  selection: string | null
  odds: number | null
  stake: number | null
  bookmaker: string | null
  potential_return: number | null
  result: 'win' | 'loss' | 'void' | 'pending'
  profit_loss: number | null
  match_date: string | null
  notes: string | null
  fixture_id: number | null
  created_at: string | null
}

type ResultFilter = 'all' | 'win' | 'loss' | 'pending' | 'void'
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

/** Best ISO date for a bet — match_date if present, else created_at. */
function betDate(b: BetRow): string {
  if (b.match_date) return b.match_date.slice(0, 10)
  if (b.created_at) return b.created_at.slice(0, 10)
  return ''
}

function computePL(result: BetRow['result'], odds: number, stake: number): number {
  if (result === 'win') return Math.round((odds - 1) * stake * 100) / 100
  if (result === 'loss') return -Math.round(stake * 100) / 100
  return 0
}

interface AccaLeg {
  match_name: string
  selection: string
  odds: number
  league?: string | null
  match_date?: string | null
  bet_type?: string | null
  result?: 'win' | 'loss' | 'void' | 'pending'
}

/** Parse the JSON acca-legs payload that BetSlipScanner stuffs into `notes`. */
function parseAccaLegs(notes: string | null | undefined): AccaLeg[] | null {
  if (!notes) return null
  // The payload may be the entire notes string, or a multi-line note where
  // the user prepended free text ahead of the JSON object.
  const lines = notes.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) continue
    try {
      const obj = JSON.parse(trimmed)
      if (obj?.kind === 'acca_legs_v1' && Array.isArray(obj.legs) && obj.legs.length > 0) {
        return obj.legs as AccaLeg[]
      }
    } catch {
      // ignore — keep scanning
    }
  }
  return null
}

function isAccaBet(bet: { bet_type: string | null; notes: string | null }): boolean {
  if (!bet.bet_type) return false
  return /^accumulator/i.test(bet.bet_type) && parseAccaLegs(bet.notes) !== null
}

export default function HistoryTab({ currency, initialLeague, initialBetType }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [records, setRecords] = useState<BetRow[]>([])

  // UI state
  const [showCalendar, setShowCalendar] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showScanModal, setShowScanModal] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Filters — when arriving from Stats with cross-link params, widen the
  // date range to "all time" so the user actually sees those bets.
  const hasCrossLink = !!(initialLeague || initialBetType)
  const [league, setLeague] = useState<string>(initialLeague || 'all')
  const [betType, setBetType] = useState<string>(initialBetType || 'all')
  const [result, setResult] = useState<ResultFilter>('all')
  const [from, setFrom] = useState<string>(hasCrossLink ? '' : isoDaysAgo(30))
  const [to, setTo] = useState<string>(hasCrossLink ? '' : todayISO())

  // Sort + paginate
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [shown, setShown] = useState(PAGE_SIZE)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/bet-slips', { cache: 'no-store' })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
      const bets: BetRow[] = Array.isArray(data?.bets) ? data.bets : []
      setRecords(bets)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  // Unique leagues for the dropdown
  const leagues = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) if (r.league) set.add(r.league)
    return Array.from(set).sort()
  }, [records])

  // Unique bet types for the dropdown
  const betTypes = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) if (r.bet_type) set.add(r.bet_type)
    return Array.from(set).sort()
  }, [records])

  // Filtered + sorted (used by table). Calendar always sees the full set so
  // the dot grid stays accurate independent of filters.
  const filtered = useMemo(() => {
    const fromMs = from ? new Date(from).getTime() : 0
    const toMs = to ? new Date(to).getTime() + 86_400_000 : Number.POSITIVE_INFINITY

    let rows = records.filter((r) => {
      if (selectedDate && betDate(r) !== selectedDate) return false
      if (league !== 'all' && r.league !== league) return false
      if (betType !== 'all' && r.bet_type !== betType) return false
      if (result !== 'all' && r.result !== result) return false
      if (!selectedDate && (from || to)) {
        const ts = betDate(r) ? new Date(betDate(r)).getTime() : 0
        if (ts < fromMs || ts > toMs) return false
      }
      return true
    })

    rows = [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'date') {
        return (new Date(betDate(a)).getTime() - new Date(betDate(b)).getTime()) * dir
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
  }, [records, league, betType, result, from, to, sortKey, sortDir, selectedDate])

  // Reset paginate + selection when filters change
  useEffect(() => {
    setShown(PAGE_SIZE)
  }, [league, betType, result, from, to, selectedDate])

  // Drop selections that no longer match the filtered view
  useEffect(() => {
    if (selected.size === 0) return
    const visibleIds = new Set(filtered.map((r) => r.id))
    let changed = false
    const next = new Set<string>()
    for (const id of selected) {
      if (visibleIds.has(id)) next.add(id)
      else changed = true
    }
    if (changed) setSelected(next)
  }, [filtered, selected])

  // Calendar uses the full record set
  const calendarBets: CalendarBet[] = useMemo(
    () =>
      records.map((r) => ({
        id: r.id,
        date: betDate(r),
        result: r.result,
        profit_loss: r.profit_loss,
        selection: r.selection,
        bet_type: r.bet_type,
        match_name: r.match_name,
        odds: r.odds,
      })),
    [records]
  )

  // Summary stats over the filtered set
  const summary = useMemo(() => {
    const wins = filtered.filter((r) => r.result === 'win').length
    const losses = filtered.filter((r) => r.result === 'loss').length
    const settled = wins + losses
    const totalBets = filtered.length
    const winRate = settled > 0 ? Math.round((wins / settled) * 100) : 0
    const totalProfit = filtered.reduce((s, r) => s + (r.profit_loss ?? 0), 0)
    const stakedTotal = filtered.reduce((s, r) => s + (r.stake ?? 0), 0)
    const roi = stakedTotal > 0 ? Math.round((totalProfit / stakedTotal) * 1000) / 10 : 0
    return { totalBets, winRate, roi, totalProfit, settled }
  }, [filtered])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const visibleIds = filtered.slice(0, shown).map((r) => r.id)
      const allSelected = visibleIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }
      return next
    })
  }

  // ── Mutations ─────────────────────────────────────────────────────
  async function patchBet(id: string, patch: Record<string, unknown>) {
    setBusyId(id)
    try {
      const r = await fetch(`/api/bet-slips/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
      // Optimistic merge of returned row
      if (data?.bet) {
        setRecords((rs) =>
          rs.map((row) => (row.id === id ? { ...row, ...(data.bet as BetRow) } : row))
        )
      } else {
        await reload()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteBet(id: string) {
    if (!confirm('Delete this bet? This cannot be undone.')) return
    setBusyId(id)
    try {
      const r = await fetch(`/api/bet-slips/${id}`, { method: 'DELETE' })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
      setRecords((rs) => rs.filter((row) => row.id !== id))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteSelected() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (
      !confirm(
        `Delete ${ids.length} bet${ids.length === 1 ? '' : 's'}? This cannot be undone.`
      )
    )
      return
    setError(null)
    let failed = 0
    await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(`/api/bet-slips/${id}`, { method: 'DELETE' })
          if (!r.ok) failed++
        } catch {
          failed++
        }
      })
    )
    if (failed > 0) {
      setError(`${failed} of ${ids.length} bets failed to delete.`)
    }
    setSelected(new Set())
    await reload()
  }

  function exportCSV() {
    const header = [
      'Date',
      'Match',
      'League',
      'Bet type',
      'Selection',
      'Odds',
      'Stake',
      'Result',
      'P/L',
      'Bookmaker',
      'Notes',
    ]
    const rows = filtered.map((r) => [
      betDate(r),
      r.match_name,
      r.league ?? '',
      r.bet_type ?? '',
      r.selection ?? '',
      r.odds != null ? String(r.odds) : '',
      r.stake != null ? String(r.stake) : '',
      r.result ?? 'pending',
      r.profit_loss != null ? String(r.profit_loss) : '',
      r.bookmaker ?? '',
      (r.notes ?? '').replace(/\n/g, ' '),
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
        <div className="h-64 bg-bg-surface border border-border-subtle rounded-2xl animate-pulse" />
        <div className="h-64 bg-bg-surface border border-border-subtle rounded-2xl animate-pulse" />
      </div>
    )
  }

  // Empty state — only when there are zero records at all. We still render
  // the calendar & manual-add affordance below so users can get started.
  const isEmpty = records.length === 0

  const visible = filtered.slice(0, shown)
  const hasMore = filtered.length > visible.length
  const allVisibleSelected =
    visible.length > 0 && visible.every((r) => selected.has(r.id))

  return (
    <section className="space-y-5">
      {/* Error banner (transient) */}
      {error && (
        <div className="bg-loss/10 border border-loss/30 text-loss text-sm rounded-2xl p-3 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-loss/70 hover:text-loss text-xs font-bold uppercase tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* CALENDAR */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">Activity</p>
          <button
            type="button"
            onClick={() => setShowCalendar((v) => !v)}
            className="text-fg-secondary hover:text-fg text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            {showCalendar ? 'Hide calendar' : 'Show calendar'}
          </button>
        </div>
        {showCalendar &&
          (isEmpty ? (
            <div className="py-10 text-center text-fg-muted text-sm">
              Your bet calendar will appear here once you log your first bet.
            </div>
          ) : (
            <BetCalendar
              bets={calendarBets}
              currency={currency}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          ))}
      </div>

      {/* FILTERS + ADD */}
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
              {/* Cross-link: ensure the value renders even if it's not in
                  the user's existing leagues yet */}
              {league !== 'all' && !leagues.includes(league) && (
                <option value={league}>{league}</option>
              )}
              {leagues.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Bet type */}
          <div className="min-w-[160px]">
            <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
              Market
            </label>
            <select
              value={betType}
              onChange={(e) => setBetType(e.target.value)}
              className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand"
            >
              <option value="all">All markets</option>
              {betType !== 'all' && !betTypes.includes(betType) && (
                <option value={betType}>{betType}</option>
              )}
              {betTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
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
                  { key: 'void', label: 'Void' },
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

          {/* Date range — disabled when a calendar day is pinned */}
          <div>
            <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={selectedDate !== null}
              className="bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand disabled:opacity-40"
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
              disabled={selectedDate !== null}
              className="bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand disabled:opacity-40"
            />
          </div>

          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="px-3 py-2 bg-brand/15 border border-brand/40 text-brand text-[11px] font-bold uppercase tracking-wider rounded-lg hover:bg-brand/20 transition-colors"
            >
              Day: {selectedDate} ✕
            </button>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="px-4 py-2 bg-bg-base hover:bg-bg-elevated border border-border-subtle hover:border-border-strong text-fg text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-40"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            className="px-4 py-2 bg-bg-base hover:bg-bg-elevated border border-brand/40 hover:border-brand text-brand text-xs font-bold uppercase tracking-wider rounded-lg transition-colors inline-flex items-center gap-1.5"
            title="Photograph a betting-shop slip and add it to your tracked history"
          >
            <span aria-hidden>📷</span> Scan slip
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
          >
            + Add manual bet
          </button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total bets" value={String(summary.totalBets)} />
        <SummaryCard
          label="Win rate"
          value={`${summary.winRate}%`}
          accent={summary.winRate >= 55 ? 'success' : 'neutral'}
        />
        <SummaryCard
          label="ROI"
          value={`${summary.roi >= 0 ? '+' : ''}${summary.roi}%`}
          accent={summary.roi >= 0 ? 'success' : 'loss'}
        />
        <SummaryCard
          label="Net P/L"
          value={`${summary.totalProfit >= 0 ? '+' : ''}${summary.totalProfit.toFixed(2)}u`}
          accent={summary.totalProfit >= 0 ? 'success' : 'loss'}
        />
      </div>

      {/* BULK BAR */}
      {selected.size > 0 && (
        <div className="bg-brand/10 border border-brand/40 rounded-2xl p-3 px-4 flex items-center justify-between gap-3">
          <span className="text-fg text-sm font-semibold">
            <span className="font-stat">{selected.size}</span> selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-fg-secondary hover:text-fg text-[11px] font-bold uppercase tracking-wider"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              className="px-3 py-1.5 bg-loss hover:opacity-90 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-opacity"
            >
              Delete selected
            </button>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
        {isEmpty ? (
          <div className="p-10 text-center">
            <p className="text-fg font-bold text-base mb-2">No bets yet</p>
            <p className="text-fg-muted text-sm mb-4">
              Snap a photo of your shop slip, add a manual bet, or log one from the{' '}
              <a href="/dashboard/picks" className="text-brand hover:underline">
                Picks
              </a>{' '}
              page.
            </p>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowScanModal(true)}
                className="px-4 py-2 bg-bg-base hover:bg-bg-elevated border border-brand/40 hover:border-brand text-brand text-xs font-bold uppercase tracking-wider rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <span aria-hidden>📷</span> Scan slip
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
              >
                + Add manual bet
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-fg-muted text-sm">
            No bets match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-fg-muted text-[10px] font-bold uppercase tracking-wider">
                  <th className="px-3 lg:px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="accent-brand cursor-pointer"
                      aria-label="Select all visible"
                    />
                  </th>
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
                  <Th align="right">Actions</Th>
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
                  const isSelected = selected.has(r.id)
                  const isEditing = editingId === r.id
                  const isBusy = busyId === r.id
                  const accaLegs = isAccaBet(r) ? parseAccaLegs(r.notes) : null
                  const isAcca = accaLegs !== null
                  const isExpanded = expandedId === r.id

                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={`border-t border-border-subtle ${rowTint} ${
                          isBusy ? 'opacity-50' : ''
                        } hover:bg-bg-elevated/40 transition-colors`}
                      >
                        <Td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(r.id)}
                            className="accent-brand cursor-pointer"
                            aria-label={`Select ${r.match_name}`}
                          />
                        </Td>
                        <Td className="font-stat text-fg-secondary whitespace-nowrap">
                          {betDate(r)
                            ? new Date(betDate(r)).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: '2-digit',
                              })
                            : '—'}
                        </Td>
                        <Td className="text-fg font-semibold whitespace-nowrap">
                          {isAcca ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : r.id)}
                              className="inline-flex items-center gap-1.5 hover:text-brand transition-colors text-left"
                              title={isExpanded ? 'Hide legs' : 'Show legs'}
                            >
                              <span
                                className={`text-fg-muted text-[10px] leading-none transition-transform inline-block ${
                                  isExpanded ? 'rotate-90' : ''
                                }`}
                              >
                                ▶
                              </span>
                              <span>{r.match_name}</span>
                              <span className="font-stat text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-brand/40 bg-brand/10 text-brand">
                                {accaLegs!.length} legs
                              </span>
                            </button>
                          ) : (
                            r.match_name
                          )}
                        </Td>
                        <Td className="text-fg-secondary text-xs whitespace-nowrap">
                          {r.league ?? '—'}
                        </Td>
                        <Td className="text-fg whitespace-nowrap">
                          <span className="block text-xs text-fg-muted">{r.bet_type ?? '—'}</span>
                          <span className="block">{r.selection ?? '—'}</span>
                        </Td>
                        <Td className="font-stat text-fg text-right whitespace-nowrap">
                          {r.odds != null ? r.odds.toFixed(2) : '—'}
                        </Td>
                        <Td className="font-stat text-fg-muted text-right whitespace-nowrap">
                          {r.stake != null ? r.stake.toFixed(2) + 'u' : '—'}
                        </Td>
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
                        <Td className="text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {r.result === 'pending' && (
                              <>
                                <ActionButton
                                  title="Mark Won"
                                  variant="success"
                                  onClick={() =>
                                    patchBet(r.id, { result: 'win' })
                                  }
                                  disabled={isBusy}
                                >
                                  ✓
                                </ActionButton>
                                <ActionButton
                                  title="Mark Lost"
                                  variant="loss"
                                  onClick={() =>
                                    patchBet(r.id, { result: 'loss' })
                                  }
                                  disabled={isBusy}
                                >
                                  ✗
                                </ActionButton>
                              </>
                            )}
                            <ActionButton
                              title="Edit"
                              onClick={() => setEditingId(isEditing ? null : r.id)}
                              disabled={isBusy}
                            >
                              <PencilIcon />
                            </ActionButton>
                            <ActionButton
                              title="Delete"
                              variant="loss-soft"
                              onClick={() => deleteBet(r.id)}
                              disabled={isBusy}
                            >
                              <TrashIcon />
                            </ActionButton>
                          </div>
                        </Td>
                      </tr>
                      {isAcca && isExpanded && accaLegs && (
                        <tr className="border-t border-border-subtle bg-bg-base/40">
                          <td colSpan={10} className="px-3 lg:px-4 py-4">
                            <AccaLegsBreakdown
                              betId={r.id}
                              fallbackLegs={accaLegs}
                              foldLabel={r.bet_type ?? 'Accumulator legs'}
                            />
                          </td>
                        </tr>
                      )}
                      {isEditing && (
                        <tr className={`border-t border-border-subtle bg-bg-elevated/60`}>
                          <td colSpan={10} className="p-4">
                            <EditRowForm
                              bet={r}
                              onCancel={() => setEditingId(null)}
                              onSave={async (patch) => {
                                await patchBet(r.id, patch)
                                setEditingId(null)
                              }}
                              busy={isBusy}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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

      {/* ADD MODAL */}
      {showAddModal && (
        <AddBetModal
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false)
            await reload()
          }}
        />
      )}

      {/* SCAN-SLIP MODAL */}
      {showScanModal && (
        <BetSlipScanner
          onClose={() => setShowScanModal(false)}
          onSaved={async () => {
            setShowScanModal(false)
            await reload()
          }}
        />
      )}
    </section>
  )
}

// ── Edit row form ─────────────────────────────────────────────────────

function EditRowForm({
  bet,
  onCancel,
  onSave,
  busy,
}: {
  bet: BetRow
  onCancel: () => void
  onSave: (patch: Record<string, unknown>) => Promise<void>
  busy: boolean
}) {
  const [result, setResult] = useState<BetRow['result']>(bet.result)
  const [odds, setOdds] = useState<string>(bet.odds != null ? String(bet.odds) : '')
  const [stake, setStake] = useState<string>(bet.stake != null ? String(bet.stake) : '')
  const [pl, setPl] = useState<string>(
    bet.profit_loss != null ? String(bet.profit_loss) : ''
  )
  const [notes, setNotes] = useState<string>(bet.notes ?? '')
  const [autoPL, setAutoPL] = useState(true)

  // Recompute auto P/L preview when result/odds/stake change
  const autoPLPreview = useMemo(() => {
    const o = parseFloat(odds)
    const s = parseFloat(stake)
    if (!Number.isFinite(o) || !Number.isFinite(s)) return null
    return computePL(result, o, s)
  }, [result, odds, stake])

  useEffect(() => {
    if (autoPL && autoPLPreview != null) {
      setPl(String(autoPLPreview))
    }
  }, [autoPL, autoPLPreview])

  function submit() {
    const patch: Record<string, unknown> = { result }
    const o = parseFloat(odds)
    const s = parseFloat(stake)
    if (Number.isFinite(o) && o > 1) patch.odds = o
    if (Number.isFinite(s) && s > 0) patch.stake = s
    if (!autoPL) {
      const p = parseFloat(pl)
      if (Number.isFinite(p)) patch.profit_loss = p
    }
    patch.notes = notes.trim() || null
    void onSave(patch)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div>
        <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
          Result
        </label>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value as BetRow['result'])}
          className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand"
        >
          <option value="pending">Pending</option>
          <option value="win">Won</option>
          <option value="loss">Lost</option>
          <option value="void">Void</option>
        </select>
      </div>
      <div>
        <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
          Odds
        </label>
        <input
          type="number"
          step="0.01"
          min="1.01"
          value={odds}
          onChange={(e) => setOdds(e.target.value)}
          className="w-full font-stat bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
          Stake (units)
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          className="w-full font-stat bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>P/L (units)</span>
          <label className="inline-flex items-center gap-1 normal-case tracking-normal text-[10px] font-medium text-fg-muted">
            <input
              type="checkbox"
              checked={autoPL}
              onChange={(e) => setAutoPL(e.target.checked)}
              className="accent-brand"
            />
            Auto
          </label>
        </label>
        <input
          type="number"
          step="0.01"
          value={pl}
          onChange={(e) => setPl(e.target.value)}
          disabled={autoPL}
          className="w-full font-stat bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand disabled:opacity-50"
        />
      </div>
      <div>
        <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
          Notes
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand"
          placeholder="optional"
        />
      </div>
      <div className="lg:col-span-5 flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-2 bg-bg-base border border-border-subtle hover:border-border-strong text-fg-secondary text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ── Add modal ─────────────────────────────────────────────────────────

function AddBetModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [match_name, setMatchName] = useState('')
  const [league, setLeague] = useState('')
  const [bet_type, setBetType] = useState('Match Result (1X2)')
  const [selection, setSelection] = useState('')
  const [odds, setOdds] = useState('')
  const [stake, setStake] = useState('')
  const [result, setResult] = useState<'pending' | 'win' | 'loss' | 'void'>('pending')
  const [match_date, setMatchDate] = useState(todayISO())
  const [bookmaker, setBookmaker] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setErr(null)
    if (!match_name.trim() || !selection.trim() || !odds || !stake) {
      setErr('Match, selection, odds and stake are required.')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/bet-slips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          match_name: match_name.trim(),
          league: league.trim() || null,
          bet_type,
          selection: selection.trim(),
          odds: parseFloat(odds),
          stake: parseFloat(stake),
          result,
          match_date,
          bookmaker: bookmaker.trim() || null,
          notes: notes.trim() || null,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to add bet')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-bg-surface border border-border-strong rounded-2xl p-5 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-fg font-bold text-base">Add manual bet</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-muted hover:text-fg text-lg leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Match" required>
            <input
              type="text"
              value={match_name}
              onChange={(e) => setMatchName(e.target.value)}
              placeholder="Arsenal vs Chelsea"
              className={inputCls}
            />
          </Field>
          <Field label="League">
            <input
              type="text"
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              placeholder="Premier League"
              className={inputCls}
            />
          </Field>
          <Field label="Market">
            <select
              value={bet_type}
              onChange={(e) => setBetType(e.target.value)}
              className={inputCls}
            >
              <option>Match Result (1X2)</option>
              <option>Over / Under</option>
              <option>Both Teams to Score</option>
              <option>Asian Handicap</option>
              <option>Double Chance</option>
              <option>Draw No Bet</option>
              <option>Correct Score</option>
              <option>Anytime Goalscorer</option>
              <option>Half-Time Result</option>
              <option>Accumulator</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Selection" required>
            <input
              type="text"
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
              placeholder="Arsenal to win"
              className={inputCls}
            />
          </Field>
          <Field label="Odds" required>
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              placeholder="2.10"
              className={`${inputCls} font-stat`}
            />
          </Field>
          <Field label="Stake (units)" required>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="1.0"
              className={`${inputCls} font-stat`}
            />
          </Field>
          <Field label="Result">
            <select
              value={result}
              onChange={(e) =>
                setResult(e.target.value as 'pending' | 'win' | 'loss' | 'void')
              }
              className={inputCls}
            >
              <option value="pending">Pending</option>
              <option value="win">Won</option>
              <option value="loss">Lost</option>
              <option value="void">Void</option>
            </select>
          </Field>
          <Field label="Match date">
            <input
              type="date"
              value={match_date}
              onChange={(e) => setMatchDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Bookmaker">
            <input
              type="text"
              value={bookmaker}
              onChange={(e) => setBookmaker(e.target.value)}
              placeholder="Bet365"
              className={inputCls}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {err && (
          <p className="mt-3 text-loss text-xs bg-loss/10 border border-loss/30 rounded-lg p-2">
            {err}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-bg-base border border-border-subtle hover:border-border-strong text-fg-secondary text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add bet'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-brand ml-1">*</span>}
      </label>
      {children}
    </div>
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
      <p className={`font-stat text-2xl lg:text-3xl font-bold leading-none ${color}`}>
        {value}
      </p>
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
          align === 'right'
            ? 'inline-flex items-center justify-end gap-1'
            : 'inline-flex items-center gap-1'
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

function ResultPill({ result }: { result: BetRow['result'] }) {
  if (result === 'pending') {
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
    <span
      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}
    >
      {isWin ? 'Won' : 'Lost'}
    </span>
  )
}

function ActionButton({
  children,
  onClick,
  title,
  disabled,
  variant = 'neutral',
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
  variant?: 'neutral' | 'success' | 'loss' | 'loss-soft'
}) {
  const cls =
    variant === 'success'
      ? 'bg-success/10 border-success/30 text-success hover:bg-success/20'
      : variant === 'loss'
        ? 'bg-loss/10 border-loss/30 text-loss hover:bg-loss/20'
        : variant === 'loss-soft'
          ? 'bg-bg-base border-border-subtle text-fg-muted hover:text-loss hover:border-loss/40'
          : 'bg-bg-base border-border-subtle text-fg-secondary hover:text-fg hover:border-border-strong'
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  )
}

function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}
