'use client'
import { useEffect, useMemo, useState } from 'react'

type Language =
  | 'English'
  | 'Turkish'
  | 'Spanish'
  | 'Italian'
  | 'German'
  | 'French'
  | 'Brazilian'
  | 'Other'

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
  language?: Language
  flag?: string
}

const SOURCE_BADGE: Record<string, string> = {
  // English (existing)
  'BBC Sport': 'bg-red-500/15 text-red-300 border-red-500/30',
  'Sky Sports': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'ESPN FC': 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  'Goal.com': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'The Guardian Football': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  '90min': 'bg-violet-500/15 text-violet-300 border-violet-500/30',

  // Turkish
  Fanatik: 'bg-red-600/15 text-red-300 border-red-600/30',
  Sporx: 'bg-blue-600/15 text-blue-300 border-blue-600/30',
  'NTV Spor': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'Sabah Spor': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',

  // Spanish
  Marca: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  AS: 'bg-red-500/15 text-red-300 border-red-500/30',

  // Italian
  'Gazzetta dello Sport': 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  'Football Italia': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',

  // German
  Kicker: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',

  // French
  "L'Equipe Football": 'bg-red-500/15 text-red-300 border-red-500/30',

  // Brazilian
  'Globo Esporte': 'bg-red-500/15 text-red-300 border-red-500/30',

  // Other English
  Football365: 'bg-zinc-700/40 text-zinc-200 border-zinc-600/40',
  FourFourTwo: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  'Daily Mail Football': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'Reddit /r/soccer': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'Reuters Sports': 'bg-teal-500/15 text-teal-300 border-teal-500/30',

  fallback: 'bg-white/5 text-white/40 border-white/10',
}

const ENGLISH_FLAG = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}'

const LANGUAGE_FLAGS: Record<Language, string> = {
  English: ENGLISH_FLAG,
  Turkish: '\u{1F1F9}\u{1F1F7}',
  Spanish: '\u{1F1EA}\u{1F1F8}',
  Italian: '\u{1F1EE}\u{1F1F9}',
  German: '\u{1F1E9}\u{1F1EA}',
  French: '\u{1F1EB}\u{1F1F7}',
  Brazilian: '\u{1F1E7}\u{1F1F7}',
  Other: '\u{1F30D}',
}

const LANGUAGE_ORDER: Language[] = [
  'English',
  'Turkish',
  'Spanish',
  'Italian',
  'German',
  'French',
  'Brazilian',
  'Other',
]

type LanguageFilter = 'All' | Language

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
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>('All')
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

  // Per-language counts (computed once per news change)
  const languageCounts = useMemo(() => {
    const counts: Partial<Record<Language, number>> = {}
    for (const item of news) {
      const lang = (item.language ?? 'English') as Language
      counts[lang] = (counts[lang] ?? 0) + 1
    }
    return counts
  }, [news])

  // Languages that actually appear in the current feed (preserves order)
  const presentLanguages: Language[] = useMemo(() => {
    return LANGUAGE_ORDER.filter(l => (languageCounts[l] ?? 0) > 0)
  }, [languageCounts])

  const visibleNews = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return news.filter(item => {
      const lang = (item.language ?? 'English') as Language
      if (languageFilter !== 'All' && lang !== languageFilter) return false
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        (item.league?.toLowerCase().includes(q) ?? false) ||
        (item.team?.toLowerCase().includes(q) ?? false) ||
        item.source.toLowerCase().includes(q)
      )
    })
  }, [news, filter, languageFilter])

  return (
    <div className="flex flex-col h-full bg-[#0E1628] border border-white/10 overflow-hidden">
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
            placeholder="Filter: Galatasaray, Real Madrid, Champions League..."
            className="flex-1 bg-white/5 border border-white/10 px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={fetchNews}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? '...' : 'Refresh'}
          </button>
        </div>

        {/* Language filter chips */}
        {loaded && presentLanguages.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setLanguageFilter('All')}
              className={`text-[10px] px-2 py-1 border transition-colors ${
                languageFilter === 'All'
                  ? 'bg-blue-500/30 text-blue-100 border-blue-400/60'
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
              }`}
            >
              All <span className="opacity-70">({news.length})</span>
            </button>
            {presentLanguages.map(lang => {
              const active = languageFilter === lang
              return (
                <button
                  key={lang}
                  onClick={() => setLanguageFilter(lang)}
                  className={`text-[10px] px-2 py-1 border transition-colors ${
                    active
                      ? 'bg-blue-500/30 text-blue-100 border-blue-400/60'
                      : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="mr-1">{LANGUAGE_FLAGS[lang]}</span>
                  {lang}{' '}
                  <span className="opacity-70">({languageCounts[lang]})</span>
                </button>
              )
            })}
          </div>
        )}

        {loaded && fetchedAt && (
          <p className="text-white/30 text-[10px] mt-2">
            Updated {relativeTime(fetchedAt)} - {news.length} stories from{' '}
            {RSS_SOURCE_COUNT(news)} sources
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
                  className="w-2 h-2 bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-white/30 text-xs">Loading latest news...</p>
          </div>
        )}

        {loaded && visibleNews.length === 0 && (
          <div className="p-6 text-center text-white/30 text-xs">
            {filter || languageFilter !== 'All'
              ? 'No news matches that filter.'
              : 'No news available right now. Try refreshing.'}
          </div>
        )}

        {loaded && visibleNews.length > 0 && (
          <div className="divide-y divide-white/5">
            {visibleNews.map(item => {
              const lang = (item.language ?? 'English') as Language
              const flag = item.flag || LANGUAGE_FLAGS[lang]
              return (
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
                        className="w-16 h-16 object-cover shrink-0 bg-white/5"
                        onError={e => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 border inline-flex items-center gap-1 ${
                            SOURCE_BADGE[item.source] || SOURCE_BADGE.fallback
                          }`}
                        >
                          <span aria-hidden>{flag}</span>
                          <span>{item.source}</span>
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
              )
            })}
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
