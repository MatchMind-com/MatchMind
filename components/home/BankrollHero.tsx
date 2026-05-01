'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Snapshot {
  balance: number | string
  recorded_at: string
}

interface BankrollData {
  snapshots: Snapshot[]
  starting_bankroll: number
  current_bankroll: number
  in_play_stake: number
  in_play_potential: number
  available: number
  settled_pl: number
  counts: {
    pending: number
    won: number
    lost: number
  }
}

/* ────────────────────────────────────────────────────────────
 * MiniSparkline — minimal SVG polyline, no library
 * Renders a 7-day trajectory of bankroll values.
 * ──────────────────────────────────────────────────────────── */
function MiniSparkline({ values, positive }: { values: number[]; positive: boolean }) {
  // Need at least 2 points to draw a line
  if (!values || values.length < 2) {
    return (
      <div className="h-[40px] w-full flex items-center">
        <div className="h-px w-full bg-border-subtle" />
      </div>
    )
  }

  const w = 200
  const h = 40
  const padY = 4
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - padY - ((v - min) / range) * (h - padY * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  // First-to-last delta for fill colouring
  const stroke = positive ? 'var(--success)' : 'var(--loss)'

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-[40px]"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Subtle dot at the latest point */}
      {(() => {
        const last = values[values.length - 1]
        const x = w
        const y = h - padY - ((last - min) / range) * (h - padY * 2)
        return <circle cx={x - 1.5} cy={y} r={2} fill={stroke} />
      })()}
    </svg>
  )
}

/* ────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────── */
function fmtMoney(n: number): string {
  const abs = Math.abs(n)
  return `£${abs.toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: abs % 1 === 0 ? 0 : 2 })}`
}

function buildLast7DaysSeries(snapshots: Snapshot[], starting: number, current: number): number[] {
  // Build a 7-day-ish series: take up to last ~14 snapshots, normalize to 7 points.
  if (!snapshots || snapshots.length === 0) {
    return [starting, current]
  }
  const sorted = [...snapshots]
    .map(s => ({ at: new Date(s.recorded_at).getTime(), v: Number(s.balance) }))
    .filter(s => Number.isFinite(s.at) && Number.isFinite(s.v))
    .sort((a, b) => a.at - b.at)
  if (sorted.length === 0) return [starting, current]
  // Restrict to the last 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recent = sorted.filter(s => s.at >= cutoff)
  const series = recent.length >= 2 ? recent : sorted.slice(-7)
  // If we still have only one point, prepend starting bankroll
  if (series.length < 2) return [starting, series[0].v]
  return series.map(s => s.v)
}

/* ────────────────────────────────────────────────────────────
 * BankrollHero
 * ──────────────────────────────────────────────────────────── */
export default function BankrollHero() {
  const [data, setData] = useState<BankrollData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch('/api/bankroll', { cache: 'no-store' })
        if (!res.ok) throw new Error('bad status')
        const json = await res.json()
        if (!cancelled) {
          setData({
            snapshots: json.snapshots ?? [],
            starting_bankroll: Number(json.starting_bankroll ?? 0),
            current_bankroll: Number(json.current_bankroll ?? 0),
            in_play_stake: Number(json.in_play_stake ?? 0),
            in_play_potential: Number(json.in_play_potential ?? 0),
            available: Number(json.available ?? json.current_bankroll ?? 0),
            settled_pl: Number(json.settled_pl ?? 0),
            counts: json.counts ?? { pending: 0, won: 0, lost: 0 },
          })
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()

    // Refresh on tab focus
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)

    // Refresh every 90s — picks up auto-settled bet outcomes from the
    // /api/bet-slips/my-live writes without the user having to refresh.
    const poll = setInterval(() => load(), 90_000)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      clearInterval(poll)
    }
  }, [])

  // ── Loading skeleton ──
  if (loading && !data) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="h-3 w-20 bg-bg-elevated rounded" />
          <div className="h-3 w-12 bg-bg-elevated rounded" />
        </div>
        <div className="h-12 w-40 bg-bg-elevated rounded mb-3" />
        <div className="h-4 w-28 bg-bg-elevated rounded mb-4" />
        <div className="h-[40px] w-full bg-bg-elevated rounded" />
      </div>
    )
  }

  // ── Error state ──
  if (error || !data) {
    return (
      <div className="card">
        <p className="eyebrow">Bankroll</p>
        <p className="font-stat text-fg text-4xl mt-2">—</p>
        <p className="text-fg-muted text-xs mt-2">Couldn&apos;t load bankroll. Try again in a moment.</p>
      </div>
    )
  }

  const { snapshots, starting_bankroll, current_bankroll, in_play_stake, in_play_potential, available, counts } = data

  // 7-day P&L — based on `current_bankroll` (total = banked + at risk) so
  // settled wins still register even when stakes are locked in pending bets.
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentSnaps = snapshots
    .map(s => ({ at: new Date(s.recorded_at).getTime(), v: Number(s.balance) }))
    .filter(s => Number.isFinite(s.at) && Number.isFinite(s.v))
    .sort((a, b) => a.at - b.at)
  const startOfWeekBalance =
    recentSnaps.find(s => s.at >= cutoff)?.v ??
    (recentSnaps.length > 0 ? recentSnaps[0].v : starting_bankroll)
  const weekPnL = current_bankroll - startOfWeekBalance
  const series = buildLast7DaysSeries(snapshots, starting_bankroll, current_bankroll)
  const positive = weekPnL >= 0

  // Headline = wallet (banked, free to stake). When the user places a bet
  // their wallet should DROP by the stake — that matches every betting app's
  // mental model and what users intuitively expect ("I bet £10, my wallet
  // has £10 less"). Total balance (banked + at-risk) is shown subtly on the
  // breakdown row below.
  const hasPending = in_play_stake > 0

  return (
    <div className="card group hover:border-border-strong transition-colors duration-200">
      <div className="flex items-start justify-between mb-3">
        <p className="eyebrow">Bankroll</p>
        <Link
          href="/dashboard/bankroll"
          className="text-[11px] text-fg-muted hover:text-brand transition-colors font-medium"
        >
          edit
        </Link>
      </div>

      {/* Massive bankroll number — wallet (free to stake) */}
      <p className="font-stat text-fg text-5xl md:text-6xl font-bold leading-none tracking-tight">
        {fmtMoney(available)}
      </p>

      {/* Week P&L (settled gain — based on total, not wallet) */}
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={`font-stat text-sm font-semibold ${
            positive ? 'text-success' : 'text-loss'
          }`}
        >
          {positive ? '▲' : '▼'} {weekPnL >= 0 ? '+' : '−'}
          {fmtMoney(Math.abs(weekPnL))}
        </span>
        <span className="text-fg-muted text-xs">this week</span>
      </div>

      {/* In-play exposure — only shown if user has pending bets. The
          headline above is "wallet" (free to stake); this row gives the
          breakdown so the user can see where the money went. Tracks live
          as bets auto-settle. */}
      {hasPending && (
        <div className="mt-4 grid grid-cols-3 gap-3 p-3 rounded-xl bg-bg-base/50 border border-border-subtle">
          <div>
            <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">In play</p>
            <p className="font-stat text-loss text-base font-bold tabular-nums leading-tight">
              {fmtMoney(in_play_stake)}
            </p>
            <p className="text-fg-muted text-[10px] mt-0.5">{counts.pending} bet{counts.pending === 1 ? '' : 's'}</p>
          </div>
          <div>
            <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">Total</p>
            <p className="font-stat text-fg text-base font-bold tabular-nums leading-tight">
              {fmtMoney(current_bankroll)}
            </p>
            <p className="text-fg-muted text-[10px] mt-0.5">wallet + locked</p>
          </div>
          <div>
            <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">If all win</p>
            <p className="font-stat text-success text-base font-bold tabular-nums leading-tight">
              {fmtMoney(available + in_play_potential)}
            </p>
            <p className="text-fg-muted text-[10px] mt-0.5">+{fmtMoney(in_play_potential - in_play_stake)}</p>
          </div>
        </div>
      )}

      {/* Sparkline */}
      <div className="mt-5">
        <MiniSparkline values={series} positive={positive} />
      </div>
    </div>
  )
}
