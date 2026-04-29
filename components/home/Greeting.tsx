'use client'

import { useEffect, useState } from 'react'

interface Props {
  firstName: string
  liveCount?: number
  picksCount?: number
  goalProgressPct?: number | null
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDateLine(d: Date): string {
  // "WEDNESDAY · APRIL 29"
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase()
  const month = d.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase()
  const day = d.getDate()
  return `${weekday} · ${month} ${day}`
}

/**
 * Editorial greeting: small-caps date eyebrow, big warm greeting,
 * one-line summary of the user's day.
 */
export default function Greeting({ firstName, liveCount, picksCount, goalProgressPct }: Props) {
  // Hydration-safe — render the date on the client to avoid SSR mismatch
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])

  const hour = now?.getHours() ?? 12
  const greeting = getGreeting(hour)
  const dateLine = now ? formatDateLine(now) : ''

  // Build the summary line — only mention what's actually present
  const parts: string[] = []
  if (typeof liveCount === 'number' && liveCount > 0) {
    parts.push(`${liveCount} live match${liveCount === 1 ? '' : 'es'}`)
  }
  if (typeof picksCount === 'number' && picksCount > 0) {
    parts.push(`${picksCount} pick${picksCount === 1 ? '' : 's'} today`)
  }
  if (typeof goalProgressPct === 'number') {
    parts.push(`${Math.round(goalProgressPct)}% to your goal`)
  }
  const summary = parts.length > 0 ? parts.join(' · ') : 'A quiet day. Browse the news while we wait for kickoff.'

  return (
    <header className="space-y-2">
      <p className="eyebrow min-h-[14px]">{dateLine || ' '}</p>
      <h1 className="headline-xl text-fg">
        {greeting}, <span className="text-brand">{firstName}</span>
      </h1>
      <p className="text-fg-secondary text-sm md:text-base">{summary}</p>
    </header>
  )
}
