'use client'
import { useEffect, useState } from 'react'

interface NewsItem {
  id: string
  title: string
  summary: string
  url: string
  source: string
  publishedAt: string
  thumbnail: string | null
  league: string | null
  team: string | null
}

const SOURCE_BADGE: Record<string, string> = {
  'BBC Sport': 'bg-red-500/15 text-red-300 border-red-500/30',
  'Sky Sports': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'ESPN FC': 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  'Goal.com': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'The Guardian Football': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  '90min': 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  fallback: 'bg-white/5 text-white/40 border-white/10',
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso)
  if (isNaN(then)) return ''
  const diffMs = Date.now() - then
  const sec = Math.max(1, Math.floor(diffMs / 1000))
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

export default function NewsPanel() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [source, setSource] = useState<string>('')
  const [fetchedAt, setFetchedAt] = useState<string>('')

  async function fetchNews() {
    setLoading(true)
    try {
      const res = await fetch('/api/football-news', { cache: 'no-store' })
      const data = await res.json()
      setNews(Array.isArray(data.news) ? data.news : [])
      setSource(data.source || '')
      setFetchedAt(data.fetchedAt || '')
      setLoaded(true)
    } catch {
      setNews([])
      setLoaded(true)
    }
    setLoading(false)
  }

  // Auto-load on mount so the panel is never empty
  useEffect(() => {
    fetchNews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleNews = filter.trim()
    ? news.filter(item => {
        const q = filter.toLowerCase()
        return (
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          (item.league?.toLowerCase().includes(q) ?? false) ||
          (item.team?.toLowerCase().includes(q) ?? false) ||
          item.source.toLowerCase().includes(q)
        )
      })
    : news

  return (
    <div className="flex flex-col h-full bg-[#0E1628] rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            Live Football News
          </h3>
          {loaded && (
            <span
              className={`text-xs ${
                source === 'rss' ? 'text-emerald-400/80' : 'text-amber-400/70'
              }`}
            >
              {source === 'rss' ? 'Live' : source === 'fallback' ? 'Offline' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter: Arsenal, Champions League..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={fetchNews}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
        {loaded && fetchedAt && (
          <p className="text-white/30 text-[10px] mt-2">
            Updated {relativeTime(fetchedAt)} - {news.length} stories from {RSS_SOURCE_COUNT(news)} sources
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && !loaded && (
          <div className="p-8 text-center">
            <div className="inline-flex gap-1.5 mb-3">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-white/30 text-xs">Loading latest news...</p>
          </div>
        )}

        {loaded && visibleNews.length === 0 && (
          <div className="p-6 text-center text-white/30 text-xs">
            {filter
              ? 'No news matches that filter.'
              : 'No news available right now. Try refreshing.'}
          </div>
        )}

        {loaded && visibleNews.length > 0 && (
          <div className="divide-y divide-white/5">
            {visibleNews.map(item => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 hover:bg-white/[0.03] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  {item.thumbnail && (
                    <img
                      src={item.thumbnail}
                      alt=""
                      loading="lazy"
                      className="w-16 h-16 rounded-lg object-cover shrink-0 bg-white/5"
                      onError={e => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          SOURCE_BADGE[item.source] || SOURCE_BADGE.fallback
                        }`}
                      >
                        {item.source}
                      </span>
                      {item.league && (
                        <span className="text-orange-400/80 text-[10px] font-medium">
                          {item.league}
                        </span>
                      )}
                      <span className="text-white/30 text-[10px]">
                        {relativeTime(item.publishedAt)}
                      </span>
                    </div>
                    <p className="text-white text-xs font-medium leading-snug mb-1 group-hover:text-blue-300 transition-colors">
                      {item.title}
                    </p>
                    {item.summary && (
                      <p className="text-white/40 text-xs leading-relaxed line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RSS_SOURCE_COUNT(items: NewsItem[]): number {
  const set = new Set<string>()
  for (const i of items) set.add(i.source)
  return set.size
}
