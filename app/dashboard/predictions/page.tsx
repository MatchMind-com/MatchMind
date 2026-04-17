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
  edge_explanation: string | null
}

function ConfidenceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{value}%</span>
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
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors[level] || colors.Medium}`}>
      {level} Risk
    </span>
  )
}

function ConfidenceDots({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < score ? 'bg-blue-400' : 'bg-white/10'}`} />
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
      isValue ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.04] border-white/[0.07]'
    }`}>
      <span className="text-[10px] text-slate-500 mb-0.5">{label}</span>
      <span className={`text-sm font-bold ${isValue ? 'text-emerald-400' : 'text-white'}`}>{odds.toFixed(2)}</span>
      {ev !== null && <span className={`text-[9px] font-semibold ${ev > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>{ev > 0 ? '+' : ''}{ev}%</span>}
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

// SVG Icons
function BrainIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="6" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="2" strokeWidth={1.5} />
    </svg>
  )
}

function FireIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
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
    <div className="p-5 lg:p-7 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <BrainIcon />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">AI Predictions</h1>
          </div>
          <p className="text-slate-500 text-xs">GPT-4o · Pinnacle edge detection · Refreshed every 30 min</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-[#0E1628] rounded-2xl h-44 animate-pulse border border-white/[0.07]" />
          ))}
          <p className="text-center text-slate-600 text-sm">Fetching odds + running AI analysis…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* No fixtures */}
      {!loading && !error && predictions.length === 0 && (
        <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-10 text-center">
          <p className="text-slate-400 font-semibold mb-1">No upcoming fixtures</p>
          <p className="text-slate-600 text-sm">No matches in the next 3 days. Check back soon.</p>
        </div>
      )}

      {/* AI ACCA BUILDER — Pro */}
      {isPro && (
        <div>
          {accaLoading ? (
            <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl h-48 animate-pulse" />
          ) : acca ? (
            <div className="bg-[#0E1628] border border-blue-500/25 rounded-2xl overflow-hidden">
              {/* Acca header strip */}
              <div className="px-5 py-3 border-b border-blue-500/15 flex items-center justify-between"
                style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.08) 0%, transparent 100%)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400"><TargetIcon /></span>
                  <span className="text-white font-bold text-sm">Today&apos;s AI Accumulator</span>
                  <span className="text-[10px] font-black text-blue-300 bg-blue-500/15 border border-blue-500/25 px-2 py-0.5 rounded-full uppercase tracking-wide">Daily</span>
                </div>
                <div className="text-right">
                  <span className="text-blue-300 font-black text-xl">@ {acca.combined_odds}</span>
                  <span className="text-emerald-400 text-xs font-bold ml-2">+{acca.combined_ev}% EV</span>
                </div>
              </div>

              <div className="p-5">
                <p className="text-slate-500 text-xs mb-4">{acca.legs.length} legs · All positive EV · Across different leagues</p>

                {/* Legs */}
                <div className="space-y-2 mb-4">
                  {acca.legs.map((leg, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                      <div className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-500/25 flex items-center justify-center text-xs text-blue-300 font-black shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-bold truncate">{leg.home_team} vs {leg.away_team}</p>
                        <p className="text-slate-500 text-[10px]">{leg.leagueFlag} {leg.league}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-white text-xs font-bold">{leg.bet_type} @ {leg.odds?.toFixed(2)}</p>
                        {leg.ev_percent !== null && (
                          <p className="text-emerald-400 text-[10px] font-bold">+{leg.ev_percent}% EV</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {acca.reasoning && (
                  <p className="text-slate-500 text-xs mb-4 italic border-l-2 border-blue-500/25 pl-3">{acca.reasoning}</p>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2 text-sm">
                    <span className="text-slate-500">£10 stake → </span>
                    <span className="text-white font-black">£{(10 * acca.combined_odds).toFixed(2)}</span>
                  </div>
                  <button
                    onClick={copyAcca}
                    className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-300 font-bold px-4 py-2 rounded-xl text-sm transition-all"
                  >
                    {copied ? <><CheckIcon /> Copied!</> : <><CopyIcon /> Copy Acca</>}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-5 text-center">
              <p className="text-white font-bold mb-1">AI Accumulator</p>
              <p className="text-slate-500 text-xs">No fixtures with sufficient odds available today. Check back tomorrow.</p>
            </div>
          )}
        </div>
      )}

      {/* Acca teaser — Free */}
      {!isPro && (
        <div className="bg-[#0E1628] border border-blue-500/20 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <TargetIcon />
            </div>
            <div>
              <p className="text-white font-bold text-sm">AI Accumulator Builder</p>
              <p className="text-slate-500 text-xs">Daily AI-built accas with positive EV on every leg — Pro only</p>
            </div>
          </div>
          <a href="/dashboard/billing" className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors">
            Upgrade →
          </a>
        </div>
      )}

      {!loading && !error && predictions.length > 0 && (
        <div className="space-y-5">

          {/* Pinnacle Value Bets — Pro */}
          {isPro && valueBets.length > 0 && (
            <div className="bg-[#0E1628] border border-emerald-500/25 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-emerald-500/15 flex items-center gap-2"
                style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.07) 0%, transparent 100%)' }}>
                <span className="text-emerald-400"><FireIcon /></span>
                <div>
                  <span className="text-white font-bold text-sm">Pinnacle Value Bets Today</span>
                  <span className="text-emerald-400/60 text-xs ml-2">Sharp money disagrees with Bet365</span>
                </div>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {valueBets.map((p, i) => (
                  <div key={p.id || i} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-600 text-xs font-bold w-5">#{i + 1}</span>
                      <div>
                        <p className="text-white font-semibold text-sm">{p.home_team} vs {p.away_team}</p>
                        <p className="text-slate-500 text-xs">{p.leagueFlag} {p.league} · <span className="text-emerald-400 font-semibold">{p.best_value?.label}</span> @ {p.best_value?.odds.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-black text-lg">+{p.value_score}%</span>
                      <p className="text-slate-600 text-[10px]">EV edge</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Value bet teaser — Free */}
          {!isPro && (
            <div className="bg-[#0E1628] border border-emerald-500/20 rounded-2xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <FireIcon />
                </div>
                <div>
                  <p className="text-white font-bold">Value Bet Finder</p>
                  <p className="text-slate-500 text-xs">Real Bet365 odds vs AI probabilities — find +EV bets</p>
                </div>
              </div>
              <a href="/api/stripe/create-checkout?plan=pro" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors whitespace-nowrap">
                Unlock Pro
              </a>
            </div>
          )}

          {/* All Predictions */}
          <div className="space-y-3">
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
                      ? 'bg-[#0E1628] border-emerald-500/25 hover:border-emerald-400/40'
                      : 'bg-[#0E1628] border-white/[0.07] hover:border-blue-500/25'
                  }`}
                >
                  {/* Pinnacle edge banner */}
                  {pred.is_value_bet && isPro && (
                    <div className="px-4 py-2 bg-emerald-500/8 border-b border-emerald-500/15">
                      {pred.pinnacle_edge ? (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-300 font-black tracking-wide">PINNACLE EDGE +{pred.pinnacle_edge.edge_pct}%</span>
                            <span className="text-xs text-emerald-400/60">· {pred.pinnacle_edge.market}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="text-slate-300 font-semibold">Pinnacle {pred.pinnacle_edge.pinnacle_odds.toFixed(2)}</span>
                            <span>→</span>
                            <span className="text-emerald-400 font-semibold">Bet365 {pred.pinnacle_edge.bet365_odds.toFixed(2)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-emerald-400 font-bold">VALUE BET</span>
                          <span className="text-xs text-emerald-400/60">· {pred.best_value?.label} @ {pred.best_value?.odds?.toFixed(2)} · +{pred.value_score}% EV</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* League + date bar */}
                  <div className="flex items-center justify-between px-4 pt-3.5 pb-0">
                    <span className="text-xs text-slate-500 font-medium">{pred.leagueFlag} {pred.league}</span>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={pred.risk_level} />
                      <span className="text-[10px] text-slate-600">{matchDate}</span>
                    </div>
                  </div>

                  {/* Teams row — UEFA style with logos */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      {/* Home team */}
                      <div className="flex-1 flex items-center gap-3">
                        {pred.home_logo ? (
                          <img src={pred.home_logo} alt={pred.home_team} className="w-10 h-10 object-contain flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-white font-bold text-sm leading-tight">{pred.home_team}</p>
                          <p className="text-slate-600 text-[10px]">Home</p>
                        </div>
                      </div>

                      {/* Win probabilities center */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-center">
                          <p className="text-white font-black text-xl leading-none">{pred.home_win_pct}<span className="text-xs text-slate-500">%</span></p>
                          <p className="text-[9px] text-slate-600 mt-0.5">H</p>
                        </div>
                        <div className="text-center px-1">
                          <p className="text-slate-400 font-black text-xl leading-none">{pred.draw_pct}<span className="text-xs text-slate-500">%</span></p>
                          <p className="text-[9px] text-slate-600 mt-0.5">D</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white font-black text-xl leading-none">{pred.away_win_pct}<span className="text-xs text-slate-500">%</span></p>
                          <p className="text-[9px] text-slate-600 mt-0.5">A</p>
                        </div>
                      </div>

                      {/* Away team */}
                      <div className="flex-1 flex items-center gap-3 justify-end">
                        <div className="text-right">
                          <p className="text-white font-bold text-sm leading-tight">{pred.away_team}</p>
                          <p className="text-slate-600 text-[10px]">Away</p>
                        </div>
                        {pred.away_logo ? (
                          <img src={pred.away_logo} alt={pred.away_team} className="w-10 h-10 object-contain flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Bet365 odds + EV — Pro only */}
                    {isPro && pred.bookmaker && (
                      <div className="mb-3">
                        <p className="text-slate-600 text-[10px] mb-1.5 font-medium uppercase tracking-wide">Bet365 Odds · Expected Value</p>
                        <div className="flex gap-1.5">
                          <OddsChip label="Home" odds={pred.bookmaker.home} ev={pred.ev.home} />
                          <OddsChip label="Draw" odds={pred.bookmaker.draw} ev={pred.ev.draw} />
                          <OddsChip label="Away" odds={pred.bookmaker.away} ev={pred.ev.away} />
                          <OddsChip label="O2.5" odds={pred.bookmaker.over25} ev={pred.ev.over25} />
                          <OddsChip label="BTTS" odds={pred.bookmaker.btts} ev={pred.ev.btts} />
                        </div>
                      </div>
                    )}

                    {/* Edge explanation */}
                    {pred.is_value_bet && pred.edge_explanation && (
                      <div className="mb-3 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Why this has edge</p>
                        <p className="text-slate-300 text-xs leading-relaxed">{pred.edge_explanation}</p>
                      </div>
                    )}

                    {/* Recommended bet */}
                    <div className={`border rounded-xl px-4 py-3 mb-3 flex items-center justify-between ${
                      pred.is_value_bet && isPro
                        ? 'bg-emerald-600/8 border-emerald-500/25'
                        : 'bg-blue-600/8 border-blue-500/20'
                    }`}>
                      <div>
                        <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${pred.is_value_bet && isPro ? 'text-emerald-400' : 'text-blue-400'}`}>
                          AI Recommended Bet
                        </p>
                        <p className="text-white font-bold text-sm">{pred.recommended_bet}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 text-[10px]">Est. odds</p>
                        <p className={`font-bold text-sm ${pred.is_value_bet && isPro ? 'text-emerald-400' : 'text-blue-300'}`}>{pred.recommended_odds_range}</p>
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-slate-500 text-[10px] mb-1.5 uppercase tracking-wide">AI Confidence</p>
                        <ConfidenceDots score={pred.confidence} />
                      </div>
                      <span className="text-slate-400 text-sm font-bold">{pred.confidence}<span className="text-slate-600">/10</span></span>
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : idx)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 font-medium"
                    >
                      {isExpanded ? '▲ Hide' : '▼ Show'} detailed analysis
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-slate-500 text-[10px] mb-1.5 uppercase tracking-wide">Over 2.5 Goals</p>
                          <ConfidenceBar value={pred.over_2_5_pct} color="#3b82f6" />
                          {isPro && pred.ev.over25 !== null && <div className="mt-1"><EVBadge ev={pred.ev.over25} /></div>}
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] mb-1.5 uppercase tracking-wide">Both Teams Score</p>
                          <ConfidenceBar value={pred.btts_pct} color="#6366f1" />
                          {isPro && pred.ev.btts !== null && <div className="mt-1"><EVBadge ev={pred.ev.btts} /></div>}
                        </div>
                      </div>

                      {pred.key_factors.length > 0 && (
                        <div>
                          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide mb-2">Key Factors</p>
                          <ul className="space-y-1.5">
                            {pred.key_factors.map((factor, fi) => (
                              <li key={fi} className="flex items-start gap-2 text-sm text-slate-300">
                                <span className="text-blue-500 mt-0.5 shrink-0 text-xs">•</span>
                                {factor}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Injuries */}
                      {(pred.home_injuries.length > 0 || pred.away_injuries.length > 0) && (
                        <div>
                          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide mb-2">Injury Report</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-slate-400 text-xs mb-1 font-medium">{pred.home_team}</p>
                              {pred.home_injuries.length > 0
                                ? pred.home_injuries.map((inj, i) => (
                                    <p key={i} className="text-red-400 text-xs">• {inj}</p>
                                  ))
                                : <p className="text-slate-600 text-xs">No injuries reported</p>
                              }
                            </div>
                            <div>
                              <p className="text-slate-400 text-xs mb-1 font-medium">{pred.away_team}</p>
                              {pred.away_injuries.length > 0
                                ? pred.away_injuries.map((inj, i) => (
                                    <p key={i} className="text-red-400 text-xs">• {inj}</p>
                                  ))
                                : <p className="text-slate-600 text-xs">No injuries reported</p>
                              }
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Lineups */}
                      {pred.lineups && (
                        <div>
                          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide mb-2">Confirmed Lineups</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-slate-400 text-xs mb-1 font-medium">{pred.home_team}</p>
                              {pred.lineups.home.map((p, i) => (
                                <p key={i} className="text-slate-400 text-xs">• {p}</p>
                              ))}
                            </div>
                            <div>
                              <p className="text-slate-400 text-xs mb-1 font-medium">{pred.away_team}</p>
                              {pred.lineups.away.map((p, i) => (
                                <p key={i} className="text-slate-400 text-xs">• {p}</p>
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

            {/* Locked overlay */}
            {lockedCount > 0 && (
              <div className="relative">
                <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-8 text-center opacity-30 select-none">
                  <p className="text-slate-400">More predictions locked…</p>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#060914]/85 rounded-2xl border border-blue-500/25">
                  <div className="text-blue-400 mb-3"><LockIcon /></div>
                  <p className="text-white font-bold mb-1">{lockedCount} more predictions + Value Bets</p>
                  <p className="text-slate-400 text-sm mb-4">Upgrade to Pro for all predictions, real odds & EV scores</p>
                  <a href="/api/stripe/create-checkout?plan=pro" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
                    Unlock with Pro — £9.99/mo
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && predictions.length > 0 && (
        <p className="text-center text-slate-600 text-xs">
          EV = Expected Value vs Bet365 implied probability. Positive EV bets are statistically profitable long-term. Always bet responsibly.
        </p>
      )}
    </div>
  )
}
