'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BookmakerOdds {
  home: number | null
  draw: number | null
  away: number | null
  over25: number | null
  btts: number | null
}

interface ValueBet {
  label: string
  ev: number
  odds: number
}

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
  home_injuries: string[]
  away_injuries: string[]
  lineups: { home: string[]; away: string[] } | null
  bookmaker: BookmakerOdds | null
  ev: { home: number | null; draw: number | null; away: number | null; over25: number | null; btts: number | null }
  best_value: ValueBet | null
  pinnacle_edge: { market: string; edge_pct: number; pinnacle_odds: number; bet365_odds: number } | null
  is_value_bet: boolean
  value_score: number | null
}

function ConfidenceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
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
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < score ? 'bg-violet-400' : 'bg-white/10'}`} />
      ))}
    </div>
  )
}

function EVBadge({ ev }: { ev: number }) {
  const isPositive = ev > 0
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
      isPositive
        ? ev >= 15 ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        : 'bg-red-500/10 text-red-400/70 border-red-500/20'
    }`}>
      {isPositive ? '+' : ''}{ev}% EV
    </span>
  )
}

function OddsChip({ label, odds, ev }: { label: string; odds: number | null; ev: number | null }) {
  if (!odds) return null
  const isValue = ev !== null && ev > 0
  return (
    <div className={`flex flex-col items-center rounded-lg px-2 py-1.5 border ${
      isValue ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/8'
    }`}>
      <span className="text-[10px] text-white/40 mb-0.5">{label}</span>
      <span className={`text-sm font-bold ${isValue ? 'text-emerald-400' : 'text-white'}`}>{odds.toFixed(2)}</span>
      {ev !== null && <span className={`text-[9px] font-semibold ${ev > 0 ? 'text-emerald-400' : 'text-white/30'}`}>{ev > 0 ? '+' : ''}{ev}%</span>}
    </div>
  )
}

interface AccaLeg {
  home_team: string
  away_team: string
  league: string
  leagueFlag: string
  kick_off: string
  bet_type: string
  odds: number | null
  ai_probability: number
  ev_percent: number | null
  reasoning: string
  confidence: string
}

interface Acca {
  legs: AccaLeg[]
  combined_odds: number
  combined_ev: number
  reasoning: string
  generated_at: string
}

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'elite'>('free')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [acca, setAcca] = useState<Acca | null>(null)
  const [accaLoading, setAccaLoading] = useState(true)
  const [copied, setCopied] = useState(false)

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

    // Fetch today's AI acca
    fetch('/api/acca')
      .then(r => r.json())
      .then(d => { if (d.success && d.acca) setAcca(d.acca) })
      .catch(() => {})
      .finally(() => setAccaLoading(false))
  }, [])

  function copyAcca() {
    if (!acca) return
    const text = acca.legs.map((l, i) =>
      `${i + 1}. ${l.home_team} vs ${l.away_team} — ${l.bet_type} @ ${l.odds}`
    ).join('\n') + `\n\nCombined odds: ${acca.combined_odds} | Combined EV: +${acca.combined_ev}%\nBuilt by MatchMind AI`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const isPro = subscriptionTier === 'pro' || subscriptionTier === 'elite'
  const visiblePredictions = isPro ? predictions : predictions.slice(0, 3)
  const lockedCount = predictions.length - visiblePredictions.length
  const valueBets = predictions.filter(p => p.is_value_bet).sort((a, b) => (b.value_score ?? 0) - (a.value_score ?? 0))

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xl">🔮</div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Match Predictions</h1>
            <p className="text-white/40 text-sm">GPT-4o · Pinnacle edge detection · Refreshed every 30 min</p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white/5 rounded-2xl h-44 animate-pulse border border-white/5" />
          ))}
          <p className="text-center text-white/30 text-sm">Fetching odds + running AI analysis…</p>
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

      {/* 🎯 AI ACCA BUILDER */}
      {isPro && (
        <div className="mb-6">
          {accaLoading ? (
            <div className="bg-white/5 border border-white/8 rounded-2xl h-48 animate-pulse" />
          ) : acca ? (
            <div className="bg-gradient-to-br from-violet-600/15 to-indigo-600/8 border border-violet-500/30 rounded-2xl p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4 gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🎯</span>
                    <h2 className="text-white font-bold">Today&apos;s AI Accumulator</h2>
                    <span className="text-[10px] font-black text-violet-300 bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 rounded-full uppercase tracking-wide">New daily</span>
                  </div>
                  <p className="text-white/40 text-xs">{acca.legs.length} legs · All positive EV · From different leagues</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-violet-300 font-black text-2xl">@ {acca.combined_odds}</p>
                  <p className="text-emerald-400 text-xs font-bold">Combined EV: +{acca.combined_ev}%</p>
                </div>
              </div>

              {/* Legs */}
              <div className="space-y-2 mb-4">
                {acca.legs.map((leg, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl p-3">
                    <div className="w-6 h-6 rounded-lg bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-xs text-violet-300 font-black shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold truncate">{leg.home_team} vs {leg.away_team}</p>
                      <p className="text-white/30 text-[10px]">{leg.leagueFlag} {leg.league}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white text-xs font-bold">{leg.bet_type} @ {leg.odds?.toFixed(2)}</p>
                      {leg.ev_percent !== null && (
                        <p className="text-emerald-400 text-[10px] font-bold">EV: +{leg.ev_percent}%</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reasoning */}
              {acca.reasoning && (
                <p className="text-white/40 text-xs mb-4 italic border-l-2 border-violet-500/30 pl-3">{acca.reasoning}</p>
              )}

              {/* Payout calc + copy */}
              <div className="flex items-center justify-between gap-3">
                <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-2 text-sm">
                  <span className="text-white/40">£10 stake → </span>
                  <span className="text-white font-black">£{(10 * acca.combined_odds).toFixed(2)}</span>
                </div>
                <button
                  onClick={copyAcca}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                >
                  {copied ? '✅ Copied!' : '📋 Copy Acca'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#13162b] border border-violet-500/15 rounded-2xl p-5 text-center">
              <p className="text-3xl mb-2">🎯</p>
              <p className="text-white font-bold mb-1">AI Accumulator</p>
              <p className="text-white/40 text-xs">No fixtures with sufficient odds available today. Check back tomorrow.</p>
            </div>
          )}
        </div>
      )}

      {!isPro && (
        <div className="mb-6 bg-gradient-to-r from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-white font-bold text-sm">AI Accumulator Builder</p>
              <p className="text-white/40 text-xs">Daily AI-built accas with positive EV on every leg — Pro only</p>
            </div>
          </div>
          <a href="/dashboard/billing" className="shrink-0 bg-violet-600 hover:bg-violet-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors">
            Upgrade →
          </a>
        </div>
      )}

      {!loading && !error && predictions.length > 0 && (
        <div className="space-y-6">

          {/* 🔥 Value Bets Section — Pro only */}
          {isPro && valueBets.length > 0 && (
            <div className="bg-gradient-to-br from-emerald-950/60 to-emerald-900/20 border border-emerald-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🔥</span>
                <div>
                  <h2 className="text-white font-bold text-base">Pinnacle Value Bets Today</h2>
                  <p className="text-emerald-400/70 text-xs">Sharp money (Pinnacle) disagrees with Bet365 — these have real edge</p>
                </div>
              </div>
              <div className="space-y-2">
                {valueBets.map((p, i) => (
                  <div key={p.id || i} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-white/30 text-xs font-bold w-4">#{i + 1}</span>
                      <div>
                        <p className="text-white font-semibold text-sm">{p.home_team} vs {p.away_team}</p>
                        <p className="text-white/40 text-xs">{p.leagueFlag} {p.league} · <span className="text-emerald-400 font-semibold">{p.best_value?.label}</span> @ {p.best_value?.odds.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold text-base">+{p.value_score}%</span>
                      <p className="text-white/30 text-xs">EV</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Free users teaser for value bets */}
          {!isPro && (
            <div className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/10 border border-emerald-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <p className="text-white font-bold">Value Bet Finder</p>
                    <p className="text-white/40 text-xs">Real Bet365 odds vs AI probabilities — find +EV bets</p>
                  </div>
                </div>
                <a href="/api/stripe/create-checkout?plan=pro" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors whitespace-nowrap">
                  Unlock Pro
                </a>
              </div>
            </div>
          )}

          {/* All Predictions */}
          <div className="space-y-4">
            {visiblePredictions.map((pred, idx) => {
              const isExpanded = expanded === idx
              const matchDate = pred.date ? new Date(pred.date).toLocaleDateString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              }) : '—'

              return (
                <div
                  key={pred.id || idx}
                  className={`border rounded-2xl overflow-hidden transition-all ${
                    pred.is_value_bet
                      ? 'bg-[#0d1f18] border-emerald-500/30 hover:border-emerald-400/50'
                      : 'bg-[#13162b] border-white/8 hover:border-violet-500/30'
                  }`}
                >
                  {/* Pinnacle edge banner */}
                  {pred.is_value_bet && isPro && (
                    <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
                      {pred.pinnacle_edge ? (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-300 font-black tracking-wide">🎯 PINNACLE EDGE +{pred.pinnacle_edge.edge_pct}%</span>
                            <span className="text-xs text-emerald-400/60">· {pred.pinnacle_edge.market}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                            <span className="text-white/70 font-semibold">Pinnacle {pred.pinnacle_edge.pinnacle_odds.toFixed(2)}</span>
                            <span>→</span>
                            <span className="text-emerald-400 font-semibold">Bet365 {pred.pinnacle_edge.bet365_odds.toFixed(2)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-emerald-400 font-bold">🔥 VALUE BET</span>
                          <span className="text-xs text-emerald-400/70">· {pred.best_value?.label} @ {pred.best_value?.odds?.toFixed(2)} · +{pred.value_score}% EV</span>
                        </div>
                      )}
                    </div>
                  )}

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
                      <span className="text-white/20 text-lg font-bold">vs</span>
                      <div className="flex-1">
                        <p className="text-white font-bold text-base leading-tight">{pred.away_team}</p>
                        <p className="text-white/30 text-xs mt-0.5">Away</p>
                      </div>
                    </div>

                    {/* Result probabilities */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { label: 'Home Win', pct: pred.home_win_pct, color: '#7c3aed' },
                        { label: 'Draw',     pct: pred.draw_pct,     color: '#6b7280' },
                        { label: 'Away Win', pct: pred.away_win_pct, color: '#3b82f6' },
                      ].map(({ label, pct, color }) => (
                        <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                          <p className="text-white font-bold text-xl" style={{ color }}>{pct}%</p>
                          <p className="text-white/40 text-xs mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Real Bet365 odds + EV (Pro only) */}
                    {isPro && pred.bookmaker && (
                      <div className="mb-4">
                        <p className="text-white/30 text-xs mb-2 font-medium">🏦 Bet365 Odds · Expected Value</p>
                        <div className="flex gap-2">
                          <OddsChip label="Home" odds={pred.bookmaker.home} ev={pred.ev.home} />
                          <OddsChip label="Draw" odds={pred.bookmaker.draw} ev={pred.ev.draw} />
                          <OddsChip label="Away" odds={pred.bookmaker.away} ev={pred.ev.away} />
                          <OddsChip label="O2.5" odds={pred.bookmaker.over25} ev={pred.ev.over25} />
                          <OddsChip label="BTTS" odds={pred.bookmaker.btts} ev={pred.ev.btts} />
                        </div>
                      </div>
                    )}

                    {/* Recommended bet */}
                    <div className={`border rounded-xl px-4 py-3 mb-3 flex items-center justify-between ${
                      pred.is_value_bet && isPro
                        ? 'bg-emerald-600/10 border-emerald-500/30'
                        : 'bg-violet-600/10 border-violet-500/20'
                    }`}>
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${pred.is_value_bet && isPro ? 'text-emerald-400' : 'text-violet-300'}`}>
                          AI Recommended Bet
                        </p>
                        <p className="text-white font-bold">{pred.recommended_bet}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/40 text-xs">Est. odds</p>
                        <p className={`font-bold ${pred.is_value_bet && isPro ? 'text-emerald-400' : 'text-violet-300'}`}>{pred.recommended_odds_range}</p>
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
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-white/40 text-xs mb-1.5">Over 2.5 Goals</p>
                          <ConfidenceBar value={pred.over_2_5_pct} color="#8b5cf6" />
                          {isPro && pred.ev.over25 !== null && <EVBadge ev={pred.ev.over25} />}
                        </div>
                        <div>
                          <p className="text-white/40 text-xs mb-1.5">Both Teams Score</p>
                          <ConfidenceBar value={pred.btts_pct} color="#3b82f6" />
                          {isPro && pred.ev.btts !== null && <EVBadge ev={pred.ev.btts} />}
                        </div>
                      </div>

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

                    {/* Injuries */}
                    {(pred.home_injuries.length > 0 || pred.away_injuries.length > 0) && (
                      <div>
                        <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">🚑 Injury Report</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-white/50 text-xs mb-1 font-medium">{pred.home_team}</p>
                            {pred.home_injuries.length > 0
                              ? pred.home_injuries.map((inj, i) => (
                                  <p key={i} className="text-red-400 text-xs">• {inj}</p>
                                ))
                              : <p className="text-white/20 text-xs">No injuries reported</p>
                            }
                          </div>
                          <div>
                            <p className="text-white/50 text-xs mb-1 font-medium">{pred.away_team}</p>
                            {pred.away_injuries.length > 0
                              ? pred.away_injuries.map((inj, i) => (
                                  <p key={i} className="text-red-400 text-xs">• {inj}</p>
                                ))
                              : <p className="text-white/20 text-xs">No injuries reported</p>
                            }
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lineups */}
                    {pred.lineups && (
                      <div>
                        <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">📋 Confirmed Lineups</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-white/50 text-xs mb-1 font-medium">{pred.home_team}</p>
                            {pred.lineups.home.map((p, i) => (
                              <p key={i} className="text-white/60 text-xs">• {p}</p>
                            ))}
                          </div>
                          <div>
                            <p className="text-white/50 text-xs mb-1 font-medium">{pred.away_team}</p>
                            {pred.lineups.away.map((p, i) => (
                              <p key={i} className="text-white/60 text-xs">• {p}</p>
                            ))}
                          </div>
                        </div>
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
                  <p className="text-white font-bold mb-1">{lockedCount} more predictions + Value Bets locked</p>
                  <p className="text-white/50 text-sm mb-4">Upgrade to Pro for all predictions, real odds & EV scores</p>
                  <a href="/api/stripe/create-checkout?plan=pro" className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
                    Unlock with Pro — £9.99/mo
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && predictions.length > 0 && (
        <p className="text-center text-white/20 text-xs mt-6">
          EV = Expected Value vs Bet365 implied probability. Positive EV bets are statistically profitable long-term. Always bet responsibly.
        </p>
      )}
    </div>
  )
}
