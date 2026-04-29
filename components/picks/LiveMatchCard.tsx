'use client'

import { useEffect, useState } from 'react'

/**
 * LiveMatchCard — in-play match card for the Picks "Live" tab.
 *
 * Visual cues:
 *   - Pulsing red dot + LIVE eyebrow (uses the existing `.live-dot` class)
 *   - Big mono score in brand-orange
 *   - Live stats row (xG, Shots, Possession) — only when /api/live-copilot
 *     returns them. We never render "0/0" for stats that the upstream gave us
 *     null for (matches the rule used by the live-copilot system prompt).
 *   - AI's latest commentary line, fetched silently on mount + every 60s
 *   - "Watch with AI" button → opens the LiveCoPilot drawer (handled by parent)
 *
 * Data: parent passes the basic fixture, this component lazy-loads commentary.
 */

export interface LiveMatch {
  id: number
  status: string
  minute: number | null
  league: { id: number; name: string; logo: string; country: string }
  home: { id: number; name: string; logo: string; goals: number | null }
  away: { id: number; name: string; logo: string; goals: number | null }
}

interface CopilotState {
  xg: { home: number | null; away: number | null }
  shots: { home: number | null; away: number | null }
  // Possession sometimes appears in `currentState` from the route, but isn't
  // in the published type. Defensive any here — we just display the number.
  possession?: { home: number | null; away: number | null } | null
}

interface Props {
  match: LiveMatch
  /** Parent opens the LiveCoPilot drawer with this fixture id. */
  onWatchWithAI: (match: LiveMatch) => void
}

export default function LiveMatchCard({ match, onWatchWithAI }: Props) {
  const [commentary, setCommentary] = useState<string | null>(null)
  const [coState, setCoState] = useState<CopilotState | null>(null)

  // Background poll the live-copilot endpoint for stats + latest line.
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/live-copilot?fixtureId=${match.id}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data.currentState) setCoState(data.currentState as CopilotState)
        if (data.status === 'speaking' && data.commentary) {
          setCommentary(data.commentary as string)
        }
      } catch {
        // Silent — the card is still useful without commentary.
      }
    }

    load()
    const id = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [match.id])

  const homeGoals = match.home.goals ?? 0
  const awayGoals = match.away.goals ?? 0

  // Build a clean stat strip — only show what the API actually gave us.
  const statBits: string[] = []
  if (coState?.xg && (coState.xg.home != null || coState.xg.away != null)) {
    statBits.push(`xG ${coState.xg.home ?? '—'} / ${coState.xg.away ?? '—'}`)
  }
  if (coState?.shots && (coState.shots.home != null || coState.shots.away != null)) {
    statBits.push(`Shots ${coState.shots.home ?? '—'} / ${coState.shots.away ?? '—'}`)
  }
  if (
    coState?.possession &&
    (coState.possession.home != null || coState.possession.away != null)
  ) {
    statBits.push(
      `Poss ${coState.possession.home ?? '—'}% / ${coState.possession.away ?? '—'}%`
    )
  }

  return (
    <article className="bg-bg-surface border border-border-subtle rounded-2xl p-5 hover:border-border-strong transition-colors duration-200">
      {/* Eyebrow row — LIVE pulse + league + minute */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Pulsing red dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
          </span>
          <span className="text-live text-[10px] font-bold uppercase tracking-[0.18em]">LIVE</span>
          <span className="text-fg-muted text-[10px] font-bold uppercase tracking-[0.18em] truncate">
            · {match.league.name}
          </span>
        </div>
        <span className="font-stat text-fg-muted text-[11px] font-semibold whitespace-nowrap">
          {match.minute != null ? `${match.minute}'` : match.status}
        </span>
      </div>

      {/* Score row */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {match.home.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.home.logo} alt={match.home.name} className="w-8 h-8 object-contain shrink-0" />
          )}
          <span className="text-fg font-bold text-sm md:text-base truncate">{match.home.name}</span>
        </div>

        <div className="font-stat text-3xl md:text-4xl font-black text-brand tabular-nums px-3 shrink-0 leading-none">
          {homeGoals}
          <span className="text-fg-muted px-2">–</span>
          {awayGoals}
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-0 justify-end text-right">
          <span className="text-fg font-bold text-sm md:text-base truncate">{match.away.name}</span>
          {match.away.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.away.logo} alt={match.away.name} className="w-8 h-8 object-contain shrink-0" />
          )}
        </div>
      </div>

      {/* Stats row — only when SofaScore-backed live data is available */}
      {statBits.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 pb-4 border-b border-border-subtle">
          {statBits.map((bit) => (
            <span key={bit} className="font-stat text-fg-secondary text-[11px]">
              {bit}
            </span>
          ))}
        </div>
      )}

      {/* AI commentary line */}
      {commentary ? (
        <p className="text-fg-secondary text-sm leading-relaxed italic mb-4">
          <span className="text-brand not-italic font-semibold">AI: </span>
          {commentary}
        </p>
      ) : (
        <p className="text-fg-muted text-xs italic mb-4">
          AI is watching — open the co-pilot for live commentary.
        </p>
      )}

      {/* Action */}
      <button
        type="button"
        onClick={() => onWatchWithAI(match)}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-bg-base font-bold py-2 px-4 rounded-lg text-sm transition-all duration-200"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Watch with AI
      </button>
    </article>
  )
}
