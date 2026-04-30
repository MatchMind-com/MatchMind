/**
 * POST /api/admin/post-tiktok
 *
 * Posts a tonight's-acca clip to TikTok via the Content Posting API.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *
 * Body (all optional):
 *   {
 *     "videoUrl":  "https://.../my-acca-clip.mp4",  // REQUIRED — must be
 *                                                    // public + MP4 + ≤500MB
 *     "title":     "..."   // override the auto-generated title (max 150 chars)
 *     "dryRun":    false
 *   }
 *
 * Required env vars (set in Vercel):
 *   TIKTOK_ACCESS_TOKEN     access token from your TikTok app's OAuth flow
 *
 * To obtain that:
 *   1. Apply for TikTok for Developers at https://developers.tiktok.com
 *   2. Create an app, request `video.publish` scope (review can take days)
 *   3. Run the OAuth redirect flow once for your @MatchMindAI account →
 *      receive an access token (refresh tokens are valid 365 days)
 *   4. Store the access token in Vercel env as TIKTOK_ACCESS_TOKEN
 *
 * IMPORTANT: TikTok doesn't allow text-only posts via API — every post
 * needs a video. Recommended approach for our acca posts:
 *   - Pre-record / generate a 15-30s vertical (1080x1920) video showing
 *     each leg of the acca as a card sequence. Host it on Supabase Storage
 *     or Cloudinary, pass the public URL as `videoUrl`.
 *   - For automation: use a tool like Remotion / FFmpeg to render the
 *     video from the same data the OG card uses, upload, then call this
 *     endpoint. Out of scope for this iteration.
 *
 * If TIKTOK_ACCESS_TOKEN is not set OR videoUrl is missing, the endpoint
 * returns a clear 400/500 with setup guidance instead of failing silently.
 */

import { NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'
const TIKTOK_BASE = 'https://open.tiktokapis.com'

interface Pick {
  id?: number
  home_team?: string
  away_team?: string
  recommended_bet?: string
  recommended_odds_range?: string
  best_value?: { ev?: number; odds?: number; label?: string }
  date?: string
  value_score?: number
}

function parseOdds(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/[\d.]+/)
  if (!m) return null
  const n = parseFloat(m[0])
  return Number.isFinite(n) && n > 1 ? n : null
}

function bestLeg(p: Pick): { label: string; odds: number; ev: number } | null {
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

async function buildAutoTitle(legCount: number, windowHours: number): Promise<string> {
  try {
    const r = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
    const j = await r.json()
    const all: Pick[] = Array.isArray(j?.predictions) ? j.predictions : []
    const ranked = all
      .filter((p) => isInWindow(p.date, windowHours))
      .map((p) => ({ pick: p, sum: bestLeg(p) }))
      .filter((x): x is { pick: Pick; sum: NonNullable<ReturnType<typeof bestLeg>> } => x.sum !== null)
      .sort((a, b) => (b.sum.ev ?? 0) - (a.sum.ev ?? 0))
      .slice(0, legCount)
    if (ranked.length < 2) return `Tonight's AI value picks 🔥 #footballbetting #ai #valuebets #matchmind`
    const combined = ranked.reduce((acc, l) => acc * l.sum.odds, 1)
    return `🔥 ${ranked.length}-fold AI value acca @ ${combined.toFixed(2)} | matchmindcom.com #footballbetting #ai #acca #valuebets #matchmind`
  } catch {
    return `Tonight's AI value picks 🔥 #footballbetting #ai #valuebets #matchmind`
  }
}

// ── TikTok Content Posting API: PULL_FROM_URL flow ──────────────────
// Docs: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post

async function postTikTokVideo(token: string, videoUrl: string, title: string) {
  const url = `${TIKTOK_BASE}/v2/post/publish/video/init/`
  const body = {
    post_info: {
      title: title.slice(0, 150),
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      brand_content_toggle: false,
      brand_organic_toggle: false,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: videoUrl,
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) return { ok: false, error: `init HTTP ${res.status}: ${JSON.stringify(data)}` }
  if (data?.error?.code && data.error.code !== 'ok') {
    return { ok: false, error: `init error: ${JSON.stringify(data.error)}` }
  }
  // TikTok returns publish_id (status async). We don't poll — TikTok
  // processes asynchronously, the post will appear within a few minutes.
  return { ok: true, publishId: data?.data?.publish_id }
}

// ── Route handler ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { videoUrl?: string; title?: string; legs?: number; windowHours?: number; dryRun?: boolean } = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    // empty body — defaults below, but videoUrl is required for non-dryRun
  }
  const legCount = Math.max(2, Math.min(8, Number(body.legs) || 4))
  const windowHours = Math.max(3, Math.min(72, Number(body.windowHours) || 18))
  const dryRun = body.dryRun === true

  const title = body.title || (await buildAutoTitle(legCount, windowHours))

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      title,
      title_length: title.length,
      video_url: body.videoUrl ?? '(none — required for real post)',
      hint: body.videoUrl
        ? null
        : 'Generate a vertical 1080x1920 MP4 of the acca picks (Remotion / FFmpeg) and pass its public URL as videoUrl.',
    })
  }

  if (!body.videoUrl) {
    return NextResponse.json(
      {
        error:
          'videoUrl is required. TikTok\'s Content Posting API only accepts video uploads (no text-only posts). Generate a vertical 1080x1920 MP4 of the acca picks and pass its public URL.',
      },
      { status: 400 },
    )
  }

  const token = process.env.TIKTOK_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json(
      {
        error:
          'TikTok not configured. Set TIKTOK_ACCESS_TOKEN in Vercel after running the @MatchMind_AI OAuth flow on a TikTok for Developers app with video.publish scope. See route file for setup steps.',
      },
      { status: 500 },
    )
  }

  const result = await postTikTokVideo(token, body.videoUrl, title)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }
  return NextResponse.json({
    success: true,
    publish_id: result.publishId,
    title,
    note: 'TikTok processes uploads asynchronously. The post should appear on @MatchMind_AI within a few minutes.',
  })
}
