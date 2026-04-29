'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface NewsItem {
  id: string
  title: string
  summary: string
  url: string
  source: string
  publishedAt: string
  thumbnail: string | null
  league: string | null
  flag: string
}

function relativeTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

function HeadlineRow({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 py-3 px-4 hover:bg-bg-elevated/60 transition-colors group rounded-lg"
    >
      {/* Thumbnail */}
      {item.thumbnail ? (
        <div className="relative w-14 h-14 rounded-md overflow-hidden bg-bg-elevated shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumbnail}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="w-14 h-14 rounded-md bg-bg-elevated shrink-0 flex items-center justify-center text-fg-muted text-xs">
          {item.flag}
        </div>
      )}

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-fg text-sm font-semibold leading-snug line-clamp-2 group-hover:text-brand transition-colors">
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-fg-muted">
          <span className="font-medium truncate max-w-[100px]">{item.source}</span>
          <span>·</span>
          <span className="font-stat shrink-0">{relativeTime(item.publishedAt)}</span>
          {item.league && (
            <>
              <span>·</span>
              <span className="text-fg-secondary truncate max-w-[120px] hidden sm:inline">{item.league}</span>
            </>
          )}
        </div>
      </div>
    </a>
  )
}

function HeadlineSkeleton() {
  return (
    <div className="flex items-start gap-3 py-3 px-4 animate-pulse">
      <div className="w-14 h-14 rounded-md bg-bg-elevated shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-4 w-full bg-bg-elevated rounded mb-2" />
        <div className="h-3 w-2/3 bg-bg-elevated rounded mb-2" />
        <div className="h-2.5 w-24 bg-bg-elevated rounded" />
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * NewsHeadlines — top 5 from /api/football-news
 * ──────────────────────────────────────────────────────────── */
export default function NewsHeadlines() {
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch('/api/football-news', { cache: 'default' })
        if (!res.ok) throw new Error('bad status')
        const json = await res.json()
        const news: NewsItem[] = json.news || []
        if (!cancelled) setItems(news.slice(0, 5))
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow">Football News</p>
        {items && items.length > 0 && (
          <a
            href="https://news.google.com/search?q=football"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-muted hover:text-brand text-[11px] font-medium transition-colors"
          >
            more news →
          </a>
        )}
      </div>

      {loading && (
        <div className="-mx-4 divide-y divide-border-subtle/40">
          {Array.from({ length: 5 }).map((_, i) => <HeadlineSkeleton key={i} />)}
        </div>
      )}

      {!loading && error && (
        <p className="text-fg-muted text-xs py-4">— couldn&apos;t load headlines</p>
      )}

      {!loading && !error && items && items.length === 0 && (
        <p className="text-fg-muted text-xs py-4">No headlines yet.</p>
      )}

      {!loading && !error && items && items.length > 0 && (
        <div className="-mx-4 divide-y divide-border-subtle/40">
          {items.map(it => <HeadlineRow key={it.id} item={it} />)}
        </div>
      )}
    </section>
  )
}
