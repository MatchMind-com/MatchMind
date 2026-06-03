'use client'

import { useEffect, useState } from 'react'
import LiveCoPilot from '@/components/live-copilot'

type LiveMatch = {
  id: number
  status: string
  minute: number | null
  league: { id: number; name: string; logo: string; country: string }
  home: { id: number; name: string; logo: string; goals: number | null }
  away: { id: number; name: string; logo: string; goals: number | null }
}

export default function LiveMatchesPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openFixture, setOpenFixture] = useState<LiveMatch | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/fixtures/live', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load')
      } else {
        setMatches(data.matches || [])
        setError(null)
      }
    } catch (e: any) {
      setError(e.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <main className="min-h-screen bg-[#0A0F1E] text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Live Matches</h1>
            <p className="text-sm text-white/50 mt-1">
              In-play games right now. Tap <span className="text-blue-300 font-semibold">Watch with AI</span> to open the Co-Pilot.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
          </div>
        </div>

        {loading && (
          <div className="text-center py-16 text-white/40 text-sm">Loading live matches…</div>
        )}

        {error && !loading && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className="bg-white/[0.03] border border-white/10 p-8 text-center">
            <div className="text-white/60 text-sm font-semibold mb-1">No matches in play right now.</div>
            <div className="text-white/30 text-xs">Check back later — the Co-Pilot only works on live games.</div>
          </div>
        )}

        <div className="grid gap-3">
          {matches.map((m) => (
            <div
              key={m.id}
              className="bg-white/[0.03] border border-white/10 p-4 hover:bg-white/[0.05] transition"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {m.league.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.league.logo} alt="" className="w-4 h-4 object-contain" />
                  )}
                  <span className="text-[11px] text-white/50 truncate">{m.league.country} · {m.league.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  {m.status} {m.minute !== null ? `${m.minute}'` : ''}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {m.home.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.home.logo} alt="" className="w-6 h-6 object-contain" />
                  )}
                  <span className="text-sm font-semibold text-white truncate">{m.home.name}</span>
                </div>
                <div className="text-xl font-black text-white tabular-nums px-2">
                  {m.home.goals ?? 0} <span className="text-white/30">–</span> {m.away.goals ?? 0}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-sm font-semibold text-white truncate text-right">{m.away.name}</span>
                  {m.away.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.away.logo} alt="" className="w-6 h-6 object-contain" />
                  )}
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setOpenFixture(m)}
                  className="px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-200 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Watch with AI
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {openFixture && (
        <LiveCoPilot
          fixtureId={openFixture.id}
          open={!!openFixture}
          onClose={() => setOpenFixture(null)}
          initialTeams={{ home: openFixture.home.name, away: openFixture.away.name }}
        />
      )}
    </main>
  )
}
