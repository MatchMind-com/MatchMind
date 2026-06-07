/**
 * GET /api/og/ig-recap?date=YYYY-MM-DD
 *
 * Instagram daily-recap card — 1080×1350.
 *
 * MARKETING RULE: never show a losing day in this card. If the requested
 * date (or yesterday by default) was a loss / void / no-settled-bets,
 * we walk backwards through the last 7 days and use the most recent
 * PROFITABLE day instead. If no profitable day exists in 7 days, render
 * a "no settled bets" or biggest-wins-style empty state.
 *
 * Losses are still 100% public on /track-record — they just don't
 * lead the social card.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const W = 1080, H = 1350, PADX = 64

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function ymdInTZ(d: Date, tz: string): string {
  return d.toLocaleDateString('en-CA', { timeZone: tz }) // "YYYY-MM-DD"
}

function dateRangeForDay(dateStr: string): { fromISO: string; toISO: string } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const from = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  const to = new Date(Date.UTC(y, m - 1, d, 23, 59, 59))
  return { fromISO: from.toISOString(), toISO: to.toISOString() }
}

interface DayResult {
  date: string
  wins: number
  losses: number
  voids: number
  profit: number
  settled: number
}

async function loadDay(dateStr: string): Promise<DayResult> {
  const { fromISO, toISO } = dateRangeForDay(dateStr)
  const { data } = await supabase
    .from('prediction_records')
    .select('home_team, away_team, bet_type, odds, result, kick_off')
    .eq('is_value_bet', true)
    .not('result', 'is', null)
    .gte('kick_off', fromISO)
    .lte('kick_off', toISO)
    .gt('ev_percent', 0)
    .lte('ev_percent', 10)
    .order('kick_off', { ascending: true })
    .limit(10)

  const rows = (data ?? []) as Array<{
    odds: number | null; result: 'win' | 'loss' | 'void'
  }>
  const wins = rows.filter(r => r.result === 'win').length
  const losses = rows.filter(r => r.result === 'loss').length
  const voids = rows.filter(r => r.result === 'void').length
  const stake = 10
  const profit = rows.reduce((acc, r) => {
    if (r.result === 'void' || !r.odds) return acc
    return acc + (r.result === 'win' ? stake * (r.odds - 1) : -stake)
  }, 0)
  return { date: dateStr, wins, losses, voids, profit, settled: wins + losses }
}

/**
 * Walk back up to 7 days from `startDate`, return the most recent day
 * that ended in profit. Returns null if none found.
 */
async function findRecentWinningDay(startDate: string): Promise<DayResult | null> {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(Date.UTC(sy, sm - 1, sd - offset))
    const ymd = ymdInTZ(candidate, 'Europe/London')
    const day = await loadDay(ymd)
    if (day.settled > 0 && day.profit > 0) return day
  }
  return null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  let dateStr = searchParams.get('date')
  if (!dateStr) {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
    dateStr = ymdInTZ(yesterday, 'Europe/London')
  }

  // Try the requested day first. If it lost (or had no settled bets),
  // walk back up to 7 days to find a winning day to show instead.
  const requested = await loadDay(dateStr!)
  const day = (requested.settled > 0 && requested.profit > 0)
    ? requested
    : await findRecentWinningDay(dateStr!)

  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62'
  const brand = '#F97316', success = '#10B981'

  // Empty-fallback: no winning day in 7 days → render a "no recent settled wins" card
  // (genuinely honest, doesn't pretend; cron should normally substitute biggest-wins here)
  if (!day) {
    return new ImageResponse(
      (
        <div style={{
          width: W, height: H, display: 'flex', background: bg, color: fg,
          position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 720, height: 720,
            background: 'linear-gradient(225deg, rgba(249,115,22,0.10) 0%, rgba(15,17,21,0) 65%)',
            display: 'flex',
          }} />
          <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
              MATCH<span style={{ color: brand }}>MIND</span>
            </span>
            <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
              QUIET WEEK · NEXT FIXTURES INCOMING
            </span>
          </div>
          <div style={{ position: 'absolute', top: 280, left: PADX, width: W - PADX * 2, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.04em', color: fg, lineHeight: 1 }}>
              Big week
            </span>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.04em', color: brand, lineHeight: 1, marginTop: 8 }}>
              ahead.
            </span>
            <span style={{ fontSize: 26, color: fgMuted, marginTop: 36, lineHeight: 1.4 }}>
              International break + World Cup kick-off coming. Fresh AI value bets logged daily.
            </span>
          </div>
          <div style={{ position: 'absolute', bottom: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 22, color: fg, fontWeight: 700 }}>matchmindcom.com</span>
            <span style={{ fontSize: 14, color: fgMuted, marginTop: 6 }}>
              Every pick logged before kick-off · every result public · 18+
            </span>
          </div>
        </div>
      ),
      { width: W, height: H },
    )
  }

  // Winning day — show with green-positive treatment
  const dateLabel = new Date(day.date + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const stake = 10
  const settled = day.wins + day.losses
  const isStale = day.date !== dateStr  // we walked back

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', background: bg, color: fg,
        position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {/* Corner gradients — always positive now (recap never shows red) */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 720, height: 720,
          background: 'linear-gradient(225deg, rgba(249,115,22,0.10) 0%, rgba(15,17,21,0) 65%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: 600, height: 600,
          background: 'linear-gradient(45deg, rgba(16,185,129,0.10) 0%, rgba(15,17,21,0) 65%)',
          display: 'flex',
        }} />

        {/* Brand */}
        <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
            MATCH<span style={{ color: brand }}>MIND</span>
          </span>
          <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
            {isStale ? 'MOST RECENT WINNING DAY' : 'YESTERDAY'} · SETTLED ON £{stake} STAKES
          </span>
        </div>

        {/* Headline */}
        <div style={{ position: 'absolute', top: 195, left: PADX, width: W - PADX * 2, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.04em', color: fg, lineHeight: 1 }}>
            {dateLabel}
          </span>
        </div>

        {/* W/L row — always green-leaning */}
        <div style={{
          position: 'absolute', top: 350, left: PADX, width: W - PADX * 2,
          display: 'flex', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 280 }}>
            <span style={{ fontSize: 13, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>WINS</span>
            <span style={{ fontSize: 130, fontWeight: 900, color: success, lineHeight: 1, marginTop: 8 }}>{day.wins}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', width: 280 }}>
            <span style={{ fontSize: 13, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>LOSSES</span>
            <span style={{ fontSize: 130, fontWeight: 900, color: fgMuted, lineHeight: 1, marginTop: 8 }}>{day.losses}</span>
          </div>
        </div>

        {/* P&L block */}
        <div style={{
          position: 'absolute', top: 640, left: PADX, width: W - PADX * 2,
          padding: '40px 36px', background: '#1A1D24', display: 'flex', flexDirection: 'column',
          borderLeft: `4px solid ${success}`,
        }}>
          <span style={{ fontSize: 14, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
            DAY P&amp;L · £{stake} PER PICK
          </span>
          <span style={{
            fontSize: 130, fontWeight: 900, color: success,
            lineHeight: 1, marginTop: 14, letterSpacing: '-0.03em',
          }}>
            +£{day.profit.toFixed(2)}
          </span>
        </div>

        {/* Honest line */}
        <div style={{
          position: 'absolute', top: 920, left: PADX, width: W - PADX * 2,
          display: 'flex',
        }}>
          <span style={{ fontSize: 22, color: fg, fontWeight: 500, lineHeight: 1.4 }}>
            {settled} bets · {day.wins}W {day.losses}L · +EV pays out in the long run.
          </span>
        </div>

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 22, color: fg, fontWeight: 700 }}>matchmindcom.com</span>
          <span style={{ fontSize: 14, color: fgMuted, marginTop: 6 }}>
            500+ picks tracked · 18+ BeGambleAware
          </span>
        </div>
      </div>
    ),
    { width: W, height: H },
  )
}
