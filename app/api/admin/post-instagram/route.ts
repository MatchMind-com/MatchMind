/**
 * POST /api/admin/post-instagram
 *
 * Posts a tonight's-acca card to Instagram (Business / Creator account).
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *
 * Body (all optional):
 *   {
 *     "legs":         4,
 *     "windowHours":  18,
 *     "imageUrl":     "https://www.matchmindcom.com/api/og/acca?legs=4",
 *                     // override the auto-generated card if you want
 *     "caption":      "..."   // override the auto-generated caption
 *     "dryRun":       false
 *   }
 *
 * Required env vars (set in Vercel):
 *   INSTAGRAM_ACCESS_TOKEN  long-lived token from Meta Graph API
 *                           (Settings → Instagram → Access Tokens)
 *   INSTAGRAM_USER_ID       numeric IG Business Account ID
 *
 * To obtain those:
 *   1. Convert IG account → Business or Creator
 *   2. Connect the IG account to a Facebook Page
 *   3. Create a Meta App at https://developers.facebook.com (type: Business)
 *   4. Add Instagram Graph API product to the app
 *   5. Use Graph API Explorer to generate a Page Access Token with the
 *      following scopes: instagram_basic, instagram_content_publish,
 *      pages_show_list, pages_read_engagement
 *   6. Exchange short-lived → long-lived token (60 days). Store in env.
 *   7. Get IG_USER_ID via:
 *      GET /me/accounts?access_token=...    → Page id
 *      GET /{page-id}?fields=instagram_business_account&access_token=...
 *
 * Posting is a 2-step Graph API flow:
 *   1. POST /v18.0/{ig-user-id}/media   — creates a media container
 *   2. POST /v18.0/{ig-user-id}/media_publish — publishes that container
 */

import { NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'
const GRAPH_BASE = 'https://graph.facebook.com/v18.0'

interface Pick {
  id?: number
  home_team?: string
  away_team?: string
  league?: string
  date?: string
  recommended_bet?: string
  recommended_odds_range?: string
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

function legSummary(p: Pick): { label: string; odds: number; ev: number } | null {
  if (p.best_value?.label && p.best_value.odds && p.best_value.odds > 1) {
    return { label: p.best_value.label, odds: p.best_value.odds, ev: p.best_value.ev ?? 0 }
  }
  const o = parseOdds(p.recommended_odds_range)
  if (p.recommended_bet && o) return { label: p.recommended_bet, odds: o, ev: p.value_score ?? 0 }
  return null
}

function isInWindow(iso: string | undefined, hours: number): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  const now = Date.now()
  return t > now - 3 * 3_600_000 && t < now + hours * 3_600_000
}

async function buildAutoCaption(legCount: number, windowHours: number): Promise<{ caption: string; legsUsed: number; combinedOdds: number } | null> {
  let predictions: Pick[] = []
  try {
    const r = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
    const j = await r.json()
    predictions = Array.isArray(j?.predictions) ? j.predictions : []
  } catch {
    return null
  }
  const ranked = predictions
    .filter((p) => isInWindow(p.date, windowHours))
    .map((p) => ({ pick: p, sum: legSummary(p) }))
    .filter((x): x is { pick: Pick; sum: NonNullable<ReturnType<typeof legSummary>> } => x.sum !== null)
    .sort((a, b) => (b.sum.ev ?? 0) - (a.sum.ev ?? 0))
  const seen = new Set<number>()
  const legs: typeof ranked = []
  for (const r of ranked) {
    const id = r.pick.id ?? -1
    if (id !== -1 && seen.has(id)) continue
    if (id !== -1) seen.add(id)
    legs.push(r)
    if (legs.length >= legCount) break
  }
  if (legs.length < 2) return null
  const combinedOdds = legs.reduce((acc, l) => acc * l.sum.odds, 1)
  const stake = 10
  const payout = Math.round(combinedOdds * stake * 100) / 100
  // IG captions can be up to 2200 chars — we have headroom for hashtags.
  const lines = legs.map((l, i) => `${i + 1}. ${l.pick.home_team} v ${l.pick.away_team} — ${l.sum.label} @ ${l.sum.odds.toFixed(2)}`)
  const caption =
    `🔥 Tonight's ${legs.length}-fold AI value acca\n\n` +
    lines.join('\n') +
    `\n\n💰 Combined @ ${combinedOdds.toFixed(2)}\n£${stake} → £${payout.toFixed(2)}\n\n` +
    `No advice — just data.\n` +
    `Live picks at matchmindcom.com\n\n` +
    `#footballbetting #footballtips #valuebets #matchmind #ai #aibetting #acca #footballacca`
  return { caption, legsUsed: legs.length, combinedOdds }
}

// ── Graph API helpers ────────────────────────────────────────────────

async function createIgMediaContainer(igUserId: string, token: string, imageUrl: string, caption: string) {
  const url = `${GRAPH_BASE}/${igUserId}/media`
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: token,
  })
  const res = await fetch(`${url}?${params.toString()}`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: `media create HTTP ${res.status}: ${JSON.stringify(data)}` }
  if (!data?.id) return { ok: false, error: `media create returned no id: ${JSON.stringify(data)}` }
  return { ok: true, creationId: data.id as string }
}

async function publishIgMedia(igUserId: string, token: string, creationId: string) {
  const url = `${GRAPH_BASE}/${igUserId}/media_publish`
  const params = new URLSearchParams({ creation_id: creationId, access_token: token })
  const res = await fetch(`${url}?${params.toString()}`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: `publish HTTP ${res.status}: ${JSON.stringify(data)}` }
  return { ok: true, mediaId: data.id as string }
}

// ── Route handler ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { legs?: number; windowHours?: number; imageUrl?: string; caption?: string; dryRun?: boolean } = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    // empty body — defaults
  }
  const legCount = Math.max(2, Math.min(8, Number(body.legs) || 4))
  const windowHours = Math.max(3, Math.min(72, Number(body.windowHours) || 18))
  const dryRun = body.dryRun === true

  // Auto-generate caption + image URL if not provided.
  const auto = await buildAutoCaption(legCount, windowHours)
  if (!auto && (!body.caption || !body.imageUrl)) {
    return NextResponse.json(
      { error: 'No upcoming AI picks for an acca and no caption/imageUrl provided.' },
      { status: 404 },
    )
  }
  const caption = body.caption || auto!.caption
  const imageUrl = body.imageUrl ||
    `${APP_URL}/api/og/acca?legs=${legCount}&windowHours=${windowHours}&_=${Date.now()}`

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      caption,
      caption_length: caption.length,
      image_url: imageUrl,
      legs_used: auto?.legsUsed ?? null,
      combined_odds: auto?.combinedOdds ?? null,
    })
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const igUserId = process.env.INSTAGRAM_USER_ID
  if (!token || !igUserId) {
    return NextResponse.json(
      {
        error:
          'Instagram not configured. Set INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID in Vercel. See route file for setup steps.',
      },
      { status: 500 },
    )
  }

  // 2-step Graph API publish
  const container = await createIgMediaContainer(igUserId, token, imageUrl, caption)
  if (!container.ok) {
    return NextResponse.json({ error: container.error, step: 'create_media' }, { status: 502 })
  }
  // Brief pause — Meta sometimes needs a moment to fetch the image.
  await new Promise((r) => setTimeout(r, 2000))
  const publish = await publishIgMedia(igUserId, token, container.creationId!)
  if (!publish.ok) {
    return NextResponse.json({ error: publish.error, step: 'publish', creation_id: container.creationId }, { status: 502 })
  }
  return NextResponse.json({
    success: true,
    media_id: publish.mediaId,
    permalink: `https://www.instagram.com/p/${publish.mediaId}/`,
    caption,
    image_url: imageUrl,
  })
}
