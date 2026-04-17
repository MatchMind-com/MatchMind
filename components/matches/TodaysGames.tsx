'use client'
import { useEffect, useState } from 'react'
import MatchDetailModal from './MatchDetailModal'

interface Fixture {
  id: number
  date: string
  matchDay: string
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
          {isLive ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {fixture.status === 'HT' ? 'HT' : `${fixture.elapsed}'`}
            </span>
          ) : isFinished ? (
            <span className="text-[10px] text-slate-500 font-medium">FT</span>
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
        <p className="text-slate-500 text-sm">No matches scheduled in the next 3 days</p>
      </div>
    )
  }

  // Group fixtures by matchDay label
  const grouped: { label: string; fixtures: Fixture[] }[] = []
  const seen = new Map<string, number>()
  for (const f of fixtures) {
    const label = f.matchDay || 'Upcoming'
    if (!seen.has(label)) {
      seen.set(label, grouped.length)
      grouped.push({ label, fixtures: [] })
    }
    grouped[seen.get(label)!].fixtures.push(f)
  }

  return (
    <>
      <div className="mb-6 space-y-4">
        {grouped.map(({ label, fixtures: dayFixtures }) => (
          <div key={label}>
            {/* Day header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">{label === 'Today' ? "Today's Matches" : label}</h2>
                <span className="text-[10px] text-slate-600 font-medium">{dayFixtures.length} games</span>
              </div>
              {label === 'Today' && (
                <span className="text-xs text-slate-500">Click any match for full analysis</span>
              )}
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {dayFixtures.map(fixture => (
                <MatchCard
                  key={fixture.id}
                  fixture={fixture}
                  onClick={() => setSelectedFixtureId(fixture.id)}
                />
              ))}
            </div>
          </div>
        ))}
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
