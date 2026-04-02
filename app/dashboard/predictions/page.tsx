'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Prediction {
  id: number
  date: string
  league: string
  leagueFlag: string
  home_team: string
  home_logo: string
  away_team: string
  away_logo: string
  home_win_pct: number
  draw_pct: number
  away_win_pct: number
  over_2_5_pct: number
  btts_pct: number
  confidence: number
  recommended_bet: string
  recommended_odds_range: string
  key_factors: string[]
  risk_level: string
}

function ConfidenceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-xs text-white/50 w-8 text-right">{value}%</span>
    </div>
  )
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    High: 'bg-red-500/15 text-red-400 border-red-500/30',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors[level] || colors.Medium}`}>
      {level} Risk
    </span>
  )
}

function ConfidenceDots({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < score ? 'bg-violet-400' : 'bg-white/10'}`}
        />
      ))}
    </div>
  )
}

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'elite'>('free')
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('subscription_tier').eq('user_id', user.id).single()
          .then(({ data }) => {
            if (data?.subscription_tier) setSubscriptionTier(data.subscription_tier as 'free' | 'pro' | 'elite')
          })
      }
    })

    fetch('/api/predictions')
      .then(r => r.json())
      .then(d => {
        if (d.success) setPredictions(d.predictions || [])
        else setError(d.error || 'Failed to load predictions')
      })
      .catch(() => setError('Failed to load predictions'))
      .finally(() => setLoading(false))
  }, [])

  const visiblePredictions = subscriptionTier === 'free' ? predictions.slice(0, 3) : predictions
  const lockedCount = predictions.length - visiblePredictions.length

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xl">🔮</div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Match Predictions</h1>
            <p className="text-white/40 text-sm">GPT-4 powered analysis · Updated every 6 hours</p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white/5 rounded-2xl h-40 animate-pulse border border-white/5" />
          ))}
          <p className="text-center text-white/30 text-sm">Analysing upcoming fixtures with AI…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
          <p className="text-red-400">⚠️ {error}</p>
        </div>
      )}

      {/* No fixtures */}
      {!loading && !error && predictions.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">🏖️</p>
          <p className="text-white/60">No upcoming fixtures in the next 3 days. Check back soon.</p>
        </div>
      )}

      {/* Predictions */}
      {!loading && !error && (
        <div className="space-y-4">
          {visiblePredictions.map((pred, idx) => {
            const isExpanded = expanded === idx
            const matchDate = pred.date ? new Date(pred.date).toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            }) : '—'

            return (
              <div
                key={pred.id || idx}
                className="bg-[#13162b] border border-white/8 rounded-2xl overflow-hidden hover:border-violet-500/30 transition-all"
              >
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 pt-3 pb-0">
                  <span className="text-xs text-white/40 font-medium">{pred.leagueFlag} {pred.league}</span>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={pred.risk_level} />
                    <span className="text-xs text-white/30">{matchDate}</span>
                  </div>
                </div>

                {/* Teams */}
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex-1 text-right">
                      <p className="text-white font-bold text-base leading-tight">{pred.home_team}</p>
                      <p className="text-white/30 text-xs mt-0.5">Home</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-white/20 text-lg font-bold">vs</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-base leading-tight">{pred.away_team}</p>
                      <p className="text-white/30 text-xs mt-0.5">Away</p>
                    </div>
                  </div>

                  {/* Result probabilities */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: 'Home Win', pct: pred.home_win_pct, color: '#7c3aed' },
                      { label: 'Draw', pct: pred.draw_pct, color: '#6b7280' },
                      { label: 'Away Win', pct: pred.away_win_pct, color: '#3b82f6' },
                    ].map(({ label, pct, color }) => (
                      <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                        <p className="text-white font-bold text-xl" style={{ color }}>{pct}%</p>
                        <p className="text-white/40 text-xs mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recommended bet */}
                  <div className="bg-violet-600/10 border border-violet-500/20 rounded-xl px-4 py-3 mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-violet-300 text-xs font-semibold uppercase tracking-wide mb-0.5">AI Recommended Bet</p>
                      <p className="text-white font-bold">{pred.recommended_bet}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-xs">Est. odds</p>
                      <p className="text-violet-300 font-bold">{pred.recommended_odds_range}</p>
                    </div>
                  </div>

                  {/* Confidence */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white/40 text-xs mb-1">AI Confidence</p>
                      <ConfidenceDots score={pred.confidence} />
                    </div>
                    <span className="text-white/60 text-sm font-semibold">{pred.confidence}/10</span>
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : idx)}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                  >
                    {isExpanded ? '▲ Hide' : '▼ Show'} detailed analysis
                  </button>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3">
                    {/* More stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-white/40 text-xs mb-1.5">Over 2.5 Goals</p>
                        <ConfidenceBar value={pred.over_2_5_pct} color="#8b5cf6" />
                      </div>
                      <div>
                        <p className="text-white/40 text-xs mb-1.5">Both Teams Score</p>
                        <ConfidenceBar value={pred.btts_pct} color="#3b82f6" />
                      </div>
                    </div>

                    {/* Key factors */}
                    {pred.key_factors.length > 0 && (
                      <div>
                        <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">Key Factors</p>
                        <ul className="space-y-1.5">
                          {pred.key_factors.map((factor, fi) => (
                            <li key={fi} className="flex items-start gap-2 text-sm text-white/70">
                              <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Locked predictions for free users */}
          {lockedCount > 0 && (
            <div className="relative">
              <div className="bg-[#13162b] border border-white/8 rounded-2xl p-8 text-center filter blur-[1px]">
                <p className="text-white/40">More predictions locked…</p>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0B14]/80 rounded-2xl border border-violet-500/30">
                <p className="text-2xl mb-2">🔒</p>
                <p className="text-white font-bold mb-1">{lockedCount} more predictions locked</p>
                <p className="text-white/50 text-sm mb-4">Upgrade to Pro to see all AI predictions</p>
                <a
                  href="/api/stripe/create-checkout?plan=pro"
                  className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
                >
                  Unlock with Pro — £9.99/mo
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      {!loading && predictions.length > 0 && (
        <p className="text-center text-white/20 text-xs mt-6">
          AI predictions are for analysis only. Always bet responsibly.
        </p>
      )}
    </div>
  )
}
