/**
 * POST /api/admin/post-tonight-acca
 *
 * One-shot tweet poster — composes a 4-leg accumulator from tonight's
 * AI value picks and posts it to @Match_Mind_AI.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *
 * Body (all optional):
 *   {
 *     "legs":         4,    // how many picks to combine (default 4)
 *     "windowHours":  18,   // how far ahead to look for kickoffs (default 18,
 *                           // covers "tonight" through tomorrow morning)
 *     "dryRun":       false // if true, returns the tweet text WITHOUT posting
 *   }
 *
 * Source of picks: /api/predictions, filtered to fixtures kicking off
 * within the next 12 hours and sorted by EV. The top N are combined and
 * a tweet is posted via the same Twitter OAuth path used by the existing
 * /api/admin/post-tweets endpoint.
 */
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

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
  bookmaker?: { home?: number; draw?: number; away?: number; over25?: number; btts?: number }
  ev?: { home?: number; draw?: number; away?: number; over25?: number; btts?: number }
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

/** Best label + odds + ev for a pick — uses best_value first, then falls back. */
function legSummary(p: Pick): { label: string; odds: number; ev: number } | null {
  if (p.best_value?.label && p.best_value.odds && p.best_value.odds > 1) {
    return {
      label: p.best_value.label,
      odds: p.best_value.odds,
      ev: p.best_value.ev ?? 0,
    }
  }
  const o = parseOdds(p.recommended_odds_range)
  if (p.recommended_bet && o) {
    return { label: p.recommended_bet, odds: o, ev: p.value_score ?? 0 }
  }
  return null
}

function isTonightISO(iso: string | undefined, windowHours: number): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  const now = Date.now()
  // Within the configured window (default 18h, covers "tonight" + next-day
  // morning) or within the past 3 hours (mid-game still counts).
  return t > now - 3 * 3_600_000 && t < now + windowHours * 3_600_000
}

function fmtKickoff(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  }) + ' BST'
}

function buildAccaTweet(legs: Array<{ pick: Pick; sum: { label: string; odds: number; ev: number } }>): string {
  const combinedOdds = legs.reduce((acc, l) => acc * l.sum.odds, 1)
  const stake = 10
  const payout = Math.round(combinedOdds * stake * 100) / 100

  // Try the rich version first (with flags + kickoffs).
  const headerRich = `🔥 TONIGHT'S ${legs.length}-FOLD — AI VALUE ACCA\n`
  const richLines = legs.map((l, i) => {
    const flag = l.pick.leagueFlag ?? ''
    const ko = fmtKickoff(l.pick.date)
    return `${i + 1}. ${flag} ${l.pick.home_team} v ${l.pick.away_team} (${ko})\n   ${l.sum.label} @ ${l.sum.odds.toFixed(2)}`
  })
  const footerRich = `\n💰 Combined @ ${combinedOdds.toFixed(2)}\n£${stake} → £${payout.toFixed(2)}\n\nNo advice — just data.\nmatchmindcom.com`

  // Slim version — drop flags + kickoffs + tagline.
  const headerSlim = `🔥 ${legs.length}-FOLD AI VALUE ACCA\n`
  const slimLines = legs.map((l, i) =>
    `${i + 1}. ${l.pick.home_team} v ${l.pick.away_team} — ${l.sum.label} @ ${l.sum.odds.toFixed(2)}`
  )
  const footerSlim = `\n💰 ${combinedOdds.toFixed(2)} · £${stake} → £${payout.toFixed(2)}\nmatchmindcom.com`

  // Ultra-slim — abbreviate team names.
  function abbr(name?: string): string {
    if (!name) return ''
    if (name.length <= 12) return name
    // Drop common suffixes / take first two words
    const tokens = name.split(/\s+/)
    if (tokens.length >= 2) return tokens.slice(0, 2).join(' ').slice(0, 14)
    return name.slice(0, 14)
  }
  const headerUltra = `🔥 ${legs.length}-FOLD ACCA\n`
  const ultraLines = legs.map((l, i) =>
    `${i + 1}. ${abbr(l.pick.home_team)} v ${abbr(l.pick.away_team)} — ${l.sum.label} @ ${l.sum.odds.toFixed(2)}`
  )
  const footerUltra = `\n${combinedOdds.toFixed(2)} · £${stake}→£${payout.toFixed(2)}\nmatchmindcom.com`

  // Pick the densest format that fits 280 chars.
  const candidates = [
    [headerRich, ...richLines, footerRich].join('\n'),
    [headerSlim, ...slimLines, footerSlim].join('\n'),
    [headerUltra, ...ultraLines, footerUltra].join('\n'),
  ]
  for (const t of candidates) if (t.length <= 280) return t
  // If even ultra is too long, return ultra (Twitter will reject; user
  // can drop a leg and retry).
  return candidates[candidates.length - 1]
}

// Shared Twitter poster — single source of truth in lib/twitter-poster.ts.
// Was duplicated here + post-kickoff-alerts; the dupes silently swallowed
// non-2xx Twitter responses (e.g. duplicate-content rejection) returning
// 200 to Vercel logs. The shared version now console.errors the actual
// Twitter status so failures surface in function logs.
import { postTweet } from '@/lib/twitter-poster'

// ── Route handler ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { legs?: number; windowHours?: number; dryRun?: boolean } = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    // Empty body is fine — defaults below.
  }
  const legCount = Math.max(2, Math.min(8, Number(body.legs) || 4))
  const windowHours = Math.max(3, Math.min(72, Number(body.windowHours) || 18))
  const dryRun = body.dryRun === true

  // Pull predictions
  let predsJson: any
  try {
    const res = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
    predsJson = await res.json()
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch predictions: ' + e?.message }, { status: 502 })
  }
  const all: Pick[] = Array.isArray(predsJson?.predictions) ? predsJson.predictions : []
  if (all.length === 0) {
    return NextResponse.json({ error: 'No predictions returned by /api/predictions' }, { status: 503 })
  }

  // Build the usable-picks set for a given window. Returns the EV-ranked,
  // deduped picks ready to slice into an acca.
  function buildUniquePicks(hours: number) {
    const inWindow = all.filter((p) => isTonightISO(p.date, hours))
    const ranked = inWindow
      .map((p) => ({ pick: p, sum: legSummary(p) }))
      .filter((x): x is { pick: Pick; sum: NonNullable<ReturnType<typeof legSummary>> } => x.sum !== null)
      .sort((a, b) => (b.sum.ev ?? 0) - (a.sum.ev ?? 0))
    const seen = new Set<number>()
    const out: typeof ranked = []
    for (const r of ranked) {
      const id = r.pick.id ?? -1
      if (id !== -1 && seen.has(id)) continue
      if (id !== -1) seen.add(id)
      out.push(r)
      if (out.length >= legCount) break
    }
    return out
  }

  // Auto-expand the window if the requested hours yield too few picks.
  // Mid-week slates can be thin (e.g. Tuesday with no PL fixtures); the
  // cron used to silently 404 instead of just looking further ahead.
  // Try the user-provided window first, then 36h, then 72h before giving
  // up. The widest a body-passed value can ever expand to is 72h (matches
  // the existing input clamp).
  const windowAttempts = [windowHours, 36, 72]
    .filter((h) => h >= windowHours)
    .reduce<number[]>((acc, h) => (acc.includes(h) ? acc : [...acc, h]), [])
    .sort((a, b) => a - b)
  let unique: ReturnType<typeof buildUniquePicks> = []
  let windowUsed = windowAttempts[0]
  for (const h of windowAttempts) {
    const candidate = buildUniquePicks(h)
    if (candidate.length >= 2) {
      unique = candidate
      windowUsed = h
      break
    }
  }
  if (unique.length < 2) {
    return NextResponse.json({
      error: `Only ${unique.length} usable picks even with 72h window — true thin slate.`,
      hint: 'Predictions cache may be stale. Trigger /api/cron/refresh-predictions-tier1 first.',
      window_attempts: windowAttempts,
    }, { status: 404 })
  }

  const tweetText = buildAccaTweet(unique)

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      tweet_text: tweetText,
      tweet_length: tweetText.length,
      legs_used: unique.map((u) => ({
        match: `${u.pick.home_team} v ${u.pick.away_team}`,
        league: u.pick.league,
        kickoff: u.pick.date,
        pick: u.sum.label,
        odds: u.sum.odds,
        ev: u.sum.ev,
      })),
    })
  }

  const result = await postTweet(tweetText)
  return NextResponse.json({
    success: result.ok,
    tweet: result,
    tweet_text: tweetText,
    tweet_length: tweetText.length,
    legs_used: unique.length,
  }, { status: result.ok ? 200 : 502 })
}

// Vercel cron fires GET — reuse the POST handler.
export const GET = POST
