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

// ── Twitter OAuth 1.0a poster ────────────────────────────────────────

async function postTweet(text: string): Promise<{ ok: boolean; id?: string; url?: string; error?: string }> {
  const apiKey = process.env.TWITTER_API_KEY
  const apiSecret = process.env.TWITTER_API_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessSecret = process.env.TWITTER_ACCESS_SECRET
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return { ok: false, error: 'Twitter credentials not configured' }
  }
  const url = 'https://api.twitter.com/2/tweets'
  const nonce = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  }
  const sortedParams = Object.keys(oauthParams).sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&')
  const sigBase = `POST&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`
  const sigKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`
  const signature = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64')
  oauthParams.oauth_signature = signature
  const auth = 'OAuth ' + Object.keys(oauthParams)
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data)}` }
    const id = data.data?.id
    return { ok: true, id, url: id ? `https://x.com/Match_Mind_AI/status/${id}` : undefined }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'fetch failed' }
  }
}

// ── Route handler ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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

  // Filter to tonight + sort by EV (descending)
  const tonight = all.filter((p) => isTonightISO(p.date, windowHours))
  if (tonight.length === 0) {
    return NextResponse.json({
      error: `No predictions kicking off in the next ${windowHours}h. Try { windowHours: 36 }.`,
      hint: 'Predictions cache may not yet contain tonight\'s fixtures. Bumping windowHours captures next-day games.',
    }, { status: 404 })
  }
  const ranked = tonight
    .map((p) => ({ pick: p, sum: legSummary(p) }))
    .filter((x): x is { pick: Pick; sum: NonNullable<ReturnType<typeof legSummary>> } => x.sum !== null)
    .sort((a, b) => (b.sum.ev ?? 0) - (a.sum.ev ?? 0))

  if (ranked.length < 2) {
    return NextResponse.json({ error: `Only ${ranked.length} usable picks for tonight, need ≥2` }, { status: 404 })
  }

  // De-duplicate by fixture id so we don't end up with two legs on the
  // same match (different markets) which a real bookie would reject.
  const seen = new Set<number>()
  const unique: typeof ranked = []
  for (const r of ranked) {
    const id = r.pick.id ?? -1
    if (id !== -1 && seen.has(id)) continue
    if (id !== -1) seen.add(id)
    unique.push(r)
    if (unique.length >= legCount) break
  }
  if (unique.length < 2) {
    return NextResponse.json({ error: `After dedupe only ${unique.length} unique fixtures available` }, { status: 404 })
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
