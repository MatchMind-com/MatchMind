/**
 * POST /api/admin/post-instagram
 *
 * Posts an IG-format card to Instagram (Business / Creator account).
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *
 * Body (all optional):
 *   {
 *     "card":         "value-card" | "recap" | "biggest-wins" | "team-stats"
 *                       | "coach-positioning" | "fixture-deepdive"
 *                       | "ev-explainer" | "tour"
 *                       // override the auto-selected card
 *     "imageUrl":     "https://..."          // override URL entirely
 *     "caption":      "..."                  // override caption
 *     "carousel":     ["url1","url2",...]    // post as carousel of up to 10
 *     "dryRun":       false
 *   }
 *
 * AUTO-ROTATION (when no card override):
 *   Mon  → ig-recap (yesterday W/L). If losing day → biggest-wins.
 *   Tue  → ig-value-card (today's #1 EV, international-only)
 *   Wed  → ig-fixture-deepdive (next major international fixture)
 *   Thu  → ig-value-card (international)
 *   Fri  → ig-biggest-wins (weekly hype card)
 *   Sat  → ig-value-card (international)
 *   Sun  → ig-team-stats / ig-coach-positioning (alternating)
 *
 * Required env vars (set in Vercel):
 *   INSTAGRAM_ACCESS_TOKEN  long-lived token (60d) from IG Business Login
 *   INSTAGRAM_USER_ID       app-scoped IG user id
 */

import { NextResponse } from 'next/server'
import { getInstagramToken } from '@/lib/instagram-token'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'
const GRAPH_BASE = 'https://graph.instagram.com/v23.0'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Card selection ───────────────────────────────────────────────────

type CardKey =
  | 'value-card' | 'recap' | 'biggest-wins' | 'team-stats'
  | 'coach-positioning' | 'fixture-deepdive'
  | 'ev-explainer' | 'tour'
  | 'value-bet-math'

/**
 * Yesterday's net P&L on settled value bets.
 * Returns null on error so the caller can fall through to a safe default.
 */
async function yesterdayPnL(): Promise<{ profit: number; settled: number } | null> {
  try {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
    const ymd = yesterday.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
    const [y, m, d] = ymd.split('-').map(Number)
    const from = new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString()
    const to = new Date(Date.UTC(y, m - 1, d, 23, 59, 59)).toISOString()

    const { data } = await supabase
      .from('prediction_records')
      .select('odds, result')
      .eq('is_value_bet', true)
      .not('result', 'is', null)
      .gte('kick_off', from)
      .lte('kick_off', to)
      .gt('ev_percent', 0)
      .lte('ev_percent', 10)

    const rows = (data ?? []) as Array<{ odds: number | null; result: 'win'|'loss'|'void' }>
    const stake = 10
    const profit = rows.reduce((acc, r) => {
      if (r.result === 'void' || !r.odds) return acc
      return acc + (r.result === 'win' ? stake * (r.odds - 1) : -stake)
    }, 0)
    const settled = rows.filter(r => r.result !== 'void').length
    return { profit, settled }
  } catch {
    return null
  }
}

/**
 * Pick the next upcoming international fixture for the fixture deep-dive card.
 * Falls back to value-card if no upcoming intl match in the next 72h.
 */
async function nextIntlFixtureId(): Promise<number | null> {
  try {
    const res = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
    const json = await res.json()
    const preds = Array.isArray(json?.predictions) ? json.predictions : []
    const now = Date.now()
    const horizon = now + 72 * 3600 * 1000

    const isIntl = (league: string) => {
      const l = (league ?? '').toLowerCase()
      if (l.includes('club world cup')) return false
      return l.includes('world cup') || l.includes('friendlies (intl)') ||
             l.includes('nations league') || /\bqualif/.test(l) ||
             /afcon|africa cup/.test(l) || /\beuro\b/.test(l) ||
             l.includes('copa america') || l.includes('gold cup') ||
             l.includes('asian cup') || l.includes('concacaf nations')
    }

    const candidates = preds
      .filter((p: { date?: string; league?: string; id?: number }) => {
        if (!p.date || !p.league || !p.id) return false
        const t = new Date(p.date).getTime()
        return t > now && t < horizon && isIntl(p.league)
      })
      .sort((a: { date: string }, b: { date: string }) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return candidates[0]?.id ?? null
  } catch {
    return null
  }
}

/**
 * Resolve which card to post today.
 * - Honours `card` body override.
 * - Otherwise rotates by day-of-week.
 * - On Mon, checks yesterday's P&L — if losing/zero, switches to biggest-wins.
 */
async function resolveCard(override?: CardKey): Promise<{ card: CardKey; reason: string; fixtureId?: number }> {
  if (override) return { card: override, reason: 'override' }

  const dayOfWeek = new Date().getUTCDay() // 0=Sun .. 6=Sat
  const weekParity = Math.floor(Date.now() / (7 * 24 * 3600 * 1000)) % 2

  if (dayOfWeek === 1) {
    // Monday: recap if yesterday was profitable, else biggest-wins
    const pnl = await yesterdayPnL()
    if (!pnl || pnl.settled === 0 || pnl.profit <= 0) {
      return { card: 'biggest-wins', reason: `mon-skip-recap (pnl=${pnl?.profit ?? 'null'}, settled=${pnl?.settled ?? 'null'})` }
    }
    return { card: 'recap', reason: `mon-recap (pnl=+${pnl.profit.toFixed(2)})` }
  }

  if (dayOfWeek === 3) {
    // Wed: try fixture deep-dive for next intl game, else value-card
    const id = await nextIntlFixtureId()
    if (id) return { card: 'fixture-deepdive', reason: `wed-fixture id=${id}`, fixtureId: id }
    return { card: 'value-card', reason: 'wed-fallback (no intl fixture in 72h)' }
  }

  if (dayOfWeek === 5) {
    return { card: 'biggest-wins', reason: 'fri-hype' }
  }

  if (dayOfWeek === 0) {
    // Sun alternates team-stats / coach-positioning
    return weekParity === 0
      ? { card: 'team-stats', reason: 'sun-stats' }
      : { card: 'coach-positioning', reason: 'sun-coach' }
  }

  // Tue, Thu, Sat → value-card
  return { card: 'value-card', reason: `day${dayOfWeek}-value` }
}

// ── Caption builder ──────────────────────────────────────────────────

interface Pick {
  id?: number; home_team?: string; away_team?: string; league?: string
  date?: string; recommended_bet?: string; recommended_odds_range?: string
  best_value?: { ev?: number; odds?: number; label?: string }
  value_score?: number
}

function parseOdds(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/[\d.]+/)
  if (!m) return null
  const n = parseFloat(m[0])
  return Number.isFinite(n) && n > 1 ? n : null
}

async function fetchPredictions(): Promise<Pick[]> {
  try {
    const r = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
    const j = await r.json()
    return Array.isArray(j?.predictions) ? j.predictions : []
  } catch { return [] }
}

function isIntl(league?: string): boolean {
  const l = (league ?? '').toLowerCase()
  if (l.includes('club world cup')) return false
  return l.includes('world cup') || l.includes('friendlies (intl)') ||
         l.includes('nations league') || /\bqualif/.test(l) ||
         /afcon|africa cup/.test(l) || /\beuro\b/.test(l) ||
         l.includes('copa america') || l.includes('gold cup') ||
         l.includes('asian cup') || l.includes('concacaf nations')
}

async function buildCaption(card: CardKey, fixtureId?: number): Promise<string> {
  if (card === 'recap') {
    return `Yesterday's settled value bets — every win and every loss, no edits.\n\nFull track record → matchmindcom.com/track-record\n\n#valuebets #footballbetting #footballtips #matchmind #ai #aibetting`
  }
  if (card === 'biggest-wins') {
    return `Last 30 days of AI value bets. Biggest odds cashed + best edge that hit.\n\nEvery pick logged before kick-off. Wins AND losses public.\n\nmatchmindcom.com/track-record\n\n#valuebets #footballbetting #footballtips #matchmind #aibetting`
  }
  if (card === 'team-stats') {
    return `The teams the AI gets right most often. Last 30 days, min 3 picks per team.\n\nFull stats → matchmindcom.com/track-record\n\n#footballstats #valuebets #matchmind`
  }
  if (card === 'coach-positioning') {
    return `You're the coach of your own betting fund. We give you the tools to run it.\n\n→ matchmindcom.com\n\n#valuebets #footballbetting #matchmind`
  }
  if (card === 'fixture-deepdive') {
    return `Match preview — form, venue, kick-off, AI value pick.\n\nFull deep-dive → matchmindcom.com/world-cup\n\n#worldcup2026 #footballtips #valuebets #matchmind`
  }
  if (card === 'ev-explainer' || card === 'tour' || card === 'value-bet-math') {
    return card === 'ev-explainer'
      ? `Value bets in 4 slides. Save and share.\n\nLive picks → matchmindcom.com\n\n#valuebets #footballbetting #matchmind #educational`
      : card === 'tour'
        ? `4 tools that turn you into the coach of your own betting fund.\n\nTry free → matchmindcom.com\n\n#footballbetting #matchmind #valuebets`
        : `Value-bet maths in 30 seconds. Save it.\n\nLive picks → matchmindcom.com\n\n#valuebets #educational #footballbetting #matchmind`
  }

  // Default: value-card — build pick-specific caption
  const preds = await fetchPredictions()
  const internationals = preds.filter(p => p.id && isIntl(p.league))
  const pool = internationals.length > 0 ? internationals : preds
  const top = pool
    .filter(p => (p.best_value?.ev ?? 0) > 0 && (p.best_value?.odds ?? 0) > 1)
    .sort((a, b) => (b.best_value?.ev ?? 0) - (a.best_value?.ev ?? 0))[0]

  if (!top) {
    return `Today's #1 AI value bet. Every pick logged before kick-off.\n\nLive picks → matchmindcom.com\n\n#footballbetting #valuebets #matchmind`
  }
  const odds = top.best_value?.odds ?? parseOdds(top.recommended_odds_range) ?? 0
  const ev = top.best_value?.ev ?? top.value_score ?? 0
  const label = top.best_value?.label ?? top.recommended_bet ?? 'AI pick'

  return (
    `🎯 Today's #1 AI value bet\n\n` +
    `${top.home_team} v ${top.away_team}\n` +
    `${label} @ ${odds.toFixed(2)}\n` +
    `AI edge: +${Number(ev).toFixed(1)}%\n\n` +
    `Logged 24h before kick-off. Every result public.\n\n` +
    `Live picks → matchmindcom.com\n\n` +
    `#footballbetting #valuebets #aibetting #footballtips #matchmind ${isIntl(top.league) ? '#internationalfootball' : ''}`
  )
}

// ── Graph API helpers ────────────────────────────────────────────────

async function createMediaContainer(igUserId: string, token: string, imageUrl: string, caption: string) {
  const params = new URLSearchParams({ image_url: imageUrl, caption, access_token: token })
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media?${params.toString()}`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: `media create HTTP ${res.status}: ${JSON.stringify(data)}` }
  if (!data?.id) return { ok: false, error: `media create returned no id: ${JSON.stringify(data)}` }
  return { ok: true, creationId: data.id as string }
}

async function createCarouselChild(igUserId: string, token: string, imageUrl: string) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    is_carousel_item: 'true',
    access_token: token,
  })
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media?${params.toString()}`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: `child create HTTP ${res.status}: ${JSON.stringify(data)}` }
  return { ok: true, id: data.id as string }
}

async function createCarouselContainer(igUserId: string, token: string, childIds: string[], caption: string) {
  const params = new URLSearchParams({
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token: token,
  })
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media?${params.toString()}`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: `carousel create HTTP ${res.status}: ${JSON.stringify(data)}` }
  return { ok: true, creationId: data.id as string }
}

async function publish(igUserId: string, token: string, creationId: string) {
  const params = new URLSearchParams({ creation_id: creationId, access_token: token })
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish?${params.toString()}`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: `publish HTTP ${res.status}: ${JSON.stringify(data)}` }
  return { ok: true, mediaId: data.id as string }
}

// ── Route handler ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // KILL SWITCH — disables ALL Instagram posting until manually reverted.
  // Per user request 2026-06-07: pause IG automation until further notice.
  // To re-enable: set IG_AUTOPOST_PAUSED to false (or remove this block)
  // and restore the 3 cron entries in vercel.json.
  // Belt-and-braces: vercel.json also has the IG cron entries removed.
  // (Explicit :boolean keeps TS happy about reachability of code below.)
  const IG_AUTOPOST_PAUSED: boolean = true
  if (IG_AUTOPOST_PAUSED) {
    return NextResponse.json({
      skipped: true,
      reason: 'IG_AUTOPOST_PAUSED — Instagram automation paused by user request 2026-06-07. Flip IG_AUTOPOST_PAUSED to false + restore vercel.json crons to re-enable.',
    })
  }

  let body: { card?: CardKey; imageUrl?: string; caption?: string; carousel?: string[]; dryRun?: boolean } = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {}

  // Also accept overrides from query string so Vercel cron (GET, no body)
  // can target a specific card via /api/admin/post-instagram?card=ev-explainer.
  try {
    const url = new URL(req.url)
    const qsCard = url.searchParams.get('card')
    const qsDry = url.searchParams.get('dryRun')
    if (qsCard && !body.card) body.card = qsCard as CardKey
    if (qsDry === '1' && body.dryRun === undefined) body.dryRun = true
  } catch {}

  const dryRun = body.dryRun === true

  // Resolve card + image
  const resolution = await resolveCard(body.card)
  const card = resolution.card
  const fixtureId = resolution.fixtureId

  // Build the image URL
  let imageUrl: string
  if (body.imageUrl) {
    imageUrl = body.imageUrl
  } else if (card === 'fixture-deepdive' && fixtureId) {
    imageUrl = `${APP_URL}/api/og/ig-fixture-deepdive?id=${fixtureId}&_=${Date.now()}`
  } else {
    imageUrl = `${APP_URL}/api/og/ig-${card}?_=${Date.now()}`
  }

  // Build caption
  const caption = body.caption ?? await buildCaption(card, fixtureId)

  // Auto-build carousel slides when the card is a known multi-slide explainer.
  // Body override (body.carousel) wins if provided.
  let carouselUrls: string[] = Array.isArray(body.carousel) ? body.carousel.slice(0, 10) : []
  if (carouselUrls.length === 0 && (card === 'ev-explainer' || card === 'tour')) {
    const bust = Date.now()
    carouselUrls = [1, 2, 3, 4].map(n => `${APP_URL}/api/og/ig-${card}?slide=${n}&_=${bust}`)
  }
  const isCarousel = carouselUrls.length >= 2

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      card,
      resolution_reason: resolution.reason,
      fixture_id: fixtureId ?? null,
      image_url: imageUrl,
      carousel: isCarousel ? carouselUrls : null,
      caption,
      caption_length: caption.length,
    })
  }

  // Token + IG user
  const tokenInfo = await getInstagramToken()
  const token = tokenInfo.token
  const igUserId = process.env.INSTAGRAM_USER_ID
  if (!token || !igUserId) {
    return NextResponse.json({ error: 'Instagram not configured. INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID missing.' }, { status: 500 })
  }

  // Carousel path
  if (isCarousel) {
    const childResults = await Promise.all(carouselUrls.map(u => createCarouselChild(igUserId, token, u)))
    const failed = childResults.findIndex(r => !r.ok)
    if (failed !== -1) {
      return NextResponse.json({ error: childResults[failed].error, step: 'carousel_child', failed_index: failed }, { status: 502 })
    }
    const childIds = childResults.map(r => (r as { ok: true; id: string }).id)
    // Brief pause so Meta can fetch all images
    await new Promise(r => setTimeout(r, 3000))
    const container = await createCarouselContainer(igUserId, token, childIds, caption)
    if (!container.ok) return NextResponse.json({ error: container.error, step: 'carousel_container' }, { status: 502 })
    await new Promise(r => setTimeout(r, 2000))
    const result = await publish(igUserId, token, container.creationId!)
    if (!result.ok) return NextResponse.json({ error: result.error, step: 'publish_carousel' }, { status: 502 })
    return NextResponse.json({
      success: true, type: 'carousel', media_id: result.mediaId,
      caption, slide_count: childIds.length,
      resolution_reason: resolution.reason,
    })
  }

  // Single image path
  const container = await createMediaContainer(igUserId, token, imageUrl, caption)
  if (!container.ok) return NextResponse.json({ error: container.error, step: 'create_media' }, { status: 502 })
  await new Promise(r => setTimeout(r, 2000))
  const result = await publish(igUserId, token, container.creationId!)
  if (!result.ok) return NextResponse.json({ error: result.error, step: 'publish' }, { status: 502 })

  return NextResponse.json({
    success: true,
    type: 'single',
    media_id: result.mediaId,
    permalink: `https://www.instagram.com/p/${result.mediaId}/`,
    card,
    resolution_reason: resolution.reason,
    image_url: imageUrl,
    caption,
  })
}

// Vercel cron fires GET — reuse POST.
export const GET = POST
