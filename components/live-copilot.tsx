'use client'

import { useEffect, useRef, useState } from 'react'

type CurrentState = {
  minute: number | null
  status: string | null
  score: { home: number | null; away: number | null }
  teams: { home: string; away: string; homeLogo?: string; awayLogo?: string }
  league: string
  xg: { home: number | null; away: number | null }
  shots: { home: number | null; away: number | null }
  odds: { home: number | null; draw: number | null; away: number | null }
}

type Message = {
  id: string
  text: string
  at: number
  reason?: string
}

type Props = {
  fixtureId: number | string
  open: boolean
  onClose: () => void
  initialTeams?: { home: string; away: string }
}

export default function LiveCoPilot({ fixtureId, open, onClose, initialTeams }: Props) {
  const [state, setState] = useState<CurrentState | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seenRef = useRef<Set<string>>(new Set())

  async function poll() {
    try {
      setPolling(true)
      const res = await fetch(`/api/live-copilot?fixtureId=${fixtureId}`, { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || `Error ${res.status}`)
        return
      }
      setError(null)
      const data = await res.json()
      if (data.currentState) setState(data.currentState)
      if (data.status === 'speaking' && data.commentary) {
        const sig = data.commentary.slice(0, 80)
        if (!seenRef.current.has(sig)) {
          seenRef.current.add(sig)
          setMessages((prev) => [
            { id: `${Date.now()}-${Math.random()}`, text: data.commentary, at: Date.now(), reason: data.reason },
            ...prev,
          ])
        }
      }
    } catch (e: any) {
      setError(e.message || 'Network error')
    } finally {
      setPolling(false)
    }
  }

  useEffect(() => {
    if (!open) return
    // Reset state for a fresh fixture
    seenRef.current = new Set()
    setMessages([])
    setState(null)
    poll()
    const id = setInterval(poll, 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixtureId])

  if (!open) return null

  const homeName = state?.teams.home || initialTeams?.home || 'Home'
  const awayName = state?.teams.away || initialTeams?.away || 'Away'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        aria-hidden
      />

      {/* Drawer (right on desktop, bottom sheet on mobile) */}
      <div
        className="
          fixed z-[51] bg-[#0A0F1E] border-white/10 text-white shadow-2xl
          flex flex-col
          inset-x-0 bottom-0 top-auto h-[85vh] rounded-t-2xl border-t
          lg:inset-y-0 lg:right-0 lg:left-auto lg:top-0 lg:h-full lg:w-[420px] lg:rounded-none lg:border-l lg:border-t-0
        "
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                AI is watching
              </span>
              {polling && <span className="text-[10px] text-white/30">syncing…</span>}
            </div>
            <div className="text-sm font-bold text-white truncate">
              {homeName} <span className="text-white/40">vs</span> {awayName}
            </div>
            {state && (
              <div className="text-[11px] text-white/40 mt-0.5 truncate">
                {state.league} · {state.status} {state.minute !== null ? `${state.minute}'` : ''}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Score block */}
        {state && (
          <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <div className="flex-1 text-center">
                <div className="text-[11px] text-white/50 truncate">{homeName}</div>
                <div className="text-3xl font-black text-white mt-1">{state.score.home ?? 0}</div>
              </div>
              <div className="text-white/30 text-xs px-3">—</div>
              <div className="flex-1 text-center">
                <div className="text-[11px] text-white/50 truncate">{awayName}</div>
                <div className="text-3xl font-black text-white mt-1">{state.score.away ?? 0}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
              <Stat label="xG" home={state.xg.home} away={state.xg.away} fmt={(v) => v?.toFixed(2) ?? '–'} />
              <Stat label="Shots" home={state.shots.home} away={state.shots.away} fmt={(v) => String(v ?? '–')} />
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2">
                <div className="text-white/40 uppercase tracking-wider mb-1 text-center">Odds</div>
                <div className="text-center text-white/80 font-semibold">
                  {state.odds.home ?? '–'} / {state.odds.draw ?? '–'} / {state.odds.away ?? '–'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Commentary feed */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {error && (
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
              {error}
            </div>
          )}
          {messages.length === 0 && !error && (
            <div className="text-center py-12">
              <div className="text-white/20 text-xs mb-2">Listening for the next moment…</div>
              <div className="text-white/40 text-[11px]">
                The AI stays quiet unless something genuinely shifts.
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl bg-blue-500/5 border border-blue-500/20 p-3 text-sm text-white/90 leading-snug"
            >
              <div className="text-[10px] uppercase tracking-widest text-blue-300/80 mb-1.5 flex items-center justify-between">
                <span>Co-Pilot</span>
                <span className="text-white/30 normal-case tracking-normal">
                  {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {m.reason && ` · ${m.reason}`}
                </span>
              </div>
              {m.text}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-white/10 text-[10px] text-white/30 text-center">
          Updates every 60 seconds. AI speaks only on material changes.
        </div>
      </div>
    </>
  )
}

function Stat({
  label,
  home,
  away,
  fmt,
}: {
  label: string
  home: number | null
  away: number | null
  fmt: (v: number | null) => string
}) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2">
      <div className="text-white/40 uppercase tracking-wider mb-1 text-center">{label}</div>
      <div className="text-center text-white/80 font-semibold">
        {fmt(home)} <span className="text-white/30">·</span> {fmt(away)}
      </div>
    </div>
  )
}
