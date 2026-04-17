'use client'
import { useEffect, useState } from 'react'
import MatchDetailModal from './MatchDetailModal'

interface Fixture {
  id: number
  date: string
  status: string
  elapsed: number | null
  venue: string
  city: string
  home: { id: number; name: string; logo: string }
  away: { id: number; name: string; logo: string }
  score: { home: number | null; away: number | null }
  league: { id: number; name: string; logo: string; color: string }
  isFavouriteLeague: boolean
  isFavouriteTeam: boolean
}

function StatusBadge({ status, elapsed }: { status: string; elapsed: number | null }) {
  if (status === 'LIVE' || status === '1H' || status === '2H' || status === 'ET' || status === 'HT') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        {status === 'HT' ? 'HT' : `${elapsed}'`}
      </span>
    )
  }
  if (status === 'FT') return <span className="text-[10px] text-slate-500 font-medium">FT</span>
  if (status === 'NS') {
    const time = new Date(0)
    return <span className="text-[10px] text-slate-400 font-medium">{new Date(0).toLocaleTimeString()}</span>
  }
  return <span className="text-[10px] text-slate-500">{status}</span>
}

function MatchCard({ fixture, onClick }: { fixture: Fixture; onClick: () => void }) {
  const isLive = ['1H', '2H', 'ET', 'HT', 'LIVE'].includes(fixture.status)
  const isFinished = fixture.status === 'FT'
  const kickoff = new Date(fixture.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-52 rounded-xl border transition-all duration-200 hover:scale-[1.02] hover:border-white/20 cursor-pointer text-left overflow-hidden group
        ${isLive ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-white/8 bg-[#0E1628]'}
        ${fixture.isFavouriteTeam ? 'ring-1 ring-blue-500/40' : ''}
      `}
    >
      {/* League strip */}
      <div
        className="px-3 py-1.5 flex items-center gap-1.5"
        style={{ background: `${fixture.league.color}99` }}
      >
        {fixture.league.logo && (
          <img src={fixture.league.logo} alt="" className="w-3.5 h-3.5 object-contain" />
        )}
        <span className="text-[10px] font-semibold text-white/80 truncate">{fixture.league.name}</span>
        {fixture.isFavouriteTeam && (
          <span className="ml-auto text-[9px] text-blue-300 font-bold">★ FAV</span>
        )}
      </div>

      {/* Match content */}
      <div className="p-3">
        {/* Teams */}
        <div className="space-y-2 mb-2.5">
          {[
            { team: fixture.home, goals: fixture.score.home },
            { team: fixture.away, goals: fixture.score.away },
          ].map(({ team, goals }, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <img src={team.logo} alt={team.name} className="w-5 h-5 object-contain flex-shrink-0" />
                <span className="text-[12px] font-semibold text-white truncate">{team.name}</span>
              </div>
              {(isLive || isFinished) && goals !== null && (
                <span className={`text-[14px] font-black flex-shrink-0 ${isLive ? 'text-emerald-300' : 'text-white'}`}>
                  {goals}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Status / Kickoff */}
        <div className="flex items-center justify-between">
          {isLive || isFinished ? (
            <StatusBadge status={fixture.status} elapsed={fixture.elapsed} />
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">{kickoff}</span>
          )}
          <span className="text-[10px] text-slate-600 group-hover:text-blue-400 transition-colors">
            Analysis →
          </span>
        </div>
      </div>
    </button>
  )
}

export default function TodaysGames() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/fixtures/today')
      .then(r => r.json())
      .then(data => {
        setFixtures(data.fixtures || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
          <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-52 h-28 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (fixtures.length === 0) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-white/8 bg-[#0E1628] text-center">
        <p className="text-slate-500 text-sm">No matches scheduled today</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Today's Matches</h2>
            <p className="text-xs text-slate-500">{today} · {fixtures.length} games</p>
          </div>
          <span className="text-xs text-slate-500">Click any match for full analysis</span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {fixtures.map(fixture => (
            <MatchCard
              key={fixture.id}
              fixture={fixture}
              onClick={() => setSelectedFixtureId(fixture.id)}
            />
          ))}
        </div>
      </div>

      {selectedFixtureId && (
        <MatchDetailModal
          fixtureId={selectedFixtureId}
          onClose={() => setSelectedFixtureId(null)}
        />
      )}
    </>
  )
}
