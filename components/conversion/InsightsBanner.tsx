'use client'
import { useState } from 'react'
import { BetSlip } from '@/lib/types'
import UpgradeModal from './UpgradeModal'

interface InsightsBannerProps {
  bets: BetSlip[]
  subscriptionTier: 'free' | 'pro' | 'elite'
}

function countLockedInsights(bets: BetSlip[]): { count: number; examples: string[] } {
  const insights: string[] = []
  const settled = bets.filter(b => b.result !== 'pending')

  // Pattern: time-of-day analysis
  if (bets.length >= 3) insights.push('Time-of-day betting pattern')

  // Pattern: league-specific win rate
  const leagues = [...new Set(bets.map(b => b.league).filter(Boolean))]
  if (leagues.length >= 2) insights.push(`${leagues[0]} performance vs others`)

  // Pattern: bet type analysis
  const betTypes = [...new Set(bets.map(b => b.bet_type))]
  if (betTypes.length >= 2) insights.push(`Best performing bet type`)

  // Pattern: odds range analysis
  if (settled.length >= 3) insights.push('Optimal odds range for your style')

  // Pattern: streak warning
  const recent = settled.slice(0, 5)
  const recentLosses = recent.filter(b => b.result === 'loss').length
  if (recentLosses >= 3) insights.push('⚠️ Tilt warning detected')

  // Pattern: ROI by day of week
  if (bets.length >= 5) insights.push('Day-of-week ROI breakdown')

  return {
    count: Math.max(insights.length, 3),
    examples: insights.slice(0, 2),
  }
}

export default function InsightsBanner({ bets, subscriptionTier }: InsightsBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Only show for free users who have at least 3 bets
  if (subscriptionTier !== 'free' || bets.length < 3 || dismissed) return null

  const { count, examples } = countLockedInsights(bets)

  return (
    <>
      <div
        className="relative overflow-hidden border mb-6"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)',
          borderColor: 'rgba(99,102,241,0.3)',
        }}
      >
        {/* Animated glow bar */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background: 'linear-gradient(90deg, transparent, #6366f1, #8b5cf6, transparent)',
            animation: 'shimmer 2.5s ease-in-out infinite',
          }}
        />

        <div className="flex items-center justify-between px-5 py-3.5 gap-4">
          {/* Left: lock icon + message */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">
                {count} AI insights detected in your data
                <span className="text-violet-400"> — upgrade to unlock</span>
              </p>
              {examples.length > 0 && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Including: {examples.join(' · ')}
                </p>
              )}
            </div>
          </div>

          {/* Right: CTA + dismiss */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 transition-all shadow-lg shadow-violet-500/20 whitespace-nowrap"
            >
              Unlock Pro →
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="w-7 h-7 bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-all text-xs flex-shrink-0"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes shimmer {
            0% { opacity: 0.4; transform: translateX(-100%); }
            50% { opacity: 1; }
            100% { opacity: 0.4; transform: translateX(100%); }
          }
        `}</style>
      </div>

      <UpgradeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        betCount={bets.length}
        trigger="banner"
      />
    </>
  )
}
