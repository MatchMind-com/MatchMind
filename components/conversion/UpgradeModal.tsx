'use client'
import { useEffect } from 'react'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  betCount: number
  trigger?: 'paywall' | 'banner' // where it was triggered from
}

export default function UpgradeModal({ isOpen, onClose, betCount, trigger = 'paywall' }: UpgradeModalProps) {
  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const proFeatures = [
    { icon: '📊', text: 'Unlimited bet tracking' },
    { icon: '🔮', text: 'All AI predictions (10+ leagues daily)' },
    { icon: '🔥', text: 'Pinnacle value bet finder + EV scores' },
    { icon: '🎯', text: 'Daily AI accumulator builder' },
    { icon: '🤖', text: 'AI Football Coach (GPT-4o)' },
    { icon: '🏆', text: 'Full leaderboard access' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-2xl bg-[#0F0F1A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all z-10"
        >
          ✕
        </button>

        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 text-center" style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)'
        }}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-violet-500/30">
            🔒
          </div>
          {trigger === 'paywall' ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">
                You've logged {betCount} bets
              </h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">
                Free accounts are limited to 10 bets. Upgrade to Pro to unlock unlimited tracking and AI insights.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">
                Unlock Your Full Potential
              </h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">
                You're leaving money on the table. Pro users improve their win rate by an average of 18%.
              </p>
            </>
          )}
        </div>

        {/* Plan */}
        <div className="px-6 pb-6">
          <div className="mt-4">
            {/* Pro Plan — full width, single plan */}
            <div className="relative bg-gradient-to-b from-violet-600/15 to-transparent border border-violet-500/40 rounded-2xl p-6">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-violet-600 text-white text-xs font-bold px-4 py-1 rounded-full">🎁 7-Day Free Trial — No Card Needed</span>
              </div>
              <div className="mt-2 flex items-center justify-between mb-4">
                <div>
                  <div className="text-violet-400 font-bold mb-1">MatchMind Pro</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">£9.99</span>
                    <span className="text-slate-500 text-sm">/month</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">Cancel anytime</p>
                </div>
                <div className="text-5xl">🏆</div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {proFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <span>{f.icon}</span>
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>
              <a
                href="/api/stripe/create-checkout?plan=pro"
                className="block w-full text-center bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-violet-500/30"
              >
                Start Free Trial — Unlock Everything →
              </a>
            </div>
          </div>

          <p className="text-center text-slate-600 text-xs mt-4">
            No credit card required · Cancel anytime · Instant access
          </p>
        </div>
      </div>
    </div>
  )
}
