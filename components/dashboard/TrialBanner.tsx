'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || daysLeft <= 0) return null

  const urgency = daysLeft <= 2

  return (
    <div className={`w-full px-4 py-2.5 flex items-center justify-between gap-4 text-sm
      ${urgency
        ? 'bg-amber-500/15 border-b border-amber-500/30'
        : 'bg-violet-600/15 border-b border-violet-500/25'
      }`}>
      <div className="flex items-center gap-2.5">
        <span className="text-base">{urgency ? '⏰' : '🎁'}</span>
        <p className={urgency ? 'text-amber-300' : 'text-violet-300'}>
          <span className="font-bold">
            {urgency ? `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}!` : `${daysLeft} days left on your free Pro trial`}
          </span>
          <span className="text-white/50 ml-2 text-xs hidden sm:inline">
            You have full access to every feature — enjoy it!
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/dashboard/billing"
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors
            ${urgency
              ? 'bg-amber-500 hover:bg-amber-400 text-black'
              : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
        >
          Upgrade to keep Pro →
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/30 hover:text-white/60 text-lg leading-none transition-colors"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}
