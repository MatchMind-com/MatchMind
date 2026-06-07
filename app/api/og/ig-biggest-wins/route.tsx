/**
 * GET /api/og/ig-biggest-wins
 *
 * Marketing hero — replaces ig-why-publish-losses as the trust artifact.
 * Strategy pivot: lead with the wins, not the losses (losses still public
 * on /track-record, just not the marketing hook).
 *
 * Shows over the last 30 days:
 *   - Biggest single odds cashed (e.g. "Brazil 1-0 Argentina @ 4.50")
 *   - Best AI edge that hit (highest ev_percent on a win)
 *   - Total wins + ROI%
 *
 * Pulls live from prediction_records.
 */

import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const W = 1080, H = 1350, PADX = 64

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface Row {
  home_team: string
  away_team: string
  bet_type: string
  odds: number | null
  result: 'win' | 'loss' | 'void'
  ev_percent: number | null
  kick_off: string
}

export async function GET() {
  // Last 30 days of settled value bets
  const sinceISO = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  const { data } = await supabase
    .from('prediction_records')
    .select('home_team, away_team, bet_type, odds, result, ev_percent, kick_off')
    .eq('is_value_bet', true)
    .not('result', 'is', null)
    .gte('kick_off', sinceISO)
    .gt('ev_percent', 0)
    .lte('ev_percent', 10)
    .limit(500)

  const rows = (data ?? []) as Row[]
  const wins = rows.filter(r => r.result === 'win')
  const losses = rows.filter(r => r.result === 'loss')
  const stake = 10
  const totalStaked = (wins.length + losses.length) * stake
  const totalReturn = wins.reduce(
    (acc, r) => acc + (r.odds ? stake * r.odds : 0),
    0,
  )
  const profit = totalReturn - totalStaked
  const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0

  // Biggest odds cashed
  const biggestOddsWin = [...wins]
    .filter(r => r.odds && r.odds > 1)
    .sort((a, b) => (b.odds ?? 0) - (a.odds ?? 0))[0]

  // Best AI edge that hit
  const bestEdgeWin = [...wins]
    .filter(r => r.ev_percent && r.ev_percent > 0)
    .sort((a, b) => (b.ev_percent ?? 0) - (a.ev_percent ?? 0))[0]

  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62'
  const brand = '#F97316', success = '#10B981'

  // Friendly bet-type formatter
  const fmtBet = (s?: string) => (s ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', background: bg, color: fg,
        position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {/* Subtle radial gradient accent (Satori-safe linear) */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 720, height: 720,
          background: 'linear-gradient(225deg, rgba(249,115,22,0.10) 0%, rgba(15,17,21,0) 65%)',
          display: 'flex',
        }} />

        {/* Brand */}
        <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
            MATCH<span style={{ color: brand }}>MIND</span>
          </span>
          <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
            LAST 30 DAYS · AI VALUE BETS
          </span>
        </div>

        {/* Big badge top-right — wins count + best secondary stat.
           Negative ROI is hidden here (full numbers on /track-record).
           When ROI is positive we lead with it; otherwise we lead with
           the biggest single odds cashed — both honest, neither vanity. */}
        <div style={{
          position: 'absolute', top: 56, right: PADX, display: 'flex',
          border: `1px solid ${success}55`, padding: '8px 16px',
        }}>
          <span style={{ fontSize: 13, color: success, fontWeight: 800, letterSpacing: '0.15em' }}>
            {wins.length} WINS{roi > 0 ? ` · +${roi.toFixed(1)}% ROI` : biggestOddsWin?.odds ? ` · ${biggestOddsWin.odds.toFixed(2)} TOP` : ''}
          </span>
        </div>

        {/* Accent line */}
        <div style={{ position: 'absolute', top: 165, left: PADX, width: 80, height: 4, background: brand, display: 'flex' }} />

        {/* Hero headline */}
        <div style={{ position: 'absolute', top: 195, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 96, fontWeight: 900, letterSpacing: '-0.04em', color: fg, lineHeight: 1 }}>
            Wins that
          </span>
          <span style={{ fontSize: 96, fontWeight: 900, letterSpacing: '-0.04em', color: brand, lineHeight: 1, marginTop: 6 }}>
            cashed.
          </span>
        </div>

        {/* Biggest odds win block */}
        {biggestOddsWin && (
          <div style={{
            position: 'absolute', top: 470, left: PADX, width: W - PADX * 2,
            padding: '28px 32px', background: '#1A1D24', display: 'flex',
            borderLeft: `4px solid ${success}`,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <span style={{ fontSize: 13, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
                BIGGEST ODDS CASHED
              </span>
              <span style={{ fontSize: 32, fontWeight: 800, color: fg, marginTop: 12, letterSpacing: '-0.02em' }}>
                {biggestOddsWin.home_team} v {biggestOddsWin.away_team}
              </span>
              <span style={{ fontSize: 20, color: fgMuted, marginTop: 6 }}>
                {fmtBet(biggestOddsWin.bet_type)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              <span style={{ fontSize: 72, fontWeight: 900, color: success, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {biggestOddsWin.odds?.toFixed(2)}
              </span>
              <span style={{ fontSize: 14, color: fgMuted, marginTop: 4, fontWeight: 700, letterSpacing: '0.15em' }}>
                ODDS
              </span>
            </div>
          </div>
        )}

        {/* Best edge win block */}
        {bestEdgeWin && (
          <div style={{
            position: 'absolute', top: 670, left: PADX, width: W - PADX * 2,
            padding: '28px 32px', background: '#1A1D24', display: 'flex',
            borderLeft: `4px solid ${brand}`,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <span style={{ fontSize: 13, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
                BEST AI EDGE THAT HIT
              </span>
              <span style={{ fontSize: 32, fontWeight: 800, color: fg, marginTop: 12, letterSpacing: '-0.02em' }}>
                {bestEdgeWin.home_team} v {bestEdgeWin.away_team}
              </span>
              <span style={{ fontSize: 20, color: fgMuted, marginTop: 6 }}>
                {fmtBet(bestEdgeWin.bet_type)} @ {bestEdgeWin.odds?.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              <span style={{ fontSize: 72, fontWeight: 900, color: brand, letterSpacing: '-0.03em', lineHeight: 1 }}>
                +{(bestEdgeWin.ev_percent ?? 0).toFixed(1)}%
              </span>
              <span style={{ fontSize: 14, color: fgMuted, marginTop: 4, fontWeight: 700, letterSpacing: '0.15em' }}>
                EDGE
              </span>
            </div>
          </div>
        )}

        {/* Honest body line */}
        <div style={{
          position: 'absolute', top: 900, left: PADX, width: W - PADX * 2,
          display: 'flex',
        }}>
          <span style={{ fontSize: 22, color: fgMuted, lineHeight: 1.4, fontWeight: 500 }}>
            Every pick logged 24h before kick-off. Every result public on the site — wins AND losses. No edits, no &quot;guaranteed&quot;.
          </span>
        </div>

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 22, color: fg, fontWeight: 700 }}>matchmindcom.com</span>
          <span style={{ fontSize: 14, color: fgMuted, marginTop: 6 }}>
            AI value bets across 25 leagues · 18+ BeGambleAware
          </span>
        </div>
      </div>
    ),
    { width: W, height: H },
  )
}
