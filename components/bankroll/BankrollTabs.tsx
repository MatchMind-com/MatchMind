'use client'

import { useState } from 'react'
import BankrollTracker from './BankrollTracker'
import GoalTracker from './GoalTracker'

interface Props {
  userId: string
  initialBankroll: number
  startingBankroll: number
  lossLimit?: number | null
}

type Tab = 'tracker' | 'goal'

export default function BankrollTabs({
  userId,
  initialBankroll,
  startingBankroll,
  lossLimit,
}: Props) {
  const [tab, setTab] = useState<Tab>('tracker')

  return (
    <div>
      <div className="inline-flex bg-white/[0.04] border border-white/[0.08] p-1 mb-5">
        <TabButton active={tab === 'tracker'} onClick={() => setTab('tracker')}>
          Bankroll
        </TabButton>
        <TabButton active={tab === 'goal'} onClick={() => setTab('goal')}>
          Goal Tracker
        </TabButton>
      </div>

      {tab === 'tracker' ? (
        <BankrollTracker
          userId={userId}
          initialBankroll={initialBankroll}
          startingBankroll={startingBankroll}
          lossLimit={lossLimit}
        />
      ) : (
        <GoalTracker suggestedStartingBankroll={initialBankroll} />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all ${
        active
          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
          : 'text-white/50 hover:text-white/80'
      }`}
    >
      {children}
    </button>
  )
}
