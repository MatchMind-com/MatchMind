'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Currency } from './MoneyClient'

/**
 * StatsTab — aggregated performance view.
 *
 * Sources from /api/track-record (same data as HistoryTab) and aggregates
 * everything client-side so the panels feel instant.
 *
 * Sections:
 *   1. Headline metrics (4 big numbers)
 *   2. Performance by League (horizontal ROI bar chart)
 *   3. Performance by Market (horizontal ROI bar chart)
 *   4. Monthly P/L (vertical bar chart, last 6 months)
 *   5. Streak tracker (current / best ever / worst ever)
 *
 * Charts are inline SVG — no external charting library — so we stay
 * Athletic-editorial with zero bundle bloat.
 */

interface Props {
  currency: Currency
}

interface Record_ {
  id: string
  league: string
  kick_off: string
  bet_type: string | null
  result: 'win' | 'loss' | 'void' | null
  profit_loss: number | null
}

export default function StatsTab({ currency }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [records, setRecords] = useState<Record_[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/track-record', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const recent = Array.isArray(data?.recent) ? data.recent : []
        setRecords(
          recent.map((r: Record_) => ({
            id: r.id,
            league: r.league,
            kick_off: r.kick_off,
            bet_type: r.bet_type,
            result: r.result,
            profit_loss: r.profit_loss,
          }))
        )
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

  // ── Aggregations ────────────────────────────────────────────────────
  const headline = useMemo(() => computeHeadline(records), [records])
  const byLeague = useMemo(() => groupROI(records, (r) => r.league || 'Unknown'), [records])
  const byMarket = useMemo(() => groupROI(records, (r) => r.bet_type || 'Other'), [records])
  const months = useMemo(() => monthlyPnL(records, 6), [records])
  const streaks = useMemo(() => computeStreaks(records), [records])

  // ── Render ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-bg-surface border border-border-subtle rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-bg-surface border border-border-subtle rounded-2xl animate-pulse" />
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
        <p className="text-fg font-bold text-base mb-2">No stats yet</p>
        <p className="text-fg-muted text-sm">
          Once predictions settle they'll appear here as aggregated performance.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-5 lg:space-y-6">
      {/* HEADLINE METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigStat label="Total bets" value={String(headline.totalBets)} />
        <BigStat label="Win rate" value={`${headline.winRate}%`} accent={headline.winRate >= 55 ? 'success' : 'neutral'} />
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

      {/* BY LEAGUE */}
      <Panel title="Performance by League" subtitle="Top 8 by volume — ROI per bet">
        {byLeague.length === 0 ? (
          <Empty msg="No leagues yet." />
        ) : (
          <RoiBarChart rows={byLeague.slice(0, 8)} />
        )}
      </Panel>

      {/* BY MARKET */}
      <Panel title="Performance by Market" subtitle="Top 6 by volume — ROI per bet">
        {byMarket.length === 0 ? (
          <Empty msg="No markets yet." />
        ) : (
          <RoiBarChart rows={byMarket.slice(0, 6)} />
        )}
      </Panel>

      {/* MONTHLY P/L */}
      <Panel title="Monthly P/L" subtitle="Last 6 months · units">
        <MonthlyChart months={months} />
      </Panel>

      {/* STREAKS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StreakCard
          label="Current streak"
          count={Math.abs(streaks.current.length)}
          kind={streaks.current.kind}
        />
        <StreakCard
          label="Best streak ever"
          count={streaks.bestWin}
          kind="win"
        />
        <StreakCard
          label="Worst streak ever"
          count={streaks.worstLoss}
          kind="loss"
        />
      </div>

      <p className="text-fg-muted text-[11px] text-center font-stat">
        All amounts in units · {currency} amount = unit × your unit size
      </p>
    </section>
  )
}

// ── Aggregation helpers ─────────────────────────────────────────────

function computeHeadline(records: Record_[]) {
  const wins = records.filter((r) => r.result === 'win').length
  const losses = records.filter((r) => r.result === 'loss').length
  const settled = wins + losses
  const totalBets = records.length
  const winRate = settled > 0 ? Math.round((wins / settled) * 100) : 0
  const totalProfit = records.reduce((s, r) => s + (r.profit_loss ?? 0), 0)
  const roi = settled > 0 ? Math.round((totalProfit / settled) * 1000) / 10 : 0
  return { totalBets, winRate, roi, totalProfit }
}

interface ROIRow {
  key: string
  bets: number
  wins: number
  losses: number
  roi: number
}

function groupROI(records: Record_[], keyFn: (r: Record_) => string): ROIRow[] {
  const map = new Map<string, { bets: number; wins: number; losses: number; profit: number }>()
  for (const r of records) {
    const k = keyFn(r)
    const cur = map.get(k) ?? { bets: 0, wins: 0, losses: 0, profit: 0 }
    cur.bets++
    if (r.result === 'win') cur.wins++
    if (r.result === 'loss') cur.losses++
    cur.profit += r.profit_loss ?? 0
    map.set(k, cur)
  }
  const rows: ROIRow[] = []
  for (const [k, s] of map.entries()) {
    const settled = s.wins + s.losses
    const roi = settled > 0 ? Math.round((s.profit / settled) * 1000) / 10 : 0
    rows.push({ key: k, bets: s.bets, wins: s.wins, losses: s.losses, roi })
  }
  // Sort by volume DESC (the top-N is the relevant slice)
  return rows.sort((a, b) => b.bets - a.bets)
}

interface MonthRow {
  label: string
  pnl: number
}

function monthlyPnL(records: Record_[], lastN: number): MonthRow[] {
  // Build a map keyed by YYYY-MM
  const map = new Map<string, number>()
  for (const r of records) {
    if (!r.kick_off) continue
    const d = new Date(r.kick_off)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + (r.profit_loss ?? 0))
  }
  // Generate the last N months (oldest → newest)
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

function computeStreaks(records: Record_[]): StreaksOut {
  // Iterate chronologically (records come back desc by kick_off)
  const chrono = [...records]
    .filter((r) => r.result === 'win' || r.result === 'loss')
    .sort((a, b) => new Date(a.kick_off).getTime() - new Date(b.kick_off).getTime())

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

  // Current = whatever streak we ended on
  let current: StreaksOut['current'] = { kind: 'none', length: 0 }
  if (chrono.length > 0) {
    const last = chrono[chrono.length - 1]
    if (last.result === 'win') current = { kind: 'win', length: runWin }
    else if (last.result === 'loss') current = { kind: 'loss', length: runLoss }
  }
  return { current, bestWin, worstLoss }
}

// ── Chart components ────────────────────────────────────────────────

function RoiBarChart({ rows }: { rows: ROIRow[] }) {
  // X-axis spans -50% to +200%
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
        return (
          <div key={r.key} className="grid grid-cols-[140px_1fr_64px] items-center gap-3 lg:gap-4">
            <div className="min-w-0">
              <p className="text-fg text-xs font-semibold truncate">{r.key}</p>
              <p className="text-fg-muted text-[10px] font-stat">
                {r.bets} bets · {r.wins}W·{r.losses}L
              </p>
            </div>
            <div className="relative h-6 bg-bg-base rounded-md border border-border-subtle overflow-hidden">
              {/* Centre line (0%) */}
              <span
                className="absolute top-0 bottom-0 w-px bg-border-strong"
                style={{ left: `${zeroPct}%` }}
                aria-hidden
              />
              <span
                className={`absolute top-0 bottom-0 ${positive ? 'bg-success/70' : 'bg-loss/70'} rounded-sm`}
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
          </div>
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
      {/* Centre line (0) */}
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
            {/* Label */}
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
            {/* Value above bar */}
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
    <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5 lg:p-6">
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
    <div className="bg-bg-surface border border-border-subtle rounded-2xl p-4 lg:p-5">
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
    <div className="bg-bg-surface border border-border-subtle rounded-2xl p-4 lg:p-5">
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
