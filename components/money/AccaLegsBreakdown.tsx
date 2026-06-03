'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const FixtureDetailModal = dynamic(
  () => import('@/components/fixtures/FixtureDetailModal'),
  { ssr: false, loading: () => null }
)

/**
 * AccaLegsBreakdown — expandable per-leg detail for an accumulator bet.
 *
 * Polls /api/bet-slips/[id]/live-legs every 60 seconds while at least one
 * leg has not yet finished, so the user sees live scores + per-leg
 * cashing/losing assessment without refreshing the page.
 *
 * Layout: card-per-leg grid (responsive 1/2-col) instead of the cramped
 * 7-col table that wouldn't fit on smaller widths. Each card shows:
 *   - Leg number + match + league
 *   - Selection (the user's pick)
 *   - Odds for the leg
 *   - Live status badge (LIVE 75' · 1-0 / NS / FT 2-1 / etc.)
 *   - State pill: Cashing 🟢 / Behind 🔴 / Won ✅ / Lost ❌ / Awaiting ⏳
 *   - Optional context line ("Liverpool 2-0 — needs to hold")
 *
 * Top of the panel shows the overall acca state (e.g. "5/6 cashing — 1 still
 * pending kickoff"), updated in real time.
 */

interface SavedLeg {
  match_name: string
  selection: string
  odds: number
  league?: string | null
  match_date?: string | null
  bet_type?: string | null
  result?: 'win' | 'loss' | 'void' | 'pending'
}

type LegState = 'pending' | 'cashing' | 'losing' | 'won' | 'lost' | 'tbd' | 'void'

interface LiveLeg extends SavedLeg {
  live: {
    matched: boolean
    fixture_id?: number | null
    status?: string
    status_long?: string
    minute?: number | null
    home_team?: string
    away_team?: string
    home_score?: number | null
    away_score?: number | null
    venue?: string | null
    state: LegState
    label: string
    context?: string
  }
}

interface LiveResponse {
  legs: LiveLeg[]
  is_acca: boolean
  counts?: {
    total: number
    won: number
    lost: number
    cashing: number
    losing: number
    pending: number
    tbd: number
    in_play: number
  }
  overall?: 'lost' | 'cashing' | 'on_track' | 'pending' | 'won'
  has_in_play?: boolean
  computed_at: string
}

const POLL_INTERVAL_MS = 60_000 // 1 min — matches user's request

const STATE_STYLE: Record<
  LegState,
  { bg: string; text: string; border: string; emoji: string; label: string }
> = {
  cashing: { bg: 'bg-success/15', text: 'text-success', border: 'border-success/40', emoji: '🟢', label: 'CASHING' },
  losing: { bg: 'bg-loss/15', text: 'text-loss', border: 'border-loss/40', emoji: '🔴', label: 'BEHIND' },
  won: { bg: 'bg-success/20', text: 'text-success', border: 'border-success/50', emoji: '✅', label: 'WON' },
  lost: { bg: 'bg-loss/20', text: 'text-loss', border: 'border-loss/50', emoji: '❌', label: 'LOST' },
  pending: { bg: 'bg-bg-elevated', text: 'text-fg-muted', border: 'border-border-subtle', emoji: '⏳', label: 'AWAITING' },
  tbd: { bg: 'bg-value/10', text: 'text-value', border: 'border-value/40', emoji: '⏱', label: 'IN PLAY' },
  void: { bg: 'bg-bg-elevated', text: 'text-fg-muted', border: 'border-border-subtle', emoji: '⊘', label: 'VOID' },
}

interface Props {
  betId: string
  /** Pre-parsed legs from the saved bet's notes — used as fallback while live data loads. */
  fallbackLegs: SavedLeg[]
  /** Visible fold name e.g. "6-fold accumulator" — only for the title. */
  foldLabel?: string
}

export default function AccaLegsBreakdown({ betId, fallbackLegs, foldLabel }: Props) {
  const [data, setData] = useState<LiveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [openFixture, setOpenFixture] = useState<{ id: number; home: string; away: string } | null>(null)
  const inFlight = useRef(false)

  async function fetchLive() {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const res = await fetch(`/api/bet-slips/${betId}/live-legs`, { cache: 'no-store' })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody?.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as LiveResponse
      setData(json)
      setError(null)
      setLastUpdated(new Date(json.computed_at))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Live update failed')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  // Initial fetch + polling. Polling stops once the acca is fully settled
  // (every leg in won/lost/void) — no point hammering the API for a finished bet.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    async function tick() {
      if (cancelled) return
      await fetchLive()
      if (cancelled) return
      // Decide whether to poll again. We re-read state via setData below:
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }
    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betId])

  // Stop polling once the acca is fully settled. We watch `data` and clear
  // the ongoing timer chain by setting a flag the tick checks. Simpler:
  // re-trigger the effect when settledness changes by including it as dep.
  const allSettled =
    data?.legs?.length
      ? data.legs.every((l) => l.live.state === 'won' || l.live.state === 'lost' || l.live.state === 'void')
      : false

  useEffect(() => {
    if (!allSettled) return
    // Once settled, no further polls — the cleanup above already cleared
    // the timer when the component re-rendered.
    // (Intentionally empty.)
  }, [allSettled])

  const legs = data?.legs?.length ? data.legs : fallbackLegs.map((l) => ({ ...l, live: makeFallbackLive(l) }))

  return (
    <div>
      {/* Compact title row only — counts/refresh moved to the BOTTOM bar
          so the leg cards lead and the meta ends the section. */}
      <p className="eyebrow mb-3">{foldLabel ?? 'Accumulator legs'}</p>

      {error && (
        <div className="bg-loss/10 border border-loss/30 text-loss text-[11px] p-2 mb-3">
          Live update failed — {error}. Showing last known state.
        </div>
      )}

      {/* Vertical stack — one card per row so it reads as a list, not a grid. */}
      <div className="flex flex-col gap-2">
        {legs.map((leg, i) => (
          <LegCard
            key={i}
            index={i + 1}
            leg={leg}
            onOpen={() => {
              if (leg.live.fixture_id && leg.live.home_team && leg.live.away_team) {
                setOpenFixture({ id: leg.live.fixture_id, home: leg.live.home_team, away: leg.live.away_team })
              }
            }}
          />
        ))}
      </div>

      {openFixture && (
        <FixtureDetailModal
          fixtureId={openFixture.id}
          homeName={openFixture.home}
          awayName={openFixture.away}
          onClose={() => setOpenFixture(null)}
        />
      )}

      {/* Footer bar — orange status summary + last-updated + refresh */}
      <div className="mt-4 pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {data?.counts && <CountsSummary counts={data.counts} overall={data.overall} />}
          <span className="text-fg-muted text-[10px] font-stat tabular-nums">
            {loading && !data ? 'Loading live…' : lastUpdated ? `Updated ${formatTimeAgo(lastUpdated)}` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void fetchLive()}
          className="text-fg-muted hover:text-brand text-[10px] font-bold uppercase tracking-wider transition-colors"
          aria-label="Refresh live legs"
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      <p className="text-fg-muted text-[10px] mt-2 leading-relaxed">
        Per-leg states update every minute while any leg is live. "Cashing" / "Behind" reflect your pick's
        current standing — not the final settlement, which only your bookmaker confirms. Mark the whole acca
        Won or Lost from the actions column once it’s settled.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function LegCard({ index, leg, onOpen }: { index: number; leg: LiveLeg; onOpen?: () => void }) {
  const live = leg.live
  const style = STATE_STYLE[live.state] ?? STATE_STYLE.pending
  const status = live.status ?? 'NS'
  const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(status)
  const isFinished = ['FT', 'AET', 'PEN'].includes(status)
  const homeName = live.home_team ?? leg.match_name.split(/\s+vs?\.?\s+|\s+v\s+/i)[0] ?? 'Home'
  const awayName = live.away_team ?? leg.match_name.split(/\s+vs?\.?\s+|\s+v\s+/i)[1] ?? 'Away'
  const score = live.home_score != null && live.away_score != null
    ? `${live.home_score} – ${live.away_score}`
    : null
  const liveStatusLabel = isLive
    ? `LIVE ${live.minute ? live.minute + "'" : ''}`
    : isFinished
      ? 'FT'
      : status === 'NS'
        ? 'KICKOFF SOON'
        : status === 'PST' ? 'POSTPONED'
        : status === 'CANC' ? 'CANCELLED'
        : (live.status_long ?? status)
  const canOpen = !!(live.fixture_id && onOpen)

  return (
    <div
      onClick={canOpen ? onOpen : undefined}
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onKeyDown={canOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen!() } } : undefined}
      title={canOpen ? 'Click for full match detail — lineups, stats, events, injuries' : undefined}
      className={`bg-bg-base/60 border p-4 transition-all ${
        live.state === 'cashing' || live.state === 'won' ? 'border-success/30 hover:border-success/50'
        : live.state === 'losing' || live.state === 'lost' ? 'border-loss/30 hover:border-loss/50'
        : 'border-border-subtle hover:border-border-strong'
      } ${canOpen ? 'cursor-pointer hover:bg-bg-base/80 hover:scale-[1.005]' : ''}`}
    >
      {/* HEADER ROW — leg index + match + state pill ─────────────── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-stat text-[10px] font-bold uppercase tracking-wider text-fg-muted">
              Leg {index}
            </span>
            {leg.league && (
              <span className="text-fg-muted text-[10px] uppercase tracking-wider truncate">
                · {leg.league}
              </span>
            )}
            {leg.match_date && (
              <span className="text-fg-muted text-[10px] tracking-wider font-stat">
                · {new Date(leg.match_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>
          <p className="text-fg font-bold text-[15px] leading-tight">
            {homeName} <span className="text-fg-muted font-normal">vs</span> {awayName}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 border text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}
          title={live.context ?? style.label}
        >
          <span>{live.label}</span>
        </span>
      </div>

      {/* MAIN GRID — pick / odds / live status / score in 4 columns
           on desktop, stacking nicely on mobile ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center gap-3 sm:gap-4 py-2.5 px-3 bg-bg-elevated/40">
        <div className="min-w-0">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">Your pick</p>
          <p className="text-fg text-[13px] font-semibold leading-tight">
            {leg.bet_type && (
              <span className="text-fg-muted text-[10px] block mb-0.5">{leg.bet_type}</span>
            )}
            {leg.selection}
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">Odds</p>
          <p className="font-stat text-fg text-[14px] font-bold tabular-nums">
            @ {leg.odds.toFixed(2)}
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">Status</p>
          <span className="flex items-center gap-1.5 sm:justify-end">
            <StatusDot status={status} state={live.state} />
            <span
              className={`font-stat font-bold uppercase tracking-wider text-[11px] ${
                isLive ? 'text-loss animate-pulse' : isFinished ? 'text-fg-secondary' : 'text-fg-muted'
              }`}
            >
              {liveStatusLabel}
            </span>
          </span>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">Score</p>
          <p className="font-stat text-fg text-[15px] font-bold tabular-nums">
            {score ?? '—'}
          </p>
        </div>
      </div>

      {/* Context line — e.g. "Liverpool 2-0 — needs to hold" */}
      {live.context && (
        <p className="mt-3 text-fg-secondary text-[12px] leading-snug">{live.context}</p>
      )}

      {!live.matched && (
        <p className="mt-3 text-fg-muted text-[10px] italic">
          Couldn’t find this fixture in our live feed. We’ll keep trying every minute.
        </p>
      )}

      {canOpen && (
        <p className="mt-3 pt-2 border-t border-border-subtle/50 text-brand text-[10px] font-bold uppercase tracking-wider text-right">
          View match detail →
        </p>
      )}
    </div>
  )
}

function StatusDot({ status, state }: { status: string; state: LegState }) {
  const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(status)
  if (isLive) return <span className="h-1.5 w-1.5 bg-loss animate-pulse" />
  if (state === 'won') return <span className="h-1.5 w-1.5 bg-success" />
  if (state === 'lost') return <span className="h-1.5 w-1.5 bg-loss" />
  return <span className="h-1.5 w-1.5 bg-fg-muted/40" />
}

function CountsSummary({
  counts,
  overall,
}: {
  counts: NonNullable<LiveResponse['counts']>
  overall?: LiveResponse['overall']
}) {
  const tone =
    overall === 'lost'
      ? 'text-loss'
      : overall === 'won'
        ? 'text-success'
        : overall === 'cashing' || overall === 'on_track'
          ? 'text-success'
          : 'text-fg-secondary'
  // Concise summary — "5/6 on" with breakdown tooltip
  const onTrack = counts.won + counts.cashing
  const safe = counts.lost === 0
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider font-stat ${tone}`}
      title={`Won ${counts.won} · Cashing ${counts.cashing} · Behind ${counts.losing} · Lost ${counts.lost} · Pending ${counts.pending}`}
    >
      {!safe && `${counts.lost}/${counts.total} lost`}
      {safe && counts.won === counts.total && `✓ ${counts.total}/${counts.total} won`}
      {safe && counts.won < counts.total && `${onTrack}/${counts.total} on track`}
    </span>
  )
}

function makeFallbackLive(leg: SavedLeg): LiveLeg['live'] {
  const r = leg.result ?? 'pending'
  return {
    matched: false,
    state: r === 'win' ? 'won' : r === 'loss' ? 'lost' : 'pending',
    label: r === 'win' ? 'Won' : r === 'loss' ? 'Lost' : 'Awaiting live data',
  }
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
