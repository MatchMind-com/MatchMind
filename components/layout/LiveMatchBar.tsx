'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

// Lazy-load the LiveCoPilot drawer so this bar stays cheap to mount.
const LiveCoPilot = dynamic(() => import('@/components/live-copilot'), { ssr: false })

type LiveMatch = {
  id: number
  status: string | null
  minute: number | null
  league: { id?: number; name: string; logo?: string; country?: string }
  home: { id?: number; name: string; logo?: string; goals: number | null }
  away: { id?: number; name: string; logo?: string; goals: number | null }
}

const POLL_MS = 30_000
const STORAGE_KEY = 'mm_live_bar_dismissed_until'
const DISMISS_HOURS = 1

function isDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const until = Number(raw)
    if (!Number.isFinite(until)) return false
    return Date.now() < until
  } catch {
    return false
  }
}

function setDismissed() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + DISMISS_HOURS * 60 * 60 * 1000))
  } catch {
    /* ignore quota errors */
  }
}

function CloseIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function LiveMatchBar() {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [loaded, setLoaded] = useState(false)
  const [dismissed, setLocalDismissed] = useState(true) // pessimistic until we read storage on mount
  const [openFixture, setOpenFixture] = useState<{ id: number; home: string; away: string } | null>(null)
  const seenIdsRef = useRef<Set<number>>(new Set())
  const [hasNewMatch, setHasNewMatch] = useState(false)

  // Initialize dismissed state on mount (client-only)
  useEffect(() => {
    setLocalDismissed(isDismissed())
  }, [])

  const fetchLive = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/fixtures/live', { cache: 'no-store', signal })
      if (!res.ok) return
      const data = await res.json()
      const list: LiveMatch[] = Array.isArray(data?.matches) ? data.matches : []
      // Detect newly-arrived matches so we can re-trigger the slide-in animation.
      const incomingIds = new Set(list.map((m) => m.id))
      let foundNew = false
      for (const id of incomingIds) {
        if (!seenIdsRef.current.has(id)) foundNew = true
      }
      seenIdsRef.current = incomingIds
      setMatches(list)
      setLoaded(true)
      if (foundNew && list.length > 0) {
        setHasNewMatch(true)
        setTimeout(() => setHasNewMatch(false), 400)
      }
    } catch {
      /* swallow — bar is non-critical */
    }
  }, [])

  useEffect(() => {
    if (dismissed) return
    const ctrl = new AbortController()
    fetchLive(ctrl.signal)
    const id = setInterval(() => fetchLive(), POLL_MS)
    return () => {
      ctrl.abort()
      clearInterval(id)
    }
  }, [dismissed, fetchLive])

  const visible = useMemo(
    () => matches.filter((m) => typeof m.id === 'number' && m.home?.name && m.away?.name),
    [matches],
  )

  // Hide if dismissed, no live games, or still loading the first time with nothing
  if (dismissed) return null
  if (loaded && visible.length === 0) return null
  if (!loaded) return null

  return (
    <>
      <div
        className={`sticky top-14 lg:top-0 z-20 h-9 bg-bg-elevated/95 backdrop-blur-xl border-b border-border-subtle
                    flex items-stretch overflow-hidden ${hasNewMatch ? 'animate-slide-down' : ''}`}
        role="status"
        aria-label="Live football matches"
      >
        {/* LIVE label */}
        <div className="flex items-center gap-2 px-4 border-r border-border-subtle bg-bg-base/40 flex-shrink-0">
          <span className="live-dot" aria-hidden />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-live">Live</span>
        </div>

        {/* Scrolling track */}
        <div className="flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="live-bar-track h-full px-4">
            {visible.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setOpenFixture({ id: m.id, home: m.home.name, away: m.away.name })}
                className="group inline-flex items-center gap-2 text-[12px] hover:text-fg transition-colors flex-shrink-0"
                title={`${m.league.name} — ${m.home.name} vs ${m.away.name}`}
              >
                <span className="text-fg font-semibold whitespace-nowrap">
                  {m.home.name}
                </span>
                <span className="font-mono font-bold text-brand whitespace-nowrap tabular-nums">
                  {m.home.goals ?? 0}-{m.away.goals ?? 0}
                </span>
                <span className="text-fg font-semibold whitespace-nowrap">
                  {m.away.name}
                </span>
                {m.minute !== null && m.minute !== undefined && (
                  <span className="font-mono text-fg-muted whitespace-nowrap tabular-nums">
                    {m.minute}{`'`}
                  </span>
                )}
                {i < visible.length - 1 && (
                  <span className="text-border-strong px-1 select-none" aria-hidden>
                    ·
                  </span>
                )}
              </button>
            ))}
            {visible.length > 0 && (
              <a
                href="/dashboard/live"
                className="inline-flex items-center gap-1 text-[11px] text-fg-secondary hover:text-brand font-semibold whitespace-nowrap pl-2 transition-colors"
              >
                All live
                <ChevronRight />
              </a>
            )}
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => {
            setDismissed()
            setLocalDismissed(true)
          }}
          className="flex items-center justify-center px-3 border-l border-border-subtle text-fg-muted hover:text-fg hover:bg-bg-surface transition-colors flex-shrink-0"
          aria-label="Hide live bar for an hour"
          title="Hide for 1 hour"
        >
          <CloseIcon />
        </button>
      </div>

      {/* LiveCoPilot drawer when a match is selected */}
      {openFixture && (
        <LiveCoPilot
          fixtureId={openFixture.id}
          open={!!openFixture}
          onClose={() => setOpenFixture(null)}
          initialTeams={{ home: openFixture.home, away: openFixture.away }}
        />
      )}
    </>
  )
}
