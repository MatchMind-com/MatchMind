'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import LiveCoPilot from '@/components/live-copilot'

interface LiveMatch {
  id: number
  status: string
  minute: number | null
  league: { id: number; name: string; logo: string; country: string }
  home: { id: number; name: string; logo: string; goals: number | null }
  away: { id: number; name: string; logo: string; goals: number | null }
}

interface UpcomingFixture {
  id: number
  date: string
  home: { name: string; logo: string }
  away: { name: string; logo: string }
  league: { name: string }
}

interface Props {
  onLiveCount?: (n: number) => void
}

function fmtKickoff(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function relativeKickoff(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = Date.now()
  const diff = d.getTime() - now
  const mins = Math.round(diff / 60000)
  if (mins < 0) return 'in progress'
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `in ${hrs}h`
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function MatchRow({ m, onClick }: { m: LiveMatch; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated/60 transition-colors text-left rounded-lg group"
    >
      {/* Live dot */}
      <span className="live-dot shrink-0" />

      {/* Home */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="text-fg text-sm font-semibold truncate">{m.home.name}</span>
        {m.home.logo && (
          <Image src={m.home.logo} alt="" width={18} height={18} unoptimized className="shrink-0" />
        )}
      </div>

      {/* Score */}
      <div className="font-stat text-brand text-base font-bold shrink-0 px-2 tabular-nums">
        {m.home.goals ?? 0} – {m.away.goals ?? 0}
      </div>

      {/* Away */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {m.away.logo && (
          <Image src={m.away.logo} alt="" width={18} height={18} unoptimized className="shrink-0" />
        )}
        <span className="text-fg text-sm font-semibold truncate">{m.away.name}</span>
      </div>

      {/* Minute + league */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="font-stat text-loss text-xs font-bold tabular-nums">
          {m.minute != null ? `${m.minute}'` : m.status}
        </span>
        <span className="hidden md:inline text-fg-muted text-[11px] truncate max-w-[120px]">
          {m.league.name}
        </span>
      </div>
    </button>
  )
}

function UpcomingRow({ f }: { f: UpcomingFixture }) {
  return (
    <div className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
      <span className="font-stat text-fg-muted text-[11px] tabular-nums shrink-0 w-14">
        {fmtKickoff(f.date)}
      </span>
      <span className="text-fg text-sm truncate flex-1">
        {f.home.name} <span className="text-fg-muted">vs</span> {f.away.name}
      </span>
      <span className="text-fg-muted text-[11px] truncate hidden sm:inline shrink-0 max-w-[140px]">
        {f.league.name}
      </span>
      <span className="font-stat text-fg-muted text-[10px] shrink-0">
        {relativeKickoff(f.date)}
      </span>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * LiveTicker — current live matches, click to open Co-Pilot
 * Falls back to "next 3 kickoffs today" if no live matches.
 * ──────────────────────────────────────────────────────────── */
export default function LiveTicker({ onLiveCount }: Props) {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingFixture[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openFixture, setOpenFixture] = useState<LiveMatch | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadLive() {
      try {
        const res = await fetch('/api/fixtures/live', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setError(true)
          return
        }
        const json = await res.json()
        const list: LiveMatch[] = json.matches || []
        if (!cancelled) {
          setMatches(list)
          setError(false)
          onLiveCount?.(list.length)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function loadUpcoming() {
      try {
        const res = await fetch('/api/fixtures/today', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        const fixtures = json.fixtures || []
        // Take next 3 not-yet-started fixtures (status NS)
        const now = Date.now()
        const next = fixtures
          .filter((f: any) => f.status === 'NS' && new Date(f.date).getTime() > now)
          .slice(0, 3)
        if (!cancelled) setUpcoming(next)
      } catch {
        // silent — secondary data
      }
    }

    loadLive()
    loadUpcoming()
    const id = setInterval(loadLive, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow flex items-center gap-2">
          {matches.length > 0 && <span className="live-dot inline-flex" />}
          Live Now
        </p>
        {matches.length > 0 && (
          <Link
            href="/dashboard/live"
            className="text-fg-muted hover:text-brand text-[11px] font-medium transition-colors"
          >
            all live →
          </Link>
        )}
      </div>

      {loading && (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-bg-elevated rounded" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-fg-muted text-xs py-4">— couldn&apos;t load live matches</p>
      )}

      {!loading && !error && matches.length === 0 && (
        <div>
          <p className="text-fg-secondary text-sm mb-3">
            No live matches right now.
          </p>
          {upcoming.length > 0 ? (
            <>
              <p className="eyebrow mb-2">Next up today</p>
              <div className="-mx-4 divide-y divide-border-subtle/40">
                {upcoming.map(f => <UpcomingRow key={f.id} f={f} />)}
              </div>
            </>
          ) : (
            <p className="text-fg-muted text-xs">No more matches scheduled today.</p>
          )}
        </div>
      )}

      {!loading && !error && matches.length > 0 && (
        <div className="-mx-4 divide-y divide-border-subtle/40 max-h-[320px] overflow-y-auto">
          {matches.slice(0, 5).map(m => (
            <MatchRow key={m.id} m={m} onClick={() => setOpenFixture(m)} />
          ))}
        </div>
      )}

      {/* LiveCoPilot drawer */}
      {openFixture && (
        <LiveCoPilot
          fixtureId={openFixture.id}
          open={!!openFixture}
          onClose={() => setOpenFixture(null)}
          initialTeams={{ home: openFixture.home.name, away: openFixture.away.name }}
        />
      )}
    </section>
  )
}
