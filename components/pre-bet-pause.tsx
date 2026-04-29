'use client'

import { useEffect, useState } from 'react'

export interface PreBetPauseBet {
  betLabel: string
  odds?: number
  stake?: number
  href: string
  bookmaker?: string
}

interface AssessmentResponse {
  rating: 'good' | 'caution' | 'risky'
  reasons: string[]
}

interface Props {
  bet: PreBetPauseBet | null
  onClose: () => void
  recentBets?: { result: string }[]
}

const RATING_META: Record<AssessmentResponse['rating'], {
  label: string
  emoji: string
  color: string
  border: string
  bg: string
  cta: string
}> = {
  good: {
    label: 'Looks good',
    emoji: '✅',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    cta: 'bg-emerald-600 hover:bg-emerald-500',
  },
  caution: {
    label: 'Caution',
    emoji: '⚠️',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    cta: 'bg-amber-600 hover:bg-amber-500',
  },
  risky: {
    label: 'High Risk',
    emoji: '🛑',
    color: 'text-red-400',
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    cta: 'bg-red-600 hover:bg-red-500',
  },
}

export default function PreBetPause({ bet, onClose, recentBets }: Props) {
  const [loading, setLoading] = useState(false)
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bet) {
      setAssessment(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/pre-bet-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        betLabel: bet.betLabel,
        odds: bet.odds,
        stake: bet.stake,
        recentBets,
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as AssessmentResponse
      })
      .then((data) => {
        if (cancelled) return
        setAssessment(data)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message ?? 'Failed to assess')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [bet, recentBets])

  if (!bet) return null

  const meta = assessment ? RATING_META[assessment.rating] : RATING_META.caution

  function proceed() {
    if (!bet) return
    window.open(bet.href, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0E1628] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest">
              Pre-Bet Pause
            </p>
            <h2 className="text-white text-lg font-black mt-1">Quick check before you bet</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Bet details */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-4">
          <p className="text-white font-bold text-sm">{bet.betLabel}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-white/50">
            {bet.odds != null && <span>Odds {bet.odds.toFixed(2)}</span>}
            {bet.stake != null && <span>Stake £{bet.stake}</span>}
            {bet.bookmaker && <span>{bet.bookmaker}</span>}
          </div>
        </div>

        {/* Assessment */}
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <span className="ml-3 text-white/50 text-sm">AI assessing...</span>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
            <p className="text-red-400 text-sm">Couldn't reach AI — proceed at your own discretion.</p>
          </div>
        )}

        {assessment && !loading && (
          <div className={`${meta.bg} border ${meta.border} rounded-xl p-4 mb-4`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{meta.emoji}</span>
              <span className={`font-black text-sm ${meta.color}`}>{meta.label}</span>
            </div>
            <ul className="space-y-1.5">
              {assessment.reasons.map((r, i) => (
                <li key={i} className="text-white/70 text-xs flex gap-2">
                  <span className={`${meta.color} flex-shrink-0`}>•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white/70 font-bold py-2.5 rounded-xl text-sm transition-all"
          >
            Cancel
          </button>
          <button
            onClick={proceed}
            className={`flex-1 ${assessment ? meta.cta : 'bg-emerald-600 hover:bg-emerald-500'} text-white font-bold py-2.5 rounded-xl text-sm transition-all`}
          >
            Place Bet
          </button>
        </div>

        <p className="text-white/25 text-[10px] text-center mt-3">
          18+ | Gamble responsibly | begambleaware.org
        </p>
      </div>
    </div>
  )
}
