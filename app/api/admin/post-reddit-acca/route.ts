/**
 * POST /api/admin/post-reddit-acca
 *
 * Posts today's AI value acca as a markdown self-post to a configured
 * subreddit. Mirrors /api/admin/post-instagram and /api/admin/post-tonight-acca
 * — same auto-built acca pipeline, same auth, same dryRun pattern.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *
 * Body (all optional):
 *   {
 *     "legs":         4,
 *     "windowHours":  18,
 *     "subreddit":    "SoccerBetting",   // overrides REDDIT_SUBREDDIT env
 *     "title":        "...",             // overrides auto title
 *     "body":         "...",             // overrides auto markdown body
 *     "dryRun":       false              // returns content WITHOUT posting
 *   }
 *
 * Required env vars (set in Vercel):
 *   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
 *   REDDIT_SUBREDDIT (default subreddit if not in body)
 *   REDDIT_USER_AGENT (polite UA per Reddit's rules)
 *
 * To set up credentials:
 *   1. Sign in at reddit.com on the account that should post
 *   2. Go to https://www.reddit.com/prefs/apps → "create another app..."
 *   3. Pick "script" type, name it MatchMind, redirect_uri = http://localhost
 *   4. Note the app ID (under "personal use script") and the secret
 *   5. Add REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME,
 *      REDDIT_PASSWORD, REDDIT_SUBREDDIT, REDDIT_USER_AGENT to Vercel
 *
 * SUBREDDIT CHOICE — pick carefully:
 *   - r/SoccerBetting (~80k): allows analysis posts, recommended default
 *   - r/sportsbook: BANS picks outside daily megathread — don't use
 *   - r/footballbetting: smaller, lenient
 *   - r/Sports_Bets: lenient
 *   Always check the sub's posting rules before going live.
 */

import { NextResponse } from 'next/server'
import { getRedditAccessToken, submitRedditSelfPost } from '@/lib/reddit-poster'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

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
  key_factors?: string[]
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

interface BuiltAcca {
  legs: Array<{ pick: Pick; sum: NonNullable<ReturnType<typeof legSummary>> }>
  combinedOdds: number
  payoutOn10: number
}

async function buildAcca(legCount: number, windowHours: number): Promise<BuiltAcca | null> {
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
  const legs: BuiltAcca['legs'] = []
  for (const r of ranked) {
    const id = r.pick.id ?? -1
    if (id !== -1 && seen.has(id)) continue
    if (id !== -1) seen.add(id)
    legs.push(r)
    if (legs.length >= legCount) break
  }
  if (legs.length < 2) return null
  const combinedOdds = legs.reduce((acc, l) => acc * l.sum.odds, 1)
  const payoutOn10 = Math.round(combinedOdds * 10 * 100) / 100
  return { legs, combinedOdds, payoutOn10 }
}

function buildTitle(acca: BuiltAcca): string {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  })
  return `${acca.legs.length}-fold AI value acca @ ${acca.combinedOdds.toFixed(2)} — ${dateStr}`
}

function buildBody(acca: BuiltAcca): string {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  })
  const rows = acca.legs
    .map((l) => {
      const ko = l.pick.date
        ? new Date(l.pick.date).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/London',
          })
        : 'TBD'
      const league = l.pick.league ?? '—'
      const ev = l.sum.ev ? ` (${l.sum.ev > 0 ? '+' : ''}${l.sum.ev.toFixed(0)}% EV)` : ''
      return `| ${l.pick.home_team} v ${l.pick.away_team} | ${league} | ${ko} | ${l.sum.label} | ${l.sum.odds.toFixed(2)}${ev} |`
    })
    .join('\n')

  // Light reasoning block — first 1-2 key factors per leg if available.
  const reasoningBlocks = acca.legs
    .map((l, i) => {
      const factors = (l.pick.key_factors ?? []).slice(0, 2)
      if (factors.length === 0) return null
      const bullets = factors.map((f) => `- ${f}`).join('\n')
      return `**${i + 1}. ${l.pick.home_team} v ${l.pick.away_team}** — ${l.sum.label} @ ${l.sum.odds.toFixed(2)}\n${bullets}`
    })
    .filter(Boolean)
    .join('\n\n')

  return [
    `**${acca.legs.length}-fold AI value acca for ${dateStr}**`,
    '',
    `Combined odds: **${acca.combinedOdds.toFixed(2)}** · £10 → £${acca.payoutOn10.toFixed(2)}`,
    '',
    `| Match | League | Kickoff (UK) | Pick | Odds |`,
    `|---|---|---|---|---|`,
    rows,
    '',
    reasoningBlocks ? '---\n\n**Reasoning**\n\n' + reasoningBlocks + '\n\n---' : '---',
    '',
    `Picks generated by GPT-4 + Bet365 odds. Not financial advice — always bet responsibly.`,
    '',
    `More picks: ${APP_URL}`,
  ].join('\n')
}

// ── Route handler ────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    legs?: number
    windowHours?: number
    subreddit?: string
    title?: string
    body?: string
    dryRun?: boolean
  } = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    // empty body — defaults
  }
  const legCount = Math.max(2, Math.min(8, Number(body.legs) || 4))
  const windowHours = Math.max(3, Math.min(72, Number(body.windowHours) || 18))
  const dryRun = body.dryRun === true

  const acca = await buildAcca(legCount, windowHours)
  if (!acca && (!body.title || !body.body)) {
    return NextResponse.json(
      { error: 'No upcoming AI picks for an acca and no title/body override provided.' },
      { status: 404 },
    )
  }
  const title = body.title || buildTitle(acca!)
  const text = body.body || buildBody(acca!)
  const subreddit = body.subreddit || process.env.REDDIT_SUBREDDIT || 'SoccerBetting'

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      subreddit: subreddit.replace(/^r\//, ''),
      title,
      body: text,
      title_length: title.length,
      body_length: text.length,
      legs_used: acca?.legs.length ?? null,
      combined_odds: acca?.combinedOdds ?? null,
    })
  }

  // Reddit titles cap at 300 chars; bodies cap at 40k. Validate before
  // hitting the API so we get a clean error instead of a Reddit 400.
  if (title.length > 300) {
    return NextResponse.json(
      { error: `title too long (${title.length} > 300 chars)`, title },
      { status: 400 },
    )
  }
  if (text.length > 40_000) {
    return NextResponse.json(
      { error: `body too long (${text.length} > 40000 chars)` },
      { status: 400 },
    )
  }

  const tok = await getRedditAccessToken()
  if (!tok.ok) {
    return NextResponse.json(
      {
        error: tok.error,
        hint:
          'Set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET + REDDIT_USERNAME + REDDIT_PASSWORD in Vercel. Create the script app at https://www.reddit.com/prefs/apps. See route file for full setup steps.',
      },
      { status: 500 },
    )
  }
  const result = await submitRedditSelfPost(tok.token, subreddit, title, text)
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        subreddit,
        hint:
          'Common causes: subreddit bans tipster posts (try r/SoccerBetting), account too new for sub automod, or rate-limited.',
      },
      { status: 502 },
    )
  }
  return NextResponse.json({
    success: true,
    subreddit: subreddit.replace(/^r\//, ''),
    url: result.url,
    permalink: result.permalink,
    title,
  })
}
