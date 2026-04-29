import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  language: Language
  flag: string
}

interface RssSource {
  name: string
  url: string
  language: Language
  flag: string
}

const RSS_SOURCES: RssSource[] = [
  // English (existing)
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', language: 'English', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { name: 'Sky Sports', url: 'https://www.skysports.com/rss/12040', language: 'English', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { name: 'ESPN FC', url: 'https://www.espn.com/espn/rss/soccer/news', language: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
  { name: 'Goal.com', url: 'https://www.goal.com/feeds/en/news', language: 'English', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { name: 'The Guardian Football', url: 'https://www.theguardian.com/football/rss', language: 'English', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { name: '90min', url: 'https://www.90min.com/posts.rss', language: 'English', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },

  // Turkish (Süper Lig coverage)
  { name: 'Fanatik', url: 'https://www.fanatik.com.tr/rss/futbol', language: 'Turkish', flag: '\u{1F1F9}\u{1F1F7}' },
  { name: 'Sporx', url: 'https://www.sporx.com/xml/futbol.xml', language: 'Turkish', flag: '\u{1F1F9}\u{1F1F7}' },
  { name: 'NTV Spor', url: 'https://www.ntv.com.tr/spor.rss', language: 'Turkish', flag: '\u{1F1F9}\u{1F1F7}' },
  { name: 'Sabah Spor', url: 'https://www.sabah.com.tr/rss/spor.xml', language: 'Turkish', flag: '\u{1F1F9}\u{1F1F7}' },

  // Spanish (La Liga)
  { name: 'Marca', url: 'https://e00-marca.uecdn.es/rss/futbol/index.xml', language: 'Spanish', flag: '\u{1F1EA}\u{1F1F8}' },
  { name: 'AS', url: 'https://as.com/rss/tags/ultimas_noticias.xml', language: 'Spanish', flag: '\u{1F1EA}\u{1F1F8}' },

  // Italian (Serie A)
  { name: 'Gazzetta dello Sport', url: 'https://www.gazzetta.it/rss/calcio.xml', language: 'Italian', flag: '\u{1F1EE}\u{1F1F9}' },
  { name: 'Football Italia', url: 'https://football-italia.net/feed/', language: 'Italian', flag: '\u{1F1EE}\u{1F1F9}' },

  // German (Bundesliga)
  { name: 'Kicker', url: 'https://www.kicker.de/news/aktuell/rss.xml', language: 'German', flag: '\u{1F1E9}\u{1F1EA}' },

  // French (Ligue 1)
  { name: "L'Equipe Football", url: 'https://www.lequipe.fr/rss/actu_rss_Football.xml', language: 'French', flag: '\u{1F1EB}\u{1F1F7}' },

  // Brazilian (Brasileirão)
  { name: 'Globo Esporte', url: 'https://ge.globo.com/rss/futebol/', language: 'Brazilian', flag: '\u{1F1E7}\u{1F1F7}' },

  // Other English sources for breadth
  { name: 'Football365', url: 'https://www.football365.com/feed', language: 'English', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { name: 'FourFourTwo', url: 'https://www.fourfourtwo.com/feeds/all', language: 'English', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { name: 'Daily Mail Football', url: 'https://www.dailymail.co.uk/sport/football/index.rss', language: 'English', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { name: 'Reddit /r/soccer', url: 'https://www.reddit.com/r/soccer/.rss?limit=20', language: 'Other', flag: '\u{1F30D}' },
  { name: 'Reuters Sports', url: 'https://feeds.reuters.com/reuters/sportsNews', language: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
]

const FETCH_TIMEOUT_MS = 5000
const MAX_ITEMS = 60
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

function extractEntryBlocks(xml: string): string[] {
  // Atom format uses <entry>...</entry>
  const blocks: string[] = []
  const re = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    blocks.push(m[1])
  }
  return blocks
}

function extractAtomLink(entry: string): string | null {
  // Atom: <link href="..." /> or <link rel="alternate" href="..." />
  // Prefer rel="alternate" if present, otherwise first link.
  const altRe = /<link\b[^>]*\brel\s*=\s*["']alternate["'][^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?>/i
  const altMatch = entry.match(altRe)
  if (altMatch) return decodeXmlEntities(altMatch[1])

  const hrefRe = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?>/i
  const hrefMatch = entry.match(hrefRe)
  if (hrefMatch) return decodeXmlEntities(hrefMatch[1])

  // Fallback: <link>url</link> (RSS-style inside atom)
  return extractTag(entry, 'link')
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
  ['Conference League', /\bconference league\b/i],
  ['La Liga', /\b(la liga|laliga)\b/i],
  ['Serie A', /\bserie a\b/i],
  ['Bundesliga', /\bbundesliga\b/i],
  ['Ligue 1', /\bligue 1\b/i],
  ['Süper Lig', /\b(s[üu]per lig|s[üu]perlig)\b/i],
  ['Eredivisie', /\beredivisie\b/i],
  ['Saudi Pro League', /\b(saudi pro league|spl)\b/i],
  ['MLS', /\b(mls|major league soccer)\b/i],
  ['J1 League', /\bj1 league\b/i],
  ['Brasileirão', /\b(brasileir[ãa]o|brasileirao|s[ée]rie a brasileira)\b/i],
  ['Liga MX', /\bliga mx\b/i],
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
        // Some RSS hosts (BBC, Sky, Reddit) 403 without a proper UA
        'User-Agent':
          'Mozilla/5.0 (compatible; MatchMindBot/1.0; +https://matchmindcom.com)',
        Accept:
          'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`[football-news] ${source.name} returned ${res.status}`)
      return []
    }
    const xml = await res.text()
    return parseFeed(xml, source)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    console.warn(`[football-news] ${source.name} failed: ${reason}`)
    return []
  } finally {
    clearTimeout(timer)
  }
}

function parseFeed(xml: string, source: RssSource): NewsItem[] {
  const items: NewsItem[] = []

  // RSS 2.0 / RDF style: <item>...</item>
  const itemBlocks = extractItemBlocks(xml)
  for (const block of itemBlocks) {
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link')
    if (!title || !link) continue

    const descRaw =
      extractTag(block, 'description') ||
      extractTag(block, 'content:encoded') ||
      ''
    const summary = stripHtml(descRaw).slice(0, SUMMARY_MAX_CHARS)
    const pubRaw =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'dc:date') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated')
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
      source: source.name,
      publishedAt: (pub ?? new Date()).toISOString(),
      thumbnail,
      league: detectLeague(cleanTitle),
      team: null,
      language: source.language,
      flag: source.flag,
    })
  }

  // Atom style: <entry>...</entry>
  const entryBlocks = extractEntryBlocks(xml)
  for (const block of entryBlocks) {
    const title = extractTag(block, 'title')
    const link = extractAtomLink(block)
    if (!title || !link) continue

    const descRaw =
      extractTag(block, 'summary') ||
      extractTag(block, 'content') ||
      extractTag(block, 'content:encoded') ||
      ''
    const summary = stripHtml(descRaw).slice(0, SUMMARY_MAX_CHARS)
    const pubRaw =
      extractTag(block, 'published') ||
      extractTag(block, 'updated') ||
      extractTag(block, 'pubDate')
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
      source: source.name,
      publishedAt: (pub ?? new Date()).toISOString(),
      thumbnail,
      league: detectLeague(cleanTitle),
      team: null,
      language: source.language,
      flag: source.flag,
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
  const englishFlag = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}'
  return [
    {
      id: 'fallback-1',
      title: 'Live news feed temporarily unavailable',
      summary:
        'We could not reach our news partners just now. Please refresh in a moment for the latest football headlines.',
      url: 'https://matchmindcom.com',
      source: 'fallback',
      publishedAt: now,
      thumbnail: null,
      league: null,
      team: null,
      language: 'English',
      flag: englishFlag,
    },
    {
      id: 'fallback-2',
      title: 'Check BBC Sport for live football updates',
      summary:
        'Visit BBC Sport for the latest match reports, injury news, and lineup updates from across world football.',
      url: 'https://www.bbc.co.uk/sport/football',
      source: 'fallback',
      publishedAt: now,
      thumbnail: null,
      league: null,
      team: null,
      language: 'English',
      flag: englishFlag,
    },
    {
      id: 'fallback-3',
      title: 'Browse Sky Sports for transfer news and analysis',
      summary:
        'Sky Sports has the latest transfer rumours, expert analysis, and breaking team news from the Premier League and beyond.',
      url: 'https://www.skysports.com/football',
      source: 'fallback',
      publishedAt: now,
      thumbnail: null,
      league: null,
      team: null,
      language: 'English',
      flag: englishFlag,
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
