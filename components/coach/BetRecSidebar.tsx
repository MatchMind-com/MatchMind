'use client'

import { useEffect, useState, useCallback } from 'react'
import type { BetRecommendation } from '@/lib/parse-bet-rec'

/**
 * Sidebar widget for the AI Coach page that shows the LATEST bet
 * recommendation the AI emitted. Persists across chat messages until a new
 * rec arrives or the user dismisses it. Includes a one-click "Add to my
 * bets" button and an optional collapsible "Look into stats" section that
 * fetches H2H + form + live stats from /api/fixtures/[fixtureId].
 *
 * Design notes:
 *  - Empty state when no rec yet — small dashed placeholder.
 *  - Sticky positioning so it stays in view while scrolling chat.
 *  - Reasoning is clamped to 3 lines with a "see more" expander.
 *  - Stats section is lazy — only fetches when expanded, caches per fixtureId.
 *  - If the rec has no fixtureId we still show H2H/form structure derived
 *    from the rec itself (team names) — but the stats button is disabled
 *    and tooltip-explained.
 */

type AddState = 'idle' | 'adding' | 'added' | 'error'

interface BetRecSidebarProps {
  rec: BetRecommendation | null
  addState: AddState
  onAdd: () => void
  onDismiss: () => void
}

interface FixtureStats {
  fixture?: { date?: string | null; status?: string | null; venue?: string | null }
  league?: { name?: string | null; logo?: string | null }
  home?: {
    name?: string | null
    logo?: string | null
    form?: Array<{ result: 'W' | 'D' | 'L'; opponent: string; score: string; isHome: boolean }>
  }
  away?: {
    name?: string | null
    logo?: string | null
    form?: Array<{ result: 'W' | 'D' | 'L'; opponent: string; score: string; isHome: boolean }>
  }
  h2h?: Array<{
    date?: string
    homeTeam?: string
    awayTeam?: string
    homeGoals?: number | null
    awayGoals?: number | null
    winner?: string
  }>
  statistics?: {
    home: { possession: number | null; shots_total: number | null; shots_on_goal: number | null; xg: number | null; corners: number | null }
    away: { possession: number | null; shots_total: number | null; shots_on_goal: number | null; xg: number | null; corners: number | null }
  } | null
}

function formatKickoff(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Today ${time}`
  if (isTomorrow) return `Tomorrow ${time}`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ` ${time}`
}

function bankrollPct(stake: number | null, _bankroll = 150): string | null {
  if (!stake) return null
  // Assume £150 default bankroll — matches the AI's 1-5% sizing rule.
  // We can't know the user's real bankroll here without a profile prop,
  // so this is a reasonable surface number; adjust if profile is wired in.
  const pct = Math.round((stake / _bankroll) * 100)
  if (pct < 1) return '<1% of bankroll'
  if (pct > 100) return null
  return `${pct}% of bankroll`
}

function FormBadge({ result }: { result: 'W' | 'D' | 'L' }) {
  const colour =
    result === 'W' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
    result === 'D' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
    'bg-rose-500/15 text-rose-300 border-rose-500/30'
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold border ${colour}`}>
      {result}
    </span>
  )
}

function StatBar({
  label,
  home,
  away,
  unit = '',
}: {
  label: string
  home: number | null
  away: number | null
  unit?: string
}) {
  if (home === null && away === null) return null
  const h = home ?? 0
  const a = away ?? 0
  const total = h + a || 1
  const homePct = (h / total) * 100
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span className="font-mono text-blue-300">{home ?? '—'}{unit}</span>
        <span className="uppercase tracking-wider">{label}</span>
        <span className="font-mono text-orange-300">{away ?? '—'}{unit}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.04]">
        <div className="bg-blue-500/60" style={{ width: `${homePct}%` }} />
        <div className="bg-orange-500/60" style={{ width: `${100 - homePct}%` }} />
      </div>
    </div>
  )
}

export default function BetRecSidebar({ rec, addState, onAdd, onDismiss }: BetRecSidebarProps) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [stats, setStats] = useState<FixtureStats | null>(null)

  // Reset stats panel + reasoning expand whenever the rec changes
  useEffect(() => {
    setStatsOpen(false)
    setStats(null)
    setStatsError(null)
    setReasoningExpanded(false)
  }, [rec])

  const fetchStats = useCallback(async (fixtureId: number) => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const res = await fetch(`/api/fixtures/${fixtureId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: FixtureStats = await res.json()
      setStats(json)
    } catch (e: any) {
      setStatsError(e?.message || 'Failed to load stats')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const toggleStats = useCallback(() => {
    if (!rec?.fixtureId) return
    const next = !statsOpen
    setStatsOpen(next)
    if (next && !stats && !statsLoading) {
      fetchStats(rec.fixtureId)
    }
  }, [statsOpen, stats, statsLoading, rec?.fixtureId, fetchStats])

  // Empty state — no rec yet
  if (!rec) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center">
        <div className="text-2xl mb-2 opacity-60">💡</div>
        <p className="text-xs text-slate-500 leading-relaxed">
          When the AI suggests a bet, it'll appear here.
        </p>
        <p className="text-[10px] text-slate-600 mt-2">
          Try "what's a good bet today?" in the chat.
        </p>
      </div>
    )
  }

  const matchTitle = rec.home && rec.away ? `${rec.home} vs ${rec.away}` : (rec.selection || 'AI Pick')
  const kickoffLabel = formatKickoff(rec.kickoff)
  const stakeStr = rec.stake ? `£${rec.stake.toFixed(2)}` : null
  const stakePctStr = bankrollPct(rec.stake)
  const oddsStr = rec.odds ? rec.odds.toFixed(2) : null
  const reasoning = rec.reasoning?.trim() || ''
  const reasoningIsLong = reasoning.length > 140

  const addLabel =
    addState === 'adding' ? 'Adding…' :
    addState === 'added' ? 'Added to your tracker ✓' :
    addState === 'error' ? 'Try again' :
    'Add to my bets'

  const addDisabled = addState === 'adding' || addState === 'added'

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0E1628] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-base leading-none">💡</span>
          <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">
            AI Bet Suggestion
          </span>
        </div>
        <div className="text-base font-bold text-white leading-tight">{matchTitle}</div>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
          {rec.league && <span>{rec.league}</span>}
          {rec.league && kickoffLabel && <span className="opacity-40">·</span>}
          {kickoffLabel && <span>{kickoffLabel}</span>}
        </div>
      </div>

      {/* Pick */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
              {rec.market || 'Bet'}
            </div>
            <div className="text-sm font-semibold text-white truncate">
              {rec.selection || '—'}
            </div>
          </div>
          {oddsStr && (
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Odds</div>
              <div className="text-2xl font-bold text-orange-400 leading-none">@ {oddsStr}</div>
            </div>
          )}
        </div>

        {stakeStr && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Suggested stake</span>
            <span className="ml-auto text-sm font-semibold text-emerald-300">{stakeStr}</span>
            {stakePctStr && (
              <span className="text-[10px] text-slate-500">({stakePctStr})</span>
            )}
          </div>
        )}
      </div>

      {/* Reasoning */}
      {reasoning && (
        <div className="px-4 pb-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Why?</div>
          <p className={`text-xs text-slate-300 leading-relaxed ${reasoningIsLong && !reasoningExpanded ? 'line-clamp-3' : ''}`}>
            {reasoning}
          </p>
          {reasoningIsLong && (
            <button
              onClick={() => setReasoningExpanded(v => !v)}
              className="mt-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              {reasoningExpanded ? 'see less' : 'see more'}
            </button>
          )}
        </div>
      )}

      {/* Stats toggle */}
      <div className="px-4 pb-3">
        <button
          onClick={toggleStats}
          disabled={!rec.fixtureId}
          title={!rec.fixtureId ? 'Stats unavailable for this match' : undefined}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
            !rec.fixtureId
              ? 'bg-white/[0.02] border-white/[0.05] text-slate-600 cursor-not-allowed'
              : statsOpen
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                : 'bg-white/[0.04] border-white/[0.07] text-slate-300 hover:bg-white/[0.06] hover:border-white/[0.12]'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span>📊</span>
            Look into stats
          </span>
          <svg
            className={`w-3.5 h-3.5 transition-transform ${statsOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Stats panel */}
        {statsOpen && rec.fixtureId && (
          <div className="mt-3 space-y-3">
            {statsLoading && (
              <div className="space-y-2">
                <div className="h-3 rounded bg-white/[0.05] animate-pulse" />
                <div className="h-3 rounded bg-white/[0.05] animate-pulse w-3/4" />
                <div className="h-3 rounded bg-white/[0.05] animate-pulse w-5/6" />
              </div>
            )}

            {statsError && (
              <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                Couldn't load stats: {statsError}
              </div>
            )}

            {stats && !statsLoading && (
              <>
                {/* Live / finished match stats — bar comparisons */}
                {stats.statistics && (
                  <div className="space-y-2 px-3 py-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Match stats</div>
                    <StatBar label="Shots" home={stats.statistics.home.shots_total} away={stats.statistics.away.shots_total} />
                    <StatBar label="On target" home={stats.statistics.home.shots_on_goal} away={stats.statistics.away.shots_on_goal} />
                    <StatBar label="xG" home={stats.statistics.home.xg} away={stats.statistics.away.xg} />
                    <StatBar label="Possession" home={stats.statistics.home.possession} away={stats.statistics.away.possession} unit="%" />
                    <StatBar label="Corners" home={stats.statistics.home.corners} away={stats.statistics.away.corners} />
                  </div>
                )}

                {/* Form */}
                {(stats.home?.form?.length || stats.away?.form?.length) ? (
                  <div className="px-3 py-3 rounded-lg bg-white/[0.02] border border-white/[0.05] space-y-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Recent form (last 5)</div>
                    {stats.home?.form && stats.home.form.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-blue-300 truncate min-w-0 flex-1">{stats.home.name || rec.home}</span>
                        <div className="flex gap-1 shrink-0">
                          {stats.home.form.slice(0, 5).map((f, i) => (
                            <FormBadge key={i} result={f.result} />
                          ))}
                        </div>
                      </div>
                    )}
                    {stats.away?.form && stats.away.form.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-orange-300 truncate min-w-0 flex-1">{stats.away.name || rec.away}</span>
                        <div className="flex gap-1 shrink-0">
                          {stats.away.form.slice(0, 5).map((f, i) => (
                            <FormBadge key={i} result={f.result} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* H2H */}
                {stats.h2h && stats.h2h.length > 0 && (
                  <div className="px-3 py-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Head-to-head (last {stats.h2h.length})</div>
                    <div className="space-y-1">
                      {stats.h2h.slice(0, 5).map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] text-slate-300">
                          <span className="truncate min-w-0 flex-1">{m.homeTeam}</span>
                          <span className="font-mono mx-2 text-white shrink-0">
                            {m.homeGoals ?? '?'}-{m.awayGoals ?? '?'}
                          </span>
                          <span className="truncate min-w-0 flex-1 text-right">{m.awayTeam}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!stats.statistics && !stats.home?.form?.length && !stats.h2h?.length && (
                  <div className="text-[11px] text-slate-500 text-center py-2">
                    No detailed stats available for this fixture yet.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 pt-1 space-y-2">
        <button
          onClick={onAdd}
          disabled={addDisabled}
          className={`w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            addState === 'added'
              ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 cursor-default'
              : addState === 'error'
                ? 'bg-rose-500/15 border border-rose-500/40 text-rose-200 hover:bg-rose-500/20'
                : addState === 'adding'
                  ? 'bg-blue-600/40 border border-blue-500/40 text-white/70 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white shadow-lg shadow-blue-500/20'
          }`}
        >
          <span className="text-base leading-none">{addState === 'added' ? '✓' : '✚'}</span>
          {addLabel}
        </button>
        <button
          onClick={onDismiss}
          className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 transition-colors py-1"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
