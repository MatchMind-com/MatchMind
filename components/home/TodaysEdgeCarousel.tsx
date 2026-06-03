'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'

interface BestValue {
  label: string
  ev: number
  odds: number
}

interface Prediction {
  id: number
  date: string
  league: string
  leagueFlag?: string
  home_team: string
  home_logo: string
  away_team: string
  away_logo: string
  recommended_bet: string
  best_value: BestValue | null
  value_score: number | null
  edge_explanation: string | null
}

interface Props {
  onPicksCount?: (n: number) => void
}

function fmtKickoff(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function pickLabel(pred: Prediction): string {
  // Prefer the value bet's label (e.g. "Arsenal Win", "Over 2.5", "BTTS")
  if (pred.best_value?.label) return pred.best_value.label
  // Fall back to the human "recommended_bet" string
  return pred.recommended_bet || 'Top pick'
}

function PickCard({ pred, onOpenDetail }: { pred: Prediction; onOpenDetail?: (id: number, home: string, away: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState(false)

  const odds = pred.best_value?.odds ?? null
  const ev = pred.value_score ?? pred.best_value?.ev ?? null
  const why = pred.edge_explanation || null
  const label = pickLabel(pred)

  async function addToBets() {
    if (adding || added) return
    setAdding(true)
    setError(false)
    try {
      const res = await fetch('/api/bet-slips/from-rec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          home: pred.home_team,
          away: pred.away_team,
          market: pred.best_value?.label?.includes('Over') ? 'Over/Under'
            : pred.best_value?.label === 'BTTS' ? 'BTTS'
            : 'Match Result (1X2)',
          selection: label,
          odds: odds ?? 2.0,
          stake: 10,
          league: pred.league,
          kickoff: pred.date,
          reasoning: why ?? `${label} — top value pick (EV ${ev ?? 0}%)`,
          fixtureId: pred.id,
        }),
      })
      if (!res.ok) throw new Error('insert failed')
      setAdded(true)
    } catch {
      setError(true)
    } finally {
      setAdding(false)
    }
  }

  return (
    <article className="snap-start shrink-0 w-[280px] md:w-auto md:flex-1 min-w-0 card hover:border-border-strong transition-colors duration-200 flex flex-col">
      {/* League + kickoff */}
      <div className="flex items-center justify-between mb-3 min-h-[16px]">
        <span className="text-fg-muted text-[11px] font-medium truncate">{pred.league}</span>
        <span className="font-stat text-fg-muted text-[11px]">{fmtKickoff(pred.date)}</span>
      </div>

      {/* Teams */}
      <div className="flex items-center gap-2 mb-4 min-w-0">
        {pred.home_logo ? (
          <Image
            src={pred.home_logo}
            alt={pred.home_team}
            width={20}
            height={20}
            className="shrink-0"
            unoptimized
          />
        ) : (
          <div className="w-5 h-5 bg-bg-elevated shrink-0" />
        )}
        <span className="text-fg text-sm font-semibold truncate">{pred.home_team}</span>
        <span className="text-fg-muted text-xs px-1">vs</span>
        {pred.away_logo ? (
          <Image
            src={pred.away_logo}
            alt={pred.away_team}
            width={20}
            height={20}
            className="shrink-0"
            unoptimized
          />
        ) : (
          <div className="w-5 h-5 bg-bg-elevated shrink-0" />
        )}
        <span className="text-fg text-sm font-semibold truncate">{pred.away_team}</span>
      </div>

      {/* Pick label + odds + EV */}
      <div className="bg-bg-base/40 border border-border-subtle px-3 py-3 mb-3">
        <p className="text-fg text-base font-bold leading-tight mb-2">{label}</p>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-stat text-2xl font-bold text-brand leading-none">
            {odds != null ? odds.toFixed(2) : '—'}
          </span>
          {ev != null && (
            <span className="font-stat text-xs font-bold text-value bg-value/10 border border-value/30 px-2 py-0.5">
              {ev > 0 ? '+' : ''}{ev}% EV
            </span>
          )}
        </div>
      </div>

      {/* Why? */}
      {why && (
        <p className="text-fg-secondary text-xs leading-relaxed mb-3 line-clamp-2 flex-1">
          {why}
        </p>
      )}

      {/* Action row — Add to bets + Detail trigger */}
      <div className="mt-auto flex items-stretch gap-2">
        <button
          onClick={addToBets}
          disabled={adding || added}
          className={`flex-1 text-xs font-semibold py-2 px-3 border transition-all duration-200 ${
            added
              ? 'bg-success/10 text-success border-success/30 cursor-default'
              : error
              ? 'bg-loss/10 text-loss border-loss/30'
              : 'bg-bg-elevated hover:bg-brand hover:text-bg-base text-fg border-border-subtle hover:border-brand'
          }`}
        >
          {added ? 'Added ✓' : error ? 'Try again' : adding ? 'Adding…' : 'Add to bets'}
        </button>
        {onOpenDetail && pred.id && (
          <button
            onClick={() => onOpenDetail(pred.id, pred.home_team, pred.away_team)}
            className="px-2.5 py-2 border border-border-subtle hover:border-brand text-fg-muted hover:text-brand text-xs font-bold uppercase tracking-wider transition-colors"
            title="Open full match detail — lineups, stats, events"
          >
            Stats
          </button>
        )}
      </div>
    </article>
  )
}

function PickSkeleton() {
  return (
    <div className="snap-start shrink-0 w-[280px] md:w-auto md:flex-1 card animate-pulse">
      <div className="h-3 w-20 bg-bg-elevated mb-4" />
      <div className="h-4 w-full bg-bg-elevated mb-4" />
      <div className="h-16 w-full bg-bg-elevated mb-3" />
      <div className="h-3 w-3/4 bg-bg-elevated mb-2" />
      <div className="h-8 w-full bg-bg-elevated mt-3" />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * TodaysEdgeCarousel — top 3 value picks from /api/predictions
 * ──────────────────────────────────────────────────────────── */
// Lazy-load the fixture detail modal — only ships JS when a user opens
// the "📊" button on a pick card.
const FixtureDetailModal = dynamic(() => import('@/components/fixtures/FixtureDetailModal'), {
  ssr: false,
  loading: () => null,
})

export default function TodaysEdgeCarousel({ onPicksCount }: Props) {
  const [picks, setPicks] = useState<Prediction[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openFixture, setOpenFixture] = useState<{ id: number; home: string; away: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch('/api/predictions', { cache: 'default' })
        const json = await res.json()
        if (!res.ok || !json.success) {
          if (!cancelled) setError(true)
          return
        }
        const all: Prediction[] = json.predictions || []
        // Pick the 3 highest value_score that have value_score data
        const ranked = [...all]
          .filter(p => p.value_score != null || p.best_value?.ev != null)
          .sort((a, b) => {
            const av = a.value_score ?? a.best_value?.ev ?? 0
            const bv = b.value_score ?? b.best_value?.ev ?? 0
            return bv - av
          })
          .slice(0, 3)
        if (!cancelled) {
          setPicks(ranked)
          onPicksCount?.(ranked.length)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Today&apos;s Edge</p>
          <h2 className="headline-md text-fg mt-1">AI&apos;s top value bets</h2>
        </div>
        <Link
          href="/dashboard/predictions"
          className="text-fg-secondary hover:text-brand text-sm font-medium transition-colors whitespace-nowrap"
        >
          View all picks →
        </Link>
      </div>

      {loading && (
        <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 lg:-mx-0 lg:px-0 pb-2 scrollbar-hide">
          <PickSkeleton />
          <PickSkeleton />
          <PickSkeleton />
        </div>
      )}

      {!loading && error && (
        <div className="card text-center py-8">
          <p className="text-fg-muted text-sm">— couldn&apos;t load today&apos;s picks</p>
        </div>
      )}

      {!loading && !error && picks && picks.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-fg-secondary text-sm">No value picks right now. Check back after the next refresh.</p>
        </div>
      )}

      {!loading && !error && picks && picks.length > 0 && (
        <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 lg:-mx-0 lg:px-0 pb-2 scrollbar-hide">
          {picks.map(p => (
            <PickCard
              key={p.id}
              pred={p}
              onOpenDetail={(id, home, away) => setOpenFixture({ id, home, away })}
            />
          ))}
        </div>
      )}

      {openFixture && (
        <FixtureDetailModal
          fixtureId={openFixture.id}
          homeName={openFixture.home}
          awayName={openFixture.away}
          onClose={() => setOpenFixture(null)}
        />
      )}
    </section>
  )
}
