/**
 * GET /api/admin/delete-ig-today?dryRun=1
 * POST /api/admin/delete-ig-today
 *
 * Lists every Instagram post made TODAY (UTC) and optionally deletes them.
 * Built 2026-06-07 to clean up any auto-posts that fired before the IG
 * automation kill-switch took effect.
 *
 * Auth:
 *   - Authorization: Bearer ${CRON_SECRET}   (curl from terminal)
 *   - OR a logged-in admin session            (visit from browser)
 *
 * Defaults to DRY-RUN (lists posts without deleting). Pass POST without
 * dryRun=1 to actually delete. Always reports what it found, what it
 * deleted, and any errors per-post.
 *
 * Why GET = dry-run + POST = delete:
 *   Browsing the GET URL from your phone won't accidentally nuke posts.
 *   You have to explicitly POST to delete.
 */

import { NextResponse } from 'next/server'
import { getInstagramToken } from '@/lib/instagram-token'
import { requireAdmin } from '@/lib/admin/server'

const GRAPH_BASE = 'https://graph.instagram.com/v23.0'

interface IGMedia {
  id: string
  timestamp: string
  media_type?: string
  permalink?: string
  caption?: string
}

/**
 * Fetch the most recent 25 posts on the account.
 * IG Graph API paginates but 25 is enough for "anything posted today".
 */
async function listRecentMedia(igUserId: string, token: string): Promise<{
  ok: boolean; items?: IGMedia[]; error?: string
}> {
  const url = `${GRAPH_BASE}/${igUserId}/media?fields=id,timestamp,media_type,permalink,caption&limit=25&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: `list HTTP ${res.status}: ${JSON.stringify(data)}` }
  return { ok: true, items: Array.isArray(data?.data) ? data.data : [] }
}

async function deleteMedia(mediaId: string, token: string): Promise<{ ok: boolean; error?: string }> {
  const url = `${GRAPH_BASE}/${mediaId}?access_token=${encodeURIComponent(token)}`
  const res = await fetch(url, { method: 'DELETE' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: `delete HTTP ${res.status}: ${JSON.stringify(data)}` }
  return { ok: true }
}

/** YYYY-MM-DD for the given Date, in UTC. */
function ymdUTC(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function handle(req: Request, isDryRun: boolean) {
  // Auth: either CRON_SECRET bearer OR admin session
  const auth = req.headers.get('authorization')
  const hasBearer = auth === `Bearer ${process.env.CRON_SECRET}`
  if (!hasBearer) {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: 'Unauthorized (need bearer or admin session)' }, { status: 401 })
    }
  }

  const tokenInfo = await getInstagramToken()
  const token = tokenInfo.token
  const igUserId = process.env.INSTAGRAM_USER_ID
  if (!token || !igUserId) {
    return NextResponse.json({ error: 'Instagram not configured' }, { status: 500 })
  }

  const list = await listRecentMedia(igUserId, token)
  if (!list.ok) return NextResponse.json({ error: list.error, step: 'list' }, { status: 502 })

  const today = ymdUTC(new Date())
  const todayPosts = (list.items ?? []).filter(p => p.timestamp && p.timestamp.slice(0, 10) === today)

  if (isDryRun) {
    return NextResponse.json({
      dry_run: true,
      today_utc: today,
      posts_found_today: todayPosts.length,
      total_recent_posts_checked: list.items?.length ?? 0,
      posts: todayPosts.map(p => ({
        id: p.id,
        timestamp: p.timestamp,
        permalink: p.permalink,
        caption_preview: p.caption?.slice(0, 80),
      })),
      hint: 'POST the same URL (without dryRun=1) to actually delete these.',
    })
  }

  // Delete each
  const results: Array<{ id: string; ok: boolean; error?: string; permalink?: string }> = []
  for (const post of todayPosts) {
    const r = await deleteMedia(post.id, token)
    results.push({ id: post.id, ok: r.ok, error: r.error, permalink: post.permalink })
    // Tiny pause to avoid rate-limiting
    await new Promise(res => setTimeout(res, 500))
  }

  const deleted = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  return NextResponse.json({
    deleted_count: deleted,
    failed_count: failed,
    today_utc: today,
    results,
  })
}

export async function GET(req: Request) {
  return handle(req, true)  // GET = dry-run (list only)
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const isDryRun = searchParams.get('dryRun') === '1'
  return handle(req, isDryRun)
}
