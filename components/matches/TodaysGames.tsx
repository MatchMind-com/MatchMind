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
      className={`flex-shrink-0 w-52 border transition-all duration-200 hover:scale-[1.02] hover:border-white/20 cursor-pointer text-left overflow-hidden group
        ${isLive ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-white/8 bg-[#161B26]'}
        ${fixture.isFavouriteTeam ? 'ring-1 ring-orange-500/40' : ''}
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
          <span className="ml-auto text-[9px] text-orange-300 font-bold">★ FAV</span>
        )}
      </div>

      {/* Match content */}
      <div className="p-3">
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

        <div className="flex items-center justify-between">
          {isLive ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse" />
              {fixture.status === 'HT' ? 'HT' : `${fixture.elapsed}'`}
            </span>
          ) : isFinished ? (
            <span className="text-[10px] text-white/30 font-medium">FT</span>
          ) : (
            <span className="text-[11px] text-white/50 font-medium">{kickoff}</span>
          )}
          <span className="text-[10px] text-white/20 group-hover:text-orange-400 transition-colors">
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
  const [activeDay, setActiveDay] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/fixtures/today')
      .then(r => r.json())
      .then(data => {
        const fx: Fixture[] = data.fixtures || []
        setFixtures(fx)
        // Default to first day that has games
        if (fx.length > 0) {
          const firstDay = fx[0].matchDay
          setActiveDay(firstDay)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="flex gap-2 mb-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-8 w-24 bg-white/5 animate-pulse" />)}
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-52 h-28 bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (fixtures.length === 0) {
    return (
      <div className="mb-6 p-4 border border-white/8 bg-[#161B26] text-center">
        <p className="text-white/30 text-sm">No matches scheduled in the next few days</p>
      </div>
    )
  }

  // Build ordered day list
  const dayOrder: string[] = []
  const dayMap = new Map<string, Fixture[]>()
  for (const f of fixtures) {
    const label = f.matchDay || 'Upcoming'
    if (!dayMap.has(label)) {
      dayOrder.push(label)
      dayMap.set(label, [])
    }
    dayMap.get(label)!.push(f)
  }

  const currentDay = activeDay ?? dayOrder[0]
  const visibleFixtures = dayMap.get(currentDay) ?? []

  // Count live games for "Today" tab badge
  const liveCount = (dayMap.get('Today') ?? []).filter(f =>
    ['1H', '2H', 'ET', 'HT', 'LIVE'].includes(f.status)
  ).length

  return (
    <>
      <div className="mb-6">
        {/* Header + date tabs on one row */}
        <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">Matches</h2>
            <span className="text-[10px] text-white/25 font-medium">{visibleFixtures.length} games</span>
          </div>

          {/* Date filter tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {dayOrder.map(day => {
              const count = dayMap.get(day)!.length
              const isActive = currentDay === day
              const isToday = day === 'Today'
              const hasLive = isToday && liveCount > 0

              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
                      : 'bg-white/[0.04] border border-white/[0.07] text-white/40 hover:text-white/70 hover:bg-white/[0.07]'
                  }`}
                >
                  {day}
                  {hasLive ? (
                    <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse" />
                      {liveCount}
                    </span>
                  ) : (
                    <span className={`text-[10px] font-bold ${isActive ? 'text-orange-400/60' : 'text-white/20'}`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Fixtures row */}
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {visibleFixtures.map(fixture => (
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
