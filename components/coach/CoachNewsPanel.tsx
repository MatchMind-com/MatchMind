'use client'

/**
 * CoachNewsPanel — slim slide-in news drawer for the AI Coach.
 *
 * Different from the old broken 3-column NewsPanel: this is an OVERLAY drawer
 * that slides in from the right (~320px wide on desktop, full overlay on
 * mobile). Closed by default; open state persists via localStorage.
 *
 * Mechanics borrowed from MemoriesDrawer (backdrop + translate-x aside +
 * ESC to close), but styled with the Athletic editorial token system
 * (bg-bg-surface, border-border-subtle, text-fg, brand-orange accents).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

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
  language?: string
  flag?: string
  category?: 'transfer' | 'general'
  journalist?: string | null
}

type Filter = 'all' | 'transfer'

function relativeTime(iso: string): string {
  const then = Date.parse(iso)
  if (isNaN(then)) return ''
  const diffMs = Date.now() - then
  const sec = Math.max(1, Math.floor(diffMs / 1000))
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

interface CoachNewsPanelProps {
  open: boolean
  onClose: () => void
}

export default function CoachNewsPanel({ open, onClose }: CoachNewsPanelProps) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/football-news', { cache: 'default' })
      const data = await res.json()
      setNews(Array.isArray(data.news) ? (data.news as NewsItem[]) : [])
      setLoaded(true)
    } catch {
      setNews([])
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load lazily — only when the drawer is first opened
  useEffect(() => {
    if (open && !loaded && !loading) {
      load()
    }
  }, [open, loaded, loading, load])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const transferCount = useMemo(
    () => news.filter(n => n.category === 'transfer').length,
    [news]
  )

  const visible = useMemo(() => {
    if (filter === 'transfer') return news.filter(n => n.category === 'transfer')
    return news
  }, [news, filter])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[360px] lg:w-[380px] bg-bg-surface border-l border-border-subtle z-50 flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
        aria-label="Football news"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
          <div className="min-w-0">
            <p className="eyebrow mb-0.5">Football News</p>
            <h2 className="text-fg font-extrabold text-base leading-tight tracking-tight">
              Latest from the wire
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-bg-elevated text-fg-muted hover:text-fg flex items-center justify-center transition shrink-0"
            title="Close (Esc)"
            aria-label="Close news panel"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Filter chips */}
        <div className="px-5 py-3 border-b border-border-subtle shrink-0 flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filter === 'all'
                ? 'bg-brand text-bg-base border-brand'
                : 'bg-transparent text-fg-secondary border-border-subtle hover:border-brand hover:text-brand'
            }`}
          >
            All news
            {loaded && (
              <span className="ml-1 opacity-70 font-stat">{news.length}</span>
            )}
          </button>
          <button
            onClick={() => setFilter('transfer')}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filter === 'transfer'
                ? 'bg-brand text-bg-base border-brand'
                : 'bg-transparent text-fg-secondary border-border-subtle hover:border-brand hover:text-brand'
            }`}
          >
            Transfers
            {loaded && (
              <span className="ml-1 opacity-70 font-stat">{transferCount}</span>
            )}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && !loaded && (
            <div className="px-5 py-10 text-center">
              <div className="inline-flex gap-1.5 mb-3">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
              <p className="text-fg-muted text-xs">Loading headlines…</p>
            </div>
          )}

          {loaded && visible.length === 0 && (
            <div className="px-5 py-12 text-center">
              <div className="text-2xl mb-2">📭</div>
              <p className="text-fg-muted text-xs">
                {filter === 'transfer'
                  ? 'No transfer headlines right now. Check back soon.'
                  : 'No headlines available right now.'}
              </p>
            </div>
          )}

          {loaded && visible.length > 0 && (
            <ul className="divide-y divide-border-subtle">
              {visible.map(item => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-bg-elevated/60 transition-colors group"
                  >
                    {item.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnail}
                        alt=""
                        loading="lazy"
                        className="w-12 h-12 rounded-md object-cover shrink-0 bg-bg-elevated"
                        onError={e => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-bg-elevated shrink-0 flex items-center justify-center text-fg-muted text-base">
                        {item.flag || '⚽'}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {item.category === 'transfer' && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand/15 text-brand border border-brand/30">
                            Transfer
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-fg-secondary truncate max-w-[110px]">
                          {item.source}
                        </span>
                        <span className="text-fg-muted text-[10px]">·</span>
                        <span className="text-fg-muted text-[10px] font-stat">
                          {relativeTime(item.publishedAt)}
                        </span>
                      </div>

                      {item.journalist && (
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[9px]">✍️</span>
                          <span className="text-[10px] font-bold text-brand/90">
                            {item.journalist}
                          </span>
                        </div>
                      )}

                      <p className="text-fg text-[13px] font-semibold leading-snug line-clamp-3 group-hover:text-brand transition-colors">
                        {item.title}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer link */}
        <div className="border-t border-border-subtle px-5 py-3 shrink-0">
          <a
            href="/dashboard"
            className="block text-center text-xs font-semibold text-fg-secondary hover:text-brand transition-colors"
          >
            View all news →
          </a>
        </div>
      </aside>
    </>
  )
}
