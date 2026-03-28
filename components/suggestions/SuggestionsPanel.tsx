'use client'
import { useState } from 'react'
import { BetSlip } from '@/lib/types'

type Suggestion = { title: string; insight: string; action: string; type: 'positive' | 'warning' | 'info' | 'danger' }

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Suggestions</h1>
          <p className="text-slate-500 text-sm mt-1">Personalised insights and recommendations based on your betting history</p>
        </div>
        <button onClick={generateSuggestions} disabled={loading || bets.length === 0}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-500/20">
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Analysing...</>
          ) : (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="12" r="10"/></svg>{generated ? 'Refresh Analysis' : 'Analyse My Bets'}</>
          )}
        </button>
      </div>

      {bets.length === 0 && (
        <div className="bg-[#13131F] border border-white/5 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <h3 className="text-white font-semibold mb-2">No bets to analyse yet</h3>
          <p className="text-slate-500 text-sm">Add some bet slips from the Home page and mark them as won or lost. Once you have data, the AI will provide personalised insights.</p>
        </div>
      )}

      {bets.length > 0 && !generated && !loading && (
        <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border border-violet-500/20 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 bg-violet-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="12" r="10"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3 className="text-white font-semibold mb-2">Ready to analyse {settled.length} settled bets</h3>
          <p className="text-slate-400 text-sm mb-6">The AI will examine your win rates by league and bet type, bankroll trends, streak patterns, and give you specific actionable recommendations.</p>
          <button onClick={generateSuggestions}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold px-8 py-3 rounded-xl transition-all shadow-lg shadow-violet-500/20">
            Generate My Insights
          </button>
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      {suggestions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((s, i) => (
            <div key={i} className={`border rounded-2xl p-6 ${colors[s.type]}`}>
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
          ))}
        </div>
      )}
    </div>
  )
}
