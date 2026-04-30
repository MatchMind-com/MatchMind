'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// Lazy-load — keeps initial PickCard bundle slim, panel JS only ships when toggled.
const AllMarketsPanel = dynamic(() => import('./AllMarketsPanel'), {
  ssr: false,
  loading: () => (
    <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 mt-3">
      <div className="bg-bg-elevated rounded-lg h-12 animate-pulse mb-2" />
      <div className="bg-bg-elevated rounded-lg h-12 animate-pulse" />
    </div>
  ),
})

/**
 * PickCard — editorial pick card used in Today / Tomorrow / Weekend tabs.
 *
 * Layout:
 *   eyebrow row (league flag + name + kickoff)
 *   teams row (logo · home · vs · away · logo)
 *   PICK row in elevated surface (market | odds | EV | confidence)
 *   "Why?" edge_explanation (line-clamp-2 by default, expandable)
 *   3 actions: Add to bets · Stats → · Discuss in coach
 *
 * Pure client — POSTs to /api/bet-slips/from-rec on add.
 * Stats button toggles inline detail panel (no modal — feels lighter).
 */

export interface PickPrediction {
  id: number
  date: string
  league: string
  leagueFlag?: string
  home_team: string
  home_logo?: string
  away_team: string
  away_logo?: string
  recommended_bet: string
  best_value: { label: string; odds: number; ev: number } | null
  value_score: number | null
  edge_explanation: string | null
  confidence?: number | null
  // Optional richer fields (used in expanded "Stats" panel when available)
  home_win_pct?: number
  draw_pct?: number
  away_win_pct?: number
  over_2_5_pct?: number
  btts_pct?: number
  bookmaker?: {
    home: number | null
    draw: number | null
    away: number | null
    over25: number | null
    btts: number | null
  } | null
  bookmaker_name?: string | null
}

interface Props {
  pred: PickPrediction
}

function fmtKickoff(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  // "Tonight 19:00" / "Tomorrow 14:30" / "Sat 16:00"
  const now = new Date()
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const hour = d.getHours()
  const evening = hour >= 18

  if (same(d, now)) return `${evening ? 'Tonight' : 'Today'} ${time}`
  if (same(d, tomorrow)) return `Tomorrow ${time}`
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' })
  return `${weekday} ${time}`
}

function pickLabel(pred: PickPrediction): string {
  if (pred.best_value?.label) return pred.best_value.label
  return pred.recommended_bet || 'Top pick'
}

function deriveBetType(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('over') || l.includes('under')) return 'Over/Under'
  if (l.includes('btts') || l.includes('both teams')) return 'BTTS'
  return 'Match Result (1X2)'
}

export default function PickCard({ pred }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState(false)
  const [expandedWhy, setExpandedWhy] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [marketsOpen, setMarketsOpen] = useState(false)

  const label = pickLabel(pred)
  const odds = pred.best_value?.odds ?? null
  const ev = pred.value_score ?? pred.best_value?.ev ?? null
  const why = pred.edge_explanation || null
  const confidence = typeof pred.confidence === 'number' ? pred.confidence : null

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
          market: deriveBetType(label),
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

  function openInCoach() {
    const prefill = `${pred.home_team} vs ${pred.away_team} ${label}${
      odds != null ? ` @ ${odds.toFixed(2)}` : ''
    }`
    router.push(`/dashboard/coach?prefill=${encodeURIComponent(prefill)}`)
  }

  return (
    <article className="bg-bg-surface border border-border-subtle rounded-2xl p-5 hover:border-border-strong transition-colors duration-200">
      {/* Eyebrow row — league + kickoff */}
      <div className="flex items-center justify-between mb-4 min-h-[14px]">
        <div className="eyebrow flex items-center gap-1.5 truncate">
          {pred.leagueFlag && <span className="text-[12px] leading-none">{pred.leagueFlag}</span>}
          <span className="truncate">{pred.league}</span>
        </div>
        <span className="font-stat text-fg-muted text-[11px] uppercase tracking-wider whitespace-nowrap">
          {fmtKickoff(pred.date)}
        </span>
      </div>

      {/* Teams row */}
      <div className="flex items-center justify-between gap-3 mb-5">
        {/* Home */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {pred.home_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pred.home_logo}
              alt={pred.home_team}
              className="w-10 h-10 object-contain flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-bg-elevated flex-shrink-0" />
          )}
          <span className="text-fg font-bold text-sm md:text-base truncate">{pred.home_team}</span>
        </div>

        {/* vs separator */}
        <span className="text-fg-muted text-[11px] font-medium uppercase tracking-wider px-1 shrink-0">
          vs
        </span>

        {/* Away */}
        <div className="flex items-center gap-3 flex-1 min-w-0 justify-end text-right">
          <span className="text-fg font-bold text-sm md:text-base truncate">{pred.away_team}</span>
          {pred.away_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pred.away_logo}
              alt={pred.away_team}
              className="w-10 h-10 object-contain flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-bg-elevated flex-shrink-0" />
          )}
        </div>
      </div>

      {/* PICK row — contrasting elevated surface */}
      <div className="bg-bg-elevated rounded-xl px-4 py-3.5 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-1">PICK</p>
            <p className="text-fg font-bold text-sm leading-tight">
              <span className="text-fg-secondary font-medium">AI says </span>
              {label}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {odds != null && (
              <span className="font-stat text-2xl font-bold text-brand leading-none">
                @ {odds.toFixed(2)}
              </span>
            )}
            {ev != null && (
              <span className="font-stat text-[11px] font-bold text-value bg-value/10 border border-value/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                {ev > 0 ? '+' : ''}
                {ev}% EV
              </span>
            )}
            {confidence != null && (
              <span className="font-stat text-[11px] text-fg-muted whitespace-nowrap">
                {confidence}/10
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Why? */}
      {why && (
        <div className="mb-4">
          <p className="eyebrow mb-1.5">Why?</p>
          <p
            className={`text-fg-secondary text-sm leading-relaxed ${
              expandedWhy ? '' : 'line-clamp-2'
            }`}
          >
            {why}
          </p>
          {why.length > 140 && (
            <button
              type="button"
              onClick={() => setExpandedWhy((v) => !v)}
              className="mt-1 text-fg-muted hover:text-brand text-xs font-semibold transition-colors"
            >
              {expandedWhy ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      )}

      {/* Inline stats panel — toggled by "Stats" action */}
      {statsOpen && (
        <div className="mb-4 bg-bg-base/50 border border-border-subtle rounded-xl px-4 py-3 space-y-2">
          <p className="eyebrow">AI probabilities</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-stat text-fg text-lg font-bold leading-none">
                {pred.home_win_pct ?? '—'}
                <span className="text-fg-muted text-xs">%</span>
              </p>
              <p className="text-[10px] text-fg-muted mt-1">HOME</p>
            </div>
            <div>
              <p className="font-stat text-fg text-lg font-bold leading-none">
                {pred.draw_pct ?? '—'}
                <span className="text-fg-muted text-xs">%</span>
              </p>
              <p className="text-[10px] text-fg-muted mt-1">DRAW</p>
            </div>
            <div>
              <p className="font-stat text-fg text-lg font-bold leading-none">
                {pred.away_win_pct ?? '—'}
                <span className="text-fg-muted text-xs">%</span>
              </p>
              <p className="text-[10px] text-fg-muted mt-1">AWAY</p>
            </div>
          </div>
          {(pred.over_2_5_pct != null || pred.btts_pct != null) && (
            <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-border-subtle">
              <div>
                <p className="font-stat text-fg-secondary text-base font-bold leading-none">
                  {pred.over_2_5_pct ?? '—'}
                  <span className="text-fg-muted text-xs">%</span>
                </p>
                <p className="text-[10px] text-fg-muted mt-1">O 2.5</p>
              </div>
              <div>
                <p className="font-stat text-fg-secondary text-base font-bold leading-none">
                  {pred.btts_pct ?? '—'}
                  <span className="text-fg-muted text-xs">%</span>
                </p>
                <p className="text-[10px] text-fg-muted mt-1">BTTS</p>
              </div>
            </div>
          )}
          {pred.bookmaker && (
            <div className="pt-2 border-t border-border-subtle">
              <p className="eyebrow mb-1.5">{pred.bookmaker_name ?? 'Live'} odds</p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {pred.bookmaker.home != null && (
                  <span className="font-stat text-fg-secondary">
                    H {pred.bookmaker.home.toFixed(2)}
                  </span>
                )}
                {pred.bookmaker.draw != null && (
                  <span className="font-stat text-fg-secondary">
                    D {pred.bookmaker.draw.toFixed(2)}
                  </span>
                )}
                {pred.bookmaker.away != null && (
                  <span className="font-stat text-fg-secondary">
                    A {pred.bookmaker.away.toFixed(2)}
                  </span>
                )}
                {pred.bookmaker.over25 != null && (
                  <span className="font-stat text-fg-secondary">
                    O2.5 {pred.bookmaker.over25.toFixed(2)}
                  </span>
                )}
                {pred.bookmaker.btts != null && (
                  <span className="font-stat text-fg-secondary">
                    BTTS {pred.bookmaker.btts.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addToBets}
          disabled={adding || added}
          className={`text-xs font-semibold py-2 px-3 rounded-lg border transition-all duration-200 inline-flex items-center gap-1.5 ${
            added
              ? 'bg-success/10 text-success border-success/30 cursor-default'
              : error
              ? 'bg-loss/10 text-loss border-loss/30'
              : 'bg-bg-elevated hover:bg-brand hover:text-bg-base text-fg border-border-subtle hover:border-brand'
          }`}
        >
          <span className="text-[14px] leading-none">{added ? '✓' : '+'}</span>
          {added ? 'Added' : error ? 'Try again' : adding ? 'Adding…' : 'Add to bets'}
        </button>

        <button
          type="button"
          onClick={() => setMarketsOpen((v) => !v)}
          className={`text-xs font-semibold py-2 px-3 rounded-lg border transition-all duration-200 inline-flex items-center gap-1.5 ${
            marketsOpen
              ? 'bg-brand text-bg-base border-brand'
              : 'bg-bg-elevated hover:bg-bg-base hover:border-border-strong text-fg border-border-subtle'
          }`}
          aria-expanded={marketsOpen}
        >
          <span className="text-[12px] leading-none">📊</span>
          {marketsOpen ? 'Hide markets' : 'All Markets'}
        </button>

        <button
          type="button"
          onClick={() => setStatsOpen((v) => !v)}
          className="text-xs font-semibold py-2 px-3 rounded-lg border border-border-subtle bg-bg-elevated hover:bg-bg-base hover:border-border-strong text-fg transition-all duration-200 inline-flex items-center gap-1.5"
          aria-expanded={statsOpen}
        >
          <span className="text-[12px] leading-none">📈</span>
          {statsOpen ? 'Hide stats' : 'Stats →'}
        </button>

        <button
          type="button"
          onClick={openInCoach}
          className="text-xs font-semibold py-2 px-3 rounded-lg border border-border-subtle bg-bg-elevated hover:bg-bg-base hover:border-border-strong text-fg transition-all duration-200 inline-flex items-center gap-1.5"
        >
          <span className="text-[12px] leading-none">💬</span>
          Discuss in coach
        </button>
      </div>

      {/* Inline All Markets panel — lazy-loaded */}
      {marketsOpen && (
        <AllMarketsPanel
          fixtureId={pred.id}
          homeTeam={pred.home_team}
          awayTeam={pred.away_team}
          league={pred.league}
          kickoff={pred.date}
        />
      )}
    </article>
  )
}
