/**
 * POST /api/admin/post-daily-recap
 *
 * Composes and tweets a daily W/L recap of today's settled AI value bets.
 * Pulls from prediction_records (set by /api/cron/check-predictions when
 * matches finish), groups them by outcome, computes net P&L on a £10
 * stake per pick, and posts a single honest summary tweet.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}  OR  x-vercel-cron: 1
 *
 * Body (all optional):
 *   {
 *     "dryRun":         false  // return tweet text without posting
 *     "stakePerPick":   10     // hypothetical £ per pick (default £10)
 *   }
 *
 * No spam risk: one tweet/day max. Includes the standout result so the
 * post has a concrete hook even when the day's record is neutral.
 *
 * Wired in vercel.json @ 22:00 UTC daily (one hour after check-predictions
 * settles the day's matches).
 */

import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { postTweet } from '@/lib/twitter-poster'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface SettledRow {
  home_team: string
  away_team: string
  bet_type: string
  odds: number | null
  ev_percent: number | null
  result: 'win' | 'loss' | 'void'
  kick_off: string
}

function startOfTodayUTC(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function profitFor(row: SettledRow, stake: number): number {
  if (row.result === 'void') return 0
  if (row.result === 'loss') return -stake
  // win
  const odds = Number(row.odds) || 0
  if (odds <= 1) return 0
  return Math.round((stake * (odds - 1)) * 100) / 100
}

function buildRecapTweet(
  rows: SettledRow[],
  stake: number,
): { text: string; wins: number; losses: number; voids: number; profit: number } {
  const wins = rows.filter(r => r.result === 'win').length
  const losses = rows.filter(r => r.result === 'loss').length
  const voids = rows.filter(r => r.result === 'void').length
  const profit = rows.reduce((acc, r) => acc + profitFor(r, stake), 0)

  // Best result of the day to anchor the tweet — highest-odds win, or
  // if no wins, biggest loss (transparency over hype).
  const wonRows = rows.filter(r => r.result === 'win').sort((a, b) => (b.odds || 0) - (a.odds || 0))
  const standout = wonRows[0]

  const fmtMoney = (n: number) =>
    `${n >= 0 ? '+' : '−'}£${Math.abs(n).toFixed(Math.abs(n) % 1 === 0 ? 0 : 2)}`

  const profitLine = profit > 0
    ? `Day P&L on £${stake} stakes: ${fmtMoney(profit)} ✅`
    : profit < 0
      ? `Day P&L on £${stake} stakes: ${fmtMoney(profit)}`
      : `Day P&L on £${stake} stakes: £0 (flat)`

  const header = `📊 TODAY'S AI VALUE-BET RECAP`
  const recordLine = voids > 0
    ? `${wins}W · ${losses}L · ${voids}V (${wins + losses + voids} picks settled)`
    : `${wins}W · ${losses}L (${wins + losses} picks settled)`

  let standoutLine = ''
  if (standout) {
    const oddsStr = standout.odds ? `@ ${standout.odds.toFixed(2)}` : ''
    standoutLine = `\n\nStandout: ${standout.home_team} v ${standout.away_team}\n${standout.bet_type} ${oddsStr} ✅`
  } else if (rows.length > 0 && losses > 0) {
    // Honest "no wins today" note
    standoutLine = `\n\nNo wins today — every result tracked publicly.`
  }

  const footer = `\n\nLive picks → matchmindcom.com`

  const text = `${header}\n\n${recordLine}\n${profitLine}${standoutLine}${footer}`
  return { text, wins, losses, voids, profit }
}

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { dryRun?: boolean; stakePerPick?: number } = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    // empty body — defaults
  }
  const dryRun = body.dryRun === true
  const stake = Math.max(1, Math.min(100, Number(body.stakePerPick) || 10))

  // Today's settled value bets only (is_value_bet=true is what the website
  // surfaces; pulling all settled picks would dilute the recap with non-
  // featured bets).
  const todayStart = startOfTodayUTC()
  const { data: rows, error } = await supabaseAdmin
    .from('prediction_records')
    .select('home_team, away_team, bet_type, odds, ev_percent, result, kick_off')
    .eq('is_value_bet', true)
    .not('result', 'is', null)
    .gte('kick_off', todayStart.toISOString())
    .lte('ev_percent', 10) // match MAX_REAL_EV; never recap zombie rows
    .gt('ev_percent', 0)

  if (error) {
    console.error('[post-daily-recap] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      message: 'No settled value bets to recap today',
      sent: 0,
    })
  }

  const { text, wins, losses, voids, profit } = buildRecapTweet(rows as SettledRow[], stake)

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      stats: { wins, losses, voids, profit, picks: rows.length },
      tweet: text,
      length: text.length,
    })
  }

  if (text.length > 280) {
    // Trim the standout line — keep the headline numbers
    const trimmed = text.split('\n\nStandout:')[0] + '\n\nLive picks → matchmindcom.com'
    if (trimmed.length > 280) {
      return NextResponse.json({
        error: 'Recap text too long even after trimming',
        text,
      }, { status: 400 })
    }
    const r = await postTweet(trimmed)
    return NextResponse.json({ ...r, stats: { wins, losses, voids, profit, picks: rows.length }, tweet: trimmed })
  }

  const r = await postTweet(text)
  if (!r.ok) {
    return NextResponse.json({ ...r, tweet: text }, { status: 502 })
  }
  return NextResponse.json({
    ...r,
    stats: { wins, losses, voids, profit, picks: rows.length },
    tweet: text,
  })
}

// Vercel cron fires GET — reuse the POST handler.
export const GET = POST
