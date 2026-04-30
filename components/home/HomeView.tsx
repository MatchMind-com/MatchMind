'use client'

import { useState } from 'react'
import Greeting from '@/components/home/Greeting'
import BankrollHero from '@/components/home/BankrollHero'
import GoalRing from '@/components/home/GoalRing'
import TodaysEdgeCarousel from '@/components/home/TodaysEdgeCarousel'
import LiveTicker from '@/components/home/LiveTicker'
import NewsHeadlines from '@/components/home/NewsHeadlines'
import MyLiveBets from '@/components/home/MyLiveBets'

interface Props {
  firstName: string
}

/**
 * HomeView — assembles the magazine-style command center.
 * Lives client-side because each row fetches its own data and
 * a few of them feed live counters into the greeting.
 */
export default function HomeView({ firstName }: Props) {
  const [liveCount, setLiveCount] = useState<number>(0)
  const [picksCount, setPicksCount] = useState<number>(0)
  const [goalProgress, setGoalProgress] = useState<number | null>(null)

  return (
    <main className="max-w-6xl mx-auto px-5 lg:px-8 py-6 lg:py-10 space-y-8 lg:space-y-10">
      <Greeting
        firstName={firstName}
        liveCount={liveCount}
        picksCount={picksCount}
        goalProgressPct={goalProgress}
      />

      {/* Row 1 — Money + Goal */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <BankrollHero />
        </div>
        <div className="lg:col-span-2">
          <GoalRing onProgressChange={setGoalProgress} />
        </div>
      </section>

      {/* Row 1.5 — User's currently active bets (live + today) with quick "+ New bet" CTA */}
      <MyLiveBets />

      {/* Row 2 — Today's Edge */}
      <TodaysEdgeCarousel onPicksCount={setPicksCount} />

      {/* Row 3 — Live + News */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <LiveTicker onLiveCount={setLiveCount} />
        </div>
        <div className="lg:col-span-2">
          <NewsHeadlines />
        </div>
      </section>
    </main>
  )
}
