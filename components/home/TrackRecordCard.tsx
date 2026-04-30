'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * TrackRecordCard — tiny home-page summary of the SITE'S public track
 * record (wins/losses across every AI prediction we've ever published).
 *
 * Distinct from the user's PERSONAL bet history (which lives on Money →
 * My Bets). This is the "is this AI any good?" credibility surface.
 *
 * Pulls /api/track-record. Cached server-side for 1h. Shows headline
 * win-rate / ROI / hit count plus the latest N settled picks. "Full
 * track record →" link opens /dashboard/track-record for the deep view.
 */

interface TrackRecordSummary {
  stats: {
    total: number
    wins: number
    losses: number
    voids: number
    winRate: number
    roi: number
    totalProfit: number
    avgOdds: number
  } | null
  recent: Array<{
    id: number | string
    home_team?: string
    away_team?: string
    bet_type?: string
    selection?: string
    odds?: number
    result?: 'win' | 'loss' | 'void'
    match_date?: string
    league?: string
  }>
}

export default function TrackRecordCard() {
  const [data, setData] = useState<TrackRecordSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/track-record', { cache: 'no-store' })
        if (!res.ok) throw new Error()
        const json = await res.json()
        if (cancelled) return
        setData({
          stats: json.stats,
          recent: Array.isArray(json.recent) ? json.recent.slice(0, 5) : [],
        })
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-3 w-32 bg-bg-elevated rounded mb-4" />
        <div className="h-12 w-24 bg-bg-elevated rounded mb-3" />
        <div className="h-3 w-40 bg-bg-elevated rounded mb-5" />
        <div className="space-y-2">
          <div className="h-8 w-full bg-bg-elevated rounded" />
          <div className="h-8 w-full bg-bg-elevated rounded" />
          <div className="h-8 w-full bg-bg-elevated rounded" />
        </div>
      </div>
    )
  }

  if (error || !data || !data.stats) {
    return (
      <div className="card">
        <p className="eyebrow">Site track record</p>
        <p className="text-fg-muted text-sm mt-3">
          Couldn&apos;t load track record stats right now.
        </p>
      </div>
    )
  }

  const s = data.stats
  const settled = s.wins + s.losses
  const profitPositive = s.totalProfit >= 0

  return (
    <div className="card flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p className="eyebrow">Site track record</p>
        <Link
          href="/dashboard/track-record"
          className="text-fg-muted hover:text-brand text-[10px] font-bold uppercase tracking-wider transition-colors"
        >
          Full record →
        </Link>
      </div>

      {/* Headline win-rate */}
      <div className="flex items-baseline gap-3 mb-1">
        <p className="font-stat text-fg text-4xl md:text-5xl font-bold leading-none tracking-tight">
          {s.winRate}%
        </p>
        <span className="text-fg-muted text-xs font-stat">win rate</span>
      </div>
      <p className="text-fg-secondary text-[12px] mb-4">
        <span className="text-success font-bold">{s.wins}W</span>{' '}
        <span className="text-loss font-bold">{s.losses}L</span>
        {s.voids > 0 && <span className="text-fg-muted"> · {s.voids}V</span>}
        <span className="text-fg-muted"> · {settled} settled</span>
      </p>

      {/* Headline numbers row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-bg-base/50 border border-border-subtle p-2.5">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">ROI</p>
          <p className={`font-stat text-base font-bold tabular-nums leading-tight ${profitPositive ? 'text-success' : 'text-loss'}`}>
            {profitPositive ? '+' : ''}{s.roi}%
          </p>
        </div>
        <div className="rounded-lg bg-bg-base/50 border border-border-subtle p-2.5">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">Avg odds</p>
          <p className="font-stat text-fg text-base font-bold tabular-nums leading-tight">
            {s.avgOdds.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Recent picks list */}
      {data.recent.length > 0 && (
        <div className="mt-auto">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-2">Latest results</p>
          <ul className="space-y-1">
            {data.recent.slice(0, 4).map((r) => {
              const isWin = r.result === 'win'
              const isLoss = r.result === 'loss'
              const home = r.home_team ?? '—'
              const away = r.away_team ?? '—'
              return (
                <li key={String(r.id)} className="flex items-center gap-2 py-1 text-[11px]">
                  <span
                    className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                      isWin ? 'bg-success' : isLoss ? 'bg-loss' : 'bg-fg-muted/40'
                    }`}
                    aria-hidden
                  />
                  <span className="text-fg-secondary flex-1 min-w-0 truncate">
                    {home} v {away}
                  </span>
                  {r.odds != null && (
                    <span className="font-stat text-fg-muted text-[10px] tabular-nums shrink-0">
                      @{r.odds.toFixed(2)}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
