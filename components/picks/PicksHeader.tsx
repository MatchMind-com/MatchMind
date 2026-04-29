'use client'

/**
 * PicksHeader — editorial top-of-page block for /dashboard/picks.
 *
 * Renders the eyebrow ("PICKS · N LIVE TODAY"), the big confident headline,
 * and a one-line summary describing where the value is. Mirrors the home
 * page's <Greeting /> visual rhythm (eyebrow → headline-xl → secondary line).
 *
 * Pure presentational — all numbers are passed in by the parent which owns
 * the prediction/live data.
 */

interface Props {
  /** Number of currently in-play matches — drives the eyebrow count. */
  liveCount?: number
  /** Number of value picks across all dates today. */
  todayPicksCount?: number
  /** Distinct league count present in today's picks. */
  todayLeagueCount?: number
  /** Top 2-3 league short labels (e.g. ["UCL", "PL", "La Liga"]) for the summary. */
  topLeagueLabels?: string[]
}

export default function PicksHeader({
  liveCount = 0,
  todayPicksCount = 0,
  todayLeagueCount = 0,
  topLeagueLabels = [],
}: Props) {
  // Eyebrow: prefer live count when there are live matches, else fall back to today picks.
  const eyebrowCount =
    liveCount > 0
      ? `${liveCount} LIVE NOW`
      : todayPicksCount > 0
      ? `${todayPicksCount} TODAY`
      : 'TODAY'

  // Subhead — only mention what we actually know about. Avoids vanity copy.
  let summary = 'AI is scanning fixtures across the tracked competitions — check back in a moment.'
  if (todayPicksCount > 0) {
    const leagueText =
      topLeagueLabels.length > 0
        ? topLeagueLabels.slice(0, 3).join(', ')
        : `${todayLeagueCount} league${todayLeagueCount === 1 ? '' : 's'}`
    summary = `Today: ${todayPicksCount} +EV pick${todayPicksCount === 1 ? '' : 's'} across ${leagueText}.`
  } else if (liveCount > 0) {
    summary = `${liveCount} match${liveCount === 1 ? '' : 'es'} in play. Tap Live for AI commentary as it happens.`
  }

  return (
    <header className="space-y-2">
      <p className="eyebrow">PICKS · {eyebrowCount}</p>
      <h1 className="headline-xl text-fg">
        AI&apos;s edge across <span className="text-brand">25 leagues</span>
      </h1>
      <p className="text-fg-secondary text-sm md:text-base">{summary}</p>
    </header>
  )
}
