'use client'
import { useState } from 'react'

interface NewsItem {
  title: string
  summary: string
  category: string
  league: string
  team?: string
  urgency: string
  timestamp: string
}

const CAT_ICONS: Record<string, string> = {
  injury: '🩺', lineup: '📋', transfer: '💰',
  match_result: '⚽', preview: '🔍', other: '📌',
}

const URGENCY_BORDER: Record<string, string> = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-white/20',
}

const QUICK_SEARCHES = [
  'Premier League injuries',
  'Champions League preview',
  'La Liga lineups',
  'Transfer news today',
  'Bundesliga team news',
]

export default function NewsPanel() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [source, setSource] = useState('')

  async function fetchNews(q?: string) {
    const searchQuery = q || query || 'Premier League La Liga Champions League football news injuries lineups'
    setLoading(true)
    try {
      const res = await fetch('/api/football-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      })
      const data = await res.json()
      setNews(data.news || [])
      setSource(data.source || '')
      setLoaded(true)
    } catch {
      setNews([])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-[#0E0E1A] rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            📰 Live Football News
          </h3>
          {loaded && source === 'ai' && (
            <span className="text-white/30 text-xs">AI knowledge</span>
          )}
          {loaded && source === 'web' && (
            <span className="text-emerald-500/60 text-xs">🌐 Live</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchNews()}
            placeholder="Search: Arsenal, Champions League..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={() => fetchNews()}
            disabled={loading}
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? '...' : 'Get News'}
          </button>
        </div>
        {/* Quick searches */}
        {!loaded && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK_SEARCHES.map(q => (
              <button
                key={q}
                onClick={() => { setQuery(q); fetchNews(q) }}
                className="text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!loaded && !loading && (
          <div className="p-8 text-center text-white/20 flex flex-col items-center gap-3">
            <div className="text-4xl">📰</div>
            <p className="text-xs leading-relaxed">
              Get live injury reports, team news, lineup updates and match previews
            </p>
          </div>
        )}

        {loading && (
          <div className="p-8 text-center">
            <div className="inline-flex gap-1.5 mb-3">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-white/30 text-xs">Searching latest news...</p>
          </div>
        )}

        {loaded && news.length === 0 && (
          <div className="p-6 text-center text-white/30 text-xs">
            No news found. Try a different search term.
          </div>
        )}

        {loaded && news.length > 0 && (
          <div className="divide-y divide-white/5">
            {news.map((item, i) => (
              <div
                key={i}
                className={`p-4 border-l-2 ${URGENCY_BORDER[item.urgency] || URGENCY_BORDER.low} hover:bg-white/[0.02] transition-colors`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5 shrink-0">{CAT_ICONS[item.category] || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-violet-400 text-xs font-medium">{item.league}</span>
                      {item.team && <span className="text-white/30 text-xs">{item.team}</span>}
                      <span className="text-white/20 text-xs">{item.timestamp}</span>
                    </div>
                    <p className="text-white text-xs font-medium leading-snug mb-1">{item.title}</p>
                    <p className="text-white/40 text-xs leading-relaxed">{item.summary}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loaded && (
        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            onClick={() => fetchNews()}
            disabled={loading}
            className="w-full text-white/30 hover:text-white/60 text-xs transition-colors"
          >
            ↻ Refresh news
          </button>
        </div>
      )}
    </div>
  )
}
