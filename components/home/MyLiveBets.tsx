'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

/**
 * MyLiveBets — home-page section showing the user's currently active bets
 * (singles AND accumulators) with live scores + per-pick assessment.
 *
 * Polls /api/bet-slips/my-live every 60s while at least one bet has a
 * live leg. Shows:
 *   - Section header with live count + "+ New bet" CTA
 *   - Card per active bet (live games first, then upcoming today)
 *   - Acca cards expand to show per-leg state inline
 *   - Empty state with quick "Scan slip" / "Add manually" CTAs
 *
 * The "+ New bet" button opens the same BetSlipScanner modal used on the
 * Money → History page, so flows are consistent.
 */

// Lazy-load the scanner — it's a heavy modal we only need on demand.
const BetSlipScanner = dynamic(() => import('@/components/money/BetSlipScanner'), {
  ssr: false,
  loading: () => null,
})

type LegState = 'pending' | 'cashing' | 'losing' | 'won' | 'lost' | 'tbd' | 'void'

interface LiveSingle {
  matched: boolean
  fixture_id?: number | null
  status?: string
  status_long?: string
  minute?: number | null
  home_team?: string
  away_team?: string
  home_score?: number | null
  away_score?: number | null
  state: LegState
  label: string
  context?: string
}

interface LiveLeg {
  match_name: string
  selection: string
  odds: number
  league?: string | null
  match_date?: string | null
  bet_type?: string | null
  live: LiveSingle
}

interface ActiveBet {
  id: string
  match_name: string | null
  league: string | null
  bet_type: string | null
  selection: string | null
  odds: number | null
  stake: number | null
  match_date: string | null
  bookmaker: string | null
  is_acca: boolean
  live: LiveSingle | null
  legs?: LiveLeg[]
  counts?: {
    total: number
    won: number
    lost: number
    cashing: number
    losing: number
    pending: number
  }
  has_live: boolean
}

interface ApiResponse {
  bets: ActiveBet[]
  summary: {
    total: number
    in_play_now: number
    today_upcoming: number
    cashing: number
    behind: number
  }
  computed_at: string
}

const POLL_INTERVAL_MS = 60_000

const STATE_STYLE: Record<
  LegState,
  { bg: string; text: string; border: string; emoji: string }
> = {
  cashing: { bg: 'bg-success/15', text: 'text-success', border: 'border-success/40', emoji: '🟢' },
  losing: { bg: 'bg-loss/15', text: 'text-loss', border: 'border-loss/40', emoji: '🔴' },
  won: { bg: 'bg-success/20', text: 'text-success', border: 'border-success/50', emoji: '✅' },
  lost: { bg: 'bg-loss/20', text: 'text-loss', border: 'border-loss/50', emoji: '❌' },
  pending: { bg: 'bg-bg-elevated', text: 'text-fg-muted', border: 'border-border-subtle', emoji: '⏳' },
  tbd: { bg: 'bg-value/10', text: 'text-value', border: 'border-value/40', emoji: '⏱' },
  void: { bg: 'bg-bg-elevated', text: 'text-fg-muted', border: 'border-border-subtle', emoji: '⊘' },
}

export default function MyLiveBets() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const inFlight = useRef(false)

  async function fetchLive() {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const res = await fetch('/api/bet-slips/my-live', { cache: 'no-store' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as ApiResponse
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Live update failed')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    async function tick() {
      if (cancelled) return
      await fetchLive()
      if (cancelled) return
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bets = data?.bets ?? []
  const summary = data?.summary

  return (
    <section className="bg-bg-surface border border-border-subtle rounded-2xl p-5 lg:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            My live bets
            {summary && summary.in_play_now > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-loss/15 border border-loss/40 text-loss text-[9px] font-bold uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-loss animate-pulse" />
                {summary.in_play_now} live
              </span>
            )}
          </p>
          <h2 className="font-headline text-xl lg:text-2xl font-bold text-fg leading-tight mt-1">
            {summary && summary.total > 0
              ? `${summary.total} active bet${summary.total === 1 ? '' : 's'}`
              : 'No active bets'}
            {summary && summary.cashing > 0 && (
              <span className="text-success font-bold ml-2">· {summary.cashing} cashing</span>
            )}
            {summary && summary.behind > 0 && (
              <span className="text-loss font-bold ml-2">· {summary.behind} behind</span>
            )}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="shrink-0 px-3 lg:px-4 py-2 bg-brand hover:bg-brand-hover text-white text-[11px] lg:text-xs font-bold uppercase tracking-wider rounded-lg transition-colors inline-flex items-center gap-1.5"
          title="Add a new bet — scan a shop slip or enter manually"
        >
          <span aria-hidden>+</span> New bet
        </button>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="space-y-2">
          <div className="h-20 bg-bg-elevated rounded-xl animate-pulse" />
          <div className="h-20 bg-bg-elevated rounded-xl animate-pulse" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-loss/10 border border-loss/30 text-loss text-[12px] rounded-lg p-3">
          Live update failed — {error}.{' '}
          <button
            type="button"
            onClick={() => void fetchLive()}
            className="underline font-bold uppercase tracking-wider text-[10px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && bets.length === 0 && (
        <div className="bg-bg-base/40 border border-border-subtle border-dashed rounded-xl p-6 text-center">
          <p className="text-fg font-semibold mb-1">No live bets right now</p>
          <p className="text-fg-muted text-[12px] mb-4">
            Scan a betting-shop slip or add a bet manually to start tracking.
          </p>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <span aria-hidden>📷</span> Scan slip
            </button>
            <a
              href="/dashboard/money"
              className="px-4 py-2 bg-bg-base border border-border-subtle hover:border-border-strong text-fg-secondary hover:text-fg text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
            >
              Manage bets
            </a>
          </div>
        </div>
      )}

      {/* Bet cards */}
      {bets.length > 0 && (
        <div className="space-y-2">
          {bets.map((bet) => (
            <BetCard
              key={bet.id}
              bet={bet}
              expanded={expanded.has(bet.id)}
              onToggle={() => toggleExpand(bet.id)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {data && bets.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2">
          <span className="text-fg-muted text-[10px] font-stat">
            Updated {formatTimeAgo(new Date(data.computed_at))} · refreshes every minute
          </span>
          <a
            href="/dashboard/money"
            className="text-fg-muted hover:text-brand text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            View all in Money →
          </a>
        </div>
      )}

      {/* Scanner modal */}
      {showScanner && (
        <BetSlipScanner
          onClose={() => setShowScanner(false)}
          onSaved={() => {
            setShowScanner(false)
            void fetchLive() // immediately refresh so the new bet appears
          }}
        />
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────

function BetCard({
  bet,
  expanded,
  onToggle,
}: {
  bet: ActiveBet
  expanded: boolean
  onToggle: () => void
}) {
  if (bet.is_acca && bet.legs && bet.counts) {
    return <AccaBetCard bet={bet} expanded={expanded} onToggle={onToggle} />
  }
  return <SingleBetCard bet={bet} />
}

function SingleBetCard({ bet }: { bet: ActiveBet }) {
  const live = bet.live ?? { matched: false, state: 'pending' as LegState, label: 'Awaiting' }
  const style = STATE_STYLE[live.state] ?? STATE_STYLE.pending
  const status = live.status ?? 'NS'
  const isLive = ['1H', '2H', 'HT', 'ET'].includes(status)
  const isFinished = ['FT', 'AET', 'PEN'].includes(status)
  const score = live.home_score != null && live.away_score != null
    ? `${live.home_score} – ${live.away_score}`
    : null

  return (
    <div className={`bg-bg-base/60 border rounded-xl p-3.5 transition-colors ${
      live.state === 'cashing' || live.state === 'won' ? 'border-success/30'
      : live.state === 'losing' || live.state === 'lost' ? 'border-loss/30'
      : 'border-border-subtle'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {bet.league && (
              <span className="text-fg-muted text-[10px] font-bold uppercase tracking-wider truncate">
                {bet.league}
              </span>
            )}
            {bet.match_date && (
              <span className="text-fg-muted text-[10px] tracking-wider font-stat">
                · {new Date(bet.match_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>
          <p className="text-fg font-bold text-[14px] leading-tight truncate">
            {bet.match_name ?? 'Bet'}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}
          title={live.context ?? live.label}
        >
          <span aria-hidden>{style.emoji}</span> {live.label}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center gap-2 sm:gap-3 py-2 px-2.5 rounded-lg bg-bg-elevated/40">
        <div className="min-w-0">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">Pick</p>
          <p className="text-fg text-[12px] font-semibold leading-tight">
            {bet.bet_type && <span className="text-fg-muted text-[10px] block">{bet.bet_type}</span>}
            {bet.selection ?? '—'}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">Odds</p>
          <p className="font-stat text-fg text-[13px] font-bold tabular-nums">
            @ {bet.odds?.toFixed(2) ?? '—'}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">Status</p>
          <span className="flex items-center gap-1 sm:justify-end">
            <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-loss animate-pulse' : 'bg-fg-muted/40'}`} />
            <span className={`font-stat font-bold uppercase tracking-wider text-[10px] ${isLive ? 'text-loss' : isFinished ? 'text-fg-secondary' : 'text-fg-muted'}`}>
              {isLive ? `LIVE ${live.minute ? live.minute + "'" : ''}` : isFinished ? 'FT' : status === 'NS' ? 'KICKOFF SOON' : status}
            </span>
          </span>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">Score</p>
          <p className="font-stat text-fg text-[14px] font-bold tabular-nums">{score ?? '—'}</p>
        </div>
      </div>

      {live.context && (
        <p className="mt-2 text-fg-secondary text-[11px] leading-snug">{live.context}</p>
      )}
    </div>
  )
}

function AccaBetCard({
  bet,
  expanded,
  onToggle,
}: {
  bet: ActiveBet
  expanded: boolean
  onToggle: () => void
}) {
  const counts = bet.counts!
  const legs = bet.legs!
  const overall: LegState =
    counts.lost > 0 ? 'lost'
    : counts.won === counts.total ? 'won'
    : counts.cashing > 0 || counts.losing > 0 ? (counts.losing > 0 ? 'losing' : 'cashing')
    : 'pending'
  const style = STATE_STYLE[overall]

  // Find the most "active" leg to feature in the collapsed view
  const featured =
    legs.find((l) => ['1H', '2H', 'HT', 'ET'].includes(l.live.status ?? '')) ??
    legs.find((l) => l.live.state === 'losing') ??
    legs.find((l) => l.live.state === 'cashing') ??
    legs[0]

  return (
    <div className={`bg-bg-base/60 border rounded-xl transition-colors ${
      overall === 'cashing' || overall === 'won' ? 'border-success/30'
      : overall === 'losing' || overall === 'lost' ? 'border-loss/30'
      : 'border-border-subtle'
    }`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-3.5 hover:bg-bg-elevated/30 rounded-xl transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="font-stat text-[10px] font-bold uppercase tracking-wider text-brand">
                {bet.bet_type ?? 'Accumulator'}
              </span>
              <span className="font-stat text-[10px] tracking-wider text-fg-muted">
                · @ {bet.odds?.toFixed(2)}
              </span>
              <span className="font-stat text-[10px] tracking-wider text-fg-muted">
                · {bet.stake?.toFixed(2)}u stake
              </span>
            </div>
            <p className="text-fg font-bold text-[14px] leading-tight">
              {legs.length}-leg slip · {bet.bookmaker || 'Bookmaker'}
            </p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}
          >
            {counts.lost > 0 ? `${counts.lost}/${counts.total} lost`
              : counts.won === counts.total ? `✓ ${counts.total}/${counts.total} won`
              : `${counts.won + counts.cashing}/${counts.total} on track`}
          </span>
        </div>

        {/* Featured leg one-liner */}
        {featured && (
          <div className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg bg-bg-elevated/40 mt-2">
            <span className="text-fg-muted text-[10px] font-bold uppercase tracking-wider shrink-0">
              {expanded ? 'Hide legs' : 'Latest'}:
            </span>
            <span className="text-fg text-[12px] font-semibold flex-1 min-w-0 truncate">
              {featured.live.context ?? `${featured.match_name} — ${featured.selection}`}
            </span>
            <span className="text-fg-muted text-[14px] leading-none">
              {expanded ? '▴' : '▾'}
            </span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-1.5">
          {legs.map((leg, i) => (
            <LegMiniRow key={i} index={i + 1} leg={leg} />
          ))}
          <a
            href="/dashboard/money"
            className="block mt-2 text-center text-fg-muted hover:text-brand text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            See full breakdown in Money →
          </a>
        </div>
      )}
    </div>
  )
}

function LegMiniRow({ index, leg }: { index: number; leg: LiveLeg }) {
  const style = STATE_STYLE[leg.live.state] ?? STATE_STYLE.pending
  const status = leg.live.status ?? 'NS'
  const isLive = ['1H', '2H', 'HT', 'ET'].includes(status)
  const isFinished = ['FT', 'AET', 'PEN'].includes(status)
  const score = leg.live.home_score != null && leg.live.away_score != null
    ? `${leg.live.home_score}–${leg.live.away_score}`
    : null
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-bg-elevated/30 text-[11px]">
      <span className="font-stat text-[10px] text-fg-muted w-5 shrink-0">{index}</span>
      <span className="text-fg font-semibold min-w-0 truncate flex-1">
        {leg.match_name}
        <span className="text-fg-muted font-normal"> · {leg.selection}</span>
      </span>
      <span className="font-stat text-fg-muted text-[10px] shrink-0">@ {leg.odds.toFixed(2)}</span>
      <span className={`font-stat font-bold uppercase tracking-wider text-[9px] shrink-0 ${
        isLive ? 'text-loss' : isFinished ? 'text-fg-secondary' : 'text-fg-muted'
      }`}>
        {isLive ? `${leg.live.minute ?? ''}'` : isFinished ? 'FT' : status === 'NS' ? 'NS' : status}
      </span>
      <span className="font-stat text-fg text-[11px] font-bold tabular-nums shrink-0 w-10 text-right">
        {score ?? '—'}
      </span>
      <span className={`shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}>
        {style.emoji}
      </span>
    </div>
  )
}

function formatTimeAgo(d: Date): string {
  const ms = Date.now() - d.getTime()
  const s = Math.round(ms / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return `${h}h ago`
}
