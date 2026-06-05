/**
 * <TrackRecordBadge />
 *
 * Trust-signal strip embedded in every WC SEO page. Pulls live track-
 * record stats from /api/track-record (1h ISR) and renders 3 numbers:
 * total picks tracked, win rate, ROI. Color-codes ROI green/red.
 *
 * Used by /world-cup/teams/[team], /world-cup/groups/[group], and
 * /world-cup/fixtures/[id] — each page shows the same source-of-truth
 * proof line under their hero.
 *
 * Server component — fetches at render time, no client JS.
 */

import Link from 'next/link'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

interface TrackStats {
  total: number
  wins: number
  winRate: number
  roi: number
  valueBets?: { total: number; winRate: number }
}

async function fetchTrackRecord(): Promise<TrackStats | null> {
  try {
    const res = await fetch(`${APP_URL}/api/track-record`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return (await res.json()).stats as TrackStats
  } catch {
    return null
  }
}

export default async function TrackRecordBadge() {
  const stats = await fetchTrackRecord()
  if (!stats || stats.total < 10) return null   // hide on cold-start / sparse data

  const profitPositive = stats.roi >= 0
  const winRate = stats.valueBets?.winRate ?? stats.winRate

  return (
    <Link
      href="/track-record"
      className="block border border-border-subtle bg-bg-surface hover:border-border-strong transition-colors p-4 md:p-5 mb-8 no-underline"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 flex-wrap">
          <div>
            <p className="font-stat text-fg text-2xl font-black tabular-nums leading-none">
              {stats.total}
            </p>
            <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mt-1">
              picks tracked
            </p>
          </div>
          <div className="w-px h-9 bg-border-subtle" aria-hidden />
          <div>
            <p className="font-stat text-success text-2xl font-black tabular-nums leading-none">
              {winRate}%
            </p>
            <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mt-1">
              value-bet win rate
            </p>
          </div>
          <div className="w-px h-9 bg-border-subtle" aria-hidden />
          <div>
            <p
              className={`font-stat text-2xl font-black tabular-nums leading-none ${
                profitPositive ? 'text-success' : 'text-loss'
              }`}
            >
              {profitPositive ? '+' : ''}{stats.roi.toFixed(1)}%
            </p>
            <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mt-1">
              ROI
            </p>
          </div>
        </div>
        <span className="text-brand text-[11px] font-bold uppercase tracking-[0.12em] hover:underline">
          see full record →
        </span>
      </div>
    </Link>
  )
}
