/**
 * POST /api/admin/post-kickoff-alerts
 *
 * Scans today's AI value picks and tweets a "🔴 URGENT — KICKED OFF"
 * alert for each fixture that just hit minute 1 (status `1H`, elapsed
 * <= 3). Designed to be hit every 3-5 min by an external scheduler
 * (cron-job.org / GitHub Actions / a Vercel cron when on Pro plan).
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *
 * Body (all optional):
 *   {
 *     "minutesWindow": 3,   // max elapsed minute to alert on (default 3)
 *     "dryRun":        false
 *   }
 *
 * Dedupe: writes the fixture id to a small `kickoff_tweets` Supabase
 * table after a successful tweet so subsequent invocations skip it.
 * If the table doesn't exist yet, the row write fails silently and
 * dedupe falls back to a module-level Set (good for the duration of
 * a single warm Vercel instance).
 */
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient as createAdmin } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

// Module-level fallback dedupe — survives between requests on a warm instance.
const inFlightSeen = new Set<number>()

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Pick {
  id?: number
  home_team?: string
  away_team?: string
  league?: string
  leagueFlag?: string
  date?: string
  recommended_bet?: string
  recommended_odds_range?: string
  best_value?: { ev?: number; odds?: number; label?: string; market?: string }
  value_score?: number
  confidence?: number
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
  if (p.recommended_bet && o) {
    return { label: p.recommended_bet, odds: o, ev: p.value_score ?? 0 }
  }
  return null
}

async function apiFetch(path: string): Promise<any[] | null> {
  if (!API_KEY) return null
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.response ?? null
  } catch {
    return null
  }
}

// ── Dedupe: Supabase write + module-level fallback ───────────────────

async function alreadyTweeted(fixtureId: number): Promise<boolean> {
  if (inFlightSeen.has(fixtureId)) return true
  try {
    const { data, error } = await supabaseAdmin
      .from('kickoff_tweets')
      .select('fixture_id')
      .eq('fixture_id', fixtureId)
      .maybeSingle()
    if (!error && data?.fixture_id != null) return true
  } catch {
    // Table missing or other DB error — fall back to module set only.
  }
  return false
}

async function markTweeted(fixtureId: number, tweetId?: string) {
  inFlightSeen.add(fixtureId)
  try {
    await supabaseAdmin
      .from('kickoff_tweets')
      .insert({ fixture_id: fixtureId, tweet_id: tweetId ?? null })
  } catch {
    // ignore — module set handles it for this warm instance
  }
}

// Shared Twitter poster — single source of truth in lib/twitter-poster.ts.
// Local duplicates were silently swallowing non-2xx Twitter responses
// (duplicate-content rejections etc.). The shared version console.errors
// failures so they surface in Vercel function logs.
import { postTweet } from '@/lib/twitter-poster'

function buildAlertTweet(pick: Pick, leg: { label: string; odds: number; ev: number }, minute: number, score: { home: number; away: number }): string {
  const flag = pick.leagueFlag ?? ''
  const ev = leg.ev > 0 ? `+${leg.ev}% EV` : `${leg.ev}% EV`
  const minuteText = minute <= 1 ? 'MIN 1' : `MIN ${minute}`
  return `🔴 URGENT — KICKED OFF · ${minuteText}

${flag} ${pick.home_team} v ${pick.away_team}
${pick.league ?? ''}

🎯 AI Pick: ${leg.label}
💰 Odds: ${leg.odds.toFixed(2)} · ${ev}
📊 Score: ${score.home}-${score.away}

Live now → matchmindcom.com`
}

// ── Route handler ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { minutesWindow?: number; dryRun?: boolean } = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    // empty body — defaults
  }
  const minutesWindow = Math.max(1, Math.min(15, Number(body.minutesWindow) || 3))
  const dryRun = body.dryRun === true

  // Pull predictions
  const predsRes = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
  const predsJson = await predsRes.json().catch(() => ({}))
  const all: Pick[] = Array.isArray(predsJson?.predictions) ? predsJson.predictions : []
  if (all.length === 0) {
    return NextResponse.json({ message: 'No predictions cached', alerts_sent: 0 })
  }

  // Pull live fixtures (single API-Football call)
  const live = (await apiFetch('/fixtures?live=all')) ?? []
  if (live.length === 0) {
    return NextResponse.json({ message: 'No live fixtures right now', alerts_sent: 0 })
  }
  // Index live fixtures by id for O(1) lookup
  const liveById = new Map<number, any>()
  for (const fx of live) {
    if (fx?.fixture?.id) liveById.set(fx.fixture.id, fx)
  }

  const results: Array<{ fixtureId: number; match: string; tweet?: any; skipped?: string; tweet_text?: string }> = []

  for (const pick of all) {
    if (!pick.id) continue
    const fx = liveById.get(pick.id)
    if (!fx) continue
    const status = fx?.fixture?.status?.short
    const elapsed = Number(fx?.fixture?.status?.elapsed ?? 0)
    if (status !== '1H' || elapsed < 1 || elapsed > minutesWindow) continue

    const leg = bestLeg(pick)
    if (!leg) {
      results.push({ fixtureId: pick.id, match: `${pick.home_team} v ${pick.away_team}`, skipped: 'no usable pick' })
      continue
    }

    if (await alreadyTweeted(pick.id)) {
      results.push({ fixtureId: pick.id, match: `${pick.home_team} v ${pick.away_team}`, skipped: 'already tweeted' })
      continue
    }

    const score = {
      home: Number(fx?.goals?.home ?? 0) || 0,
      away: Number(fx?.goals?.away ?? 0) || 0,
    }
    const tweetText = buildAlertTweet(pick, leg, elapsed, score)

    if (dryRun) {
      results.push({ fixtureId: pick.id, match: `${pick.home_team} v ${pick.away_team}`, tweet_text: tweetText, skipped: 'dryRun' })
      continue
    }

    const r = await postTweet(tweetText)
    if (r.ok) {
      await markTweeted(pick.id, r.id)
      results.push({ fixtureId: pick.id, match: `${pick.home_team} v ${pick.away_team}`, tweet: r, tweet_text: tweetText })
    } else {
      results.push({ fixtureId: pick.id, match: `${pick.home_team} v ${pick.away_team}`, tweet: r, skipped: 'tweet failed' })
    }
  }

  const sent = results.filter((r) => r.tweet?.ok).length
  return NextResponse.json({
    success: true,
    alerts_sent: sent,
    candidates_scanned: all.length,
    live_fixtures_seen: live.length,
    results,
  })
}

// Vercel cron fires GET — reuse the POST handler.
export const GET = POST
