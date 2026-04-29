import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

interface RssSource {
  name: string
  url: string
}

const RSS_SOURCES: RssSource[] = [
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { name: 'Sky Sports', url: 'https://www.skysports.com/rss/12040' },
  { name: 'ESPN FC', url: 'https://www.espn.com/espn/rss/soccer/news' },
  { name: 'Goal.com', url: 'https://www.goal.com/feeds/en/news' },
  { name: 'The Guardian Football', url: 'https://www.theguardian.com/football/rss' },
  { name: '90min', url: 'https://www.90min.com/posts.rss' },
]

const FETCH_TIMEOUT_MS = 5000
const MAX_ITEMS = 30
const MAX_AGE_DAYS = 5
const SUMMARY_MAX_CHARS = 200

// Stable hash for ids (DJB2-ish) so React keys are deterministic across renders
function hashString(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

function stripCdata(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
}

function extractTag(item: string, tag: string): string | null {
  // Match <tag ...>content</tag> (greedy across newlines, but bounded to closing tag)
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = item.match(re)
  if (!m) return null
  return stripCdata(m[1]).trim()
}

function extractAttr(item: string, tag: string, attr: string): string | null {
  // <media:thumbnail url="..."/>  or  <enclosure url="..."  type="image/...">
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*["']([^"']+)["'][^>]*\\/?>`, 'i')
  const m = item.match(re)
  return m ? decodeXmlEntities(m[1]) : null
}

function extractItemBlocks(xml: string): string[] {
  const blocks: string[] = []
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    blocks.push(m[1])
  }
  return blocks
}

function parsePubDate(raw: string | null): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Best-effort league/team detection from headline keywords
const LEAGUE_KEYWORDS: Array<[string, RegExp]> = [
  ['Premier League', /\b(premier league|epl)\b/i],
  ['Champions League', /\bchampions league\b/i],
  ['Europa League', /\beuropa league\b/i],
  ['La Liga', /\bla liga\b/i],
  ['Serie A', /\bserie a\b/i],
  ['Bundesliga', /\bbundesliga\b/i],
  ['Ligue 1', /\bligue 1\b/i],
  ['World Cup', /\bworld cup\b/i],
  ['Euro', /\beuro(?:s|pean championship)?\b/i],
  ['FA Cup', /\bfa cup\b/i],
  ['EFL Cup', /\b(efl cup|carabao cup|league cup)\b/i],
]

function detectLeague(title: string): string | null {
  for (const [name, re] of LEAGUE_KEYWORDS) {
    if (re.test(title)) return name
  }
  return null
}

async function fetchFeed(source: RssSource): Promise<NewsItem[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        // Some RSS hosts (BBC, Sky) 403 without a UA
        'User-Agent': 'MatchMindBot/1.0 (+https://matchmindcom.com)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*;q=0.8',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`[football-news] ${source.name} returned ${res.status}`)
      return []
    }
    const xml = await res.text()
    return parseFeed(xml, source.name)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    console.warn(`[football-news] ${source.name} failed: ${reason}`)
    return []
  } finally {
    clearTimeout(timer)
  }
}

function parseFeed(xml: string, sourceName: string): NewsItem[] {
  const items: NewsItem[] = []
  const blocks = extractItemBlocks(xml)
  for (const block of blocks) {
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link')
    if (!title || !link) continue

    const descRaw = extractTag(block, 'description') || extractTag(block, 'content:encoded') || ''
    const summary = stripHtml(descRaw).slice(0, SUMMARY_MAX_CHARS)
    const pubRaw = extractTag(block, 'pubDate') || extractTag(block, 'dc:date') || extractTag(block, 'published')
    const pub = parsePubDate(pubRaw)

    const thumbnail =
      extractAttr(block, 'media:thumbnail', 'url') ||
      extractAttr(block, 'media:content', 'url') ||
      extractAttr(block, 'enclosure', 'url') ||
      null

    const cleanTitle = stripHtml(title)
    const cleanLink = decodeXmlEntities(link.trim())

    items.push({
      id: hashString(cleanLink),
      title: cleanTitle,
      summary,
      url: cleanLink,
      source: sourceName,
      publishedAt: (pub ?? new Date()).toISOString(),
      thumbnail,
      league: detectLeague(cleanTitle),
      team: null,
    })
  }
  return items
}

function deduplicate(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const item of items) {
    const key = normaliseTitle(item.title)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function buildFallback(): NewsItem[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'fallback-1',
      title: 'Live news feed temporarily unavailable',
      summary: 'We could not reach our news partners just now. Please refresh in a moment for the latest football headlines.',
      url: 'https://matchmindcom.com',
      source: 'fallback',
      publishedAt: now,
      thumbnail: null,
      league: null,
      team: null,
    },
    {
      id: 'fallback-2',
      title: 'Check BBC Sport for live football updates',
      summary: 'Visit BBC Sport for the latest match reports, injury news, and lineup updates from across world football.',
      url: 'https://www.bbc.co.uk/sport/football',
      source: 'fallback',
      publishedAt: now,
      thumbnail: null,
      league: null,
      team: null,
    },
    {
      id: 'fallback-3',
      title: 'Browse Sky Sports for transfer news and analysis',
      summary: 'Sky Sports has the latest transfer rumours, expert analysis, and breaking team news from the Premier League and beyond.',
      url: 'https://www.skysports.com/football',
      source: 'fallback',
      publishedAt: now,
      thumbnail: null,
      league: null,
      team: null,
    },
  ]
}

async function loadNews(): Promise<{ news: NewsItem[]; source: 'rss' | 'fallback' }> {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000

  const results = await Promise.allSettled(RSS_SOURCES.map(fetchFeed))
  const all: NewsItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  const fresh = all.filter(item => {
    const t = Date.parse(item.publishedAt)
    return !isNaN(t) && t >= cutoff
  })

  if (fresh.length === 0) {
    return { news: buildFallback(), source: 'fallback' }
  }

  fresh.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  const deduped = deduplicate(fresh).slice(0, MAX_ITEMS)
  return { news: deduped, source: 'rss' }
}

async function handle(): Promise<NextResponse> {
  try {
    const { news, source } = await loadNews()
    return NextResponse.json(
      {
        news,
        source,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=600, stale-while-revalidate=1800',
        },
      }
    )
  } catch (err) {
    console.error('[football-news] fatal error:', err)
    return NextResponse.json(
      {
        news: buildFallback(),
        source: 'fallback',
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  }
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  return handle()
}

export async function POST(_req: NextRequest): Promise<NextResponse> {
  return handle()
}
