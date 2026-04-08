'use client'
import { useState } from 'react'
import Link from 'next/link'
import { BetSlip } from '@/lib/types'

type Suggestion = { title: string; insight: string; action: string; type: 'positive' | 'warning' | 'info' | 'danger' }

const DEMO_SUGGESTIONS: Suggestion[] = [
  {
    type: 'warning',
    title: 'Over 2.5 Goals is your weakest bet type',
    insight: "You've placed 14 Over 2.5 bets this month with a 36% win rate — well below the breakeven of ~53% at typical odds of 1.90. This single bet type is responsible for 78% of your total losses.",
    action: 'Consider capping Over 2.5 bets at 2 per matchday and shifting volume to BTTS or Match Result where your win rate is 61%.',
  },
  {
    type: 'positive',
    title: 'Premier League is your most profitable league',
    insight: "Your Premier League bets show a +12.4% ROI over 18 settled bets. You have a clear edge here — likely from following team news that the market doesn't fully price in.",
    action: 'Increase your average stake on Premier League bets by 25–30% while keeping the same selection criteria.',
  },
  {
    type: 'info',
    title: 'Your stake sizing is inconsistent',
    insight: 'Stakes range from £2 to £45 with no clear pattern. You tend to stake larger on gut-feel bets that are losing money, and smaller on value bets where the AI edge is highest.',
    action: 'Adopt flat betting at 2% of bankroll per bet. Consistent sizing is the single biggest ROI lever for most bettors.',
  },
  {
    type: 'danger',
    title: 'Chasing losses after defeats — a key pattern',
    insight: 'After a loss, your next bet is 2.3× larger on average. You\'ve had 4 losing streaks of 3+ this month — each followed by a larger stake that extended the drawdown.',
    action: 'Set a rule: never exceed your planned stake regardless of recent results. Consider a 24-hour cool-off after 3 consecutive losses.',
  },
]

export default function SuggestionsPanel({ userId, bets }: { userId: string; bets: BetSlip[] }) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(false)

  async function generateSuggestions() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bets }),
      })
      const data = await res.json()
      if (res.ok) { setSuggestions(data.suggestions); setGenerated(true) }
      else setError(data.error || 'Failed to generate suggestions')
    } catch { setError('Network error. Please try again.') }
    setLoading(false)
  }

  const colors: Record<string, string> = {
    positive: 'border-emerald-500/20 bg-emerald-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    info: 'border-violet-500/20 bg-violet-500/5',
    danger: 'border-red-500/20 bg-red-500/5',
  }
  const iconColors: Record<string, string> = {
    positive: 'text-emerald-400 bg-emerald-500/10',
    warning: 'text-amber-400 bg-amber-500/10',
    info: 'text-violet-400 bg-violet-500/10',
    danger: 'text-red-400 bg-red-500/10',
  }
  const icons: Record<string, React.ReactNode> = {
    positive: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
    warning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    info: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    danger: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  }

  const settled = bets.filter(b => b.result !== 'pending' && b.result !== 'void')
  const showDemo = bets.length === 0

  function SuggestionCard({ s, blurred }: { s: Suggestion; blurred?: boolean }) {
    return (
      <div className={`border rounded-2xl p-6 relative ${colors[s.type]} ${blurred ? 'select-none' : ''}`}>
        {blurred && <div className="absolute inset-0 backdrop-blur-[5px] bg-[#0B0B14]/40 rounded-2xl z-10" />}
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColors[s.type]}`}>{icons[s.type]}</div>
          <div>
            <h3 className="text-white font-semibold mb-2">{s.title}</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">{s.insight}</p>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide shrink-0 mt-0.5">Action:</span>
              <p className="text-slate-300 text-xs leading-relaxed">{s.action}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Suggestions</h1>
          <p className="text-slate-500 text-sm mt-1">Personalised insights and recommendations based on your betting history</p>
        </div>
        {!showDemo && (
          <button onClick={generateSuggestions} disabled={loading || bets.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-500/20">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Analysing...</>
            ) : (
              <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="12" r="10"/></svg>{generated ? 'Refresh Analysis' : 'Analyse My Bets'}</>
            )}
          </button>
        )}
      </div>

      {/* Demo preview for users with no bets */}
      {showDemo && (
        <div className="relative">
          {/* Preview label */}
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-semibold px-3 py-1 rounded-full">
              👀 Preview — Example Analysis
            </span>
            <span className="text-white/30 text-xs">This is what your AI coaching report looks like</span>
          </div>

          {/* First card — fully visible */}
          <div className="mb-3">
            <SuggestionCard s={DEMO_SUGGESTIONS[0]} />
          </div>

          {/* Second card — partially blurred */}
          <div className="mb-3">
            <SuggestionCard s={DEMO_SUGGESTIONS[1]} blurred />
          </div>

          {/* Cards 3 & 4 — heavily blurred, with unlock CTA overlay */}
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pointer-events-none">
              <SuggestionCard s={DEMO_SUGGESTIONS[2]} blurred />
              <SuggestionCard s={DEMO_SUGGESTIONS[3]} blurred />
            </div>

            {/* Unlock overlay */}
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="bg-[#13131F]/95 border border-violet-500/30 rounded-2xl p-8 text-center max-w-sm mx-4 shadow-2xl shadow-violet-900/30">
                <div className="w-14 h-14 bg-violet-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="12" r="10"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Unlock your real analysis</h3>
                <p className="text-white/40 text-sm mb-5">
                  Log your first bet, mark it won or lost, and the AI will analyse your actual patterns — not this example.
                </p>
                <Link href="/dashboard"
                  className="block bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all shadow-lg shadow-violet-500/20">
                  Add My First Bet →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Normal state — bets exist, not yet generated */}
      {!showDemo && bets.length > 0 && !generated && !loading && (
        <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border border-violet-500/20 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 bg-violet-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="12" r="10"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3 className="text-white font-semibold mb-2">Ready to analyse {settled.length} settled bet{settled.length !== 1 ? 's' : ''}</h3>
          <p className="text-slate-400 text-sm mb-6">The AI will examine your win rates by league and bet type, bankroll trends, streak patterns, and give you specific actionable recommendations.</p>
          <button onClick={generateSuggestions}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold px-8 py-3 rounded-xl transition-all shadow-lg shadow-violet-500/20">
            Generate My Insights
          </button>
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mt-4">{error}</div>}

      {suggestions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((s, i) => (
            <SuggestionCard key={i} s={s} />
          ))}
        </div>
      )}
    </div>
  )
}
