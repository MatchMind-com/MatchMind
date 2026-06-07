/**
 * GET /api/og/ig-tour?slide={1-4}
 *
 * 4-slide product-tour carousel — pinnable. Each slide is 1080×1350.
 *
 *   slide=1  AI picks feed — "20+ value bets a day"
 *   slide=2  Bet tracker — "Auto-verifies every result"
 *   slide=3  AI coach — "Ask anything about any match"
 *   slide=4  Track record — "Every pick public, every result settled"
 *
 * The "insight into our website" pin Kemal asked for.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const W = 1080, H = 1350, PADX = 64

const COLORS = {
  bg: '#0F1115', fg: '#F5F1E8', fgMuted: '#6E6B62',
  brand: '#F97316', success: '#10B981', cyan: '#06B6D4',
  panel: '#1A1D24',
}

interface SlideDef {
  feature: string
  headline: string
  highlight: string
  body: string
  bullets: string[]
  url: string
  panelColor: string
}

const SLIDES: SlideDef[] = [
  {
    feature: 'TOOL 1 OF 4',
    headline: 'AI value-bet',
    highlight: 'feed.',
    body: 'Every match across 25 leagues scored by GPT-4o. Surfaced where AI probability beats the bookmaker.',
    bullets: ['25 leagues, every day', '20–60 picks per day', 'Logged 24h pre-kickoff', 'EV %, odds, AI reasoning'],
    url: 'matchmindcom.com/predictions',
    panelColor: '#F97316',
  },
  {
    feature: 'TOOL 2 OF 4',
    headline: 'Bet tracker that',
    highlight: 'verifies itself.',
    body: 'Log a bet in 5 seconds — we settle it automatically once the match ends. No spreadsheet, no manual entry.',
    bullets: ['Auto-grades wins/losses', 'P&L by month, league, market', 'Bankroll + Kelly staking', 'CSV export anytime'],
    url: 'matchmindcom.com/dashboard',
    panelColor: '#06B6D4',
  },
  {
    feature: 'TOOL 3 OF 4',
    headline: 'GPT-4o coach,',
    highlight: 'on every match.',
    body: 'Ask anything. Form, H2H, lineups, weather, referee tendencies — instant answer, sourced from real data.',
    bullets: ['Pre-match analysis', 'Live tactical questions', 'Bankroll guidance', 'Sanity-check your bets'],
    url: 'matchmindcom.com/coach',
    panelColor: '#10B981',
  },
  {
    feature: 'TOOL 4 OF 4',
    headline: 'Public track',
    highlight: 'record.',
    body: 'Every AI pick we\'ve ever made — wins AND losses. Anyone can audit. Anyone can fact-check. No edits.',
    bullets: ['500+ picks logged', 'Settled, signed, public', 'Filter by league/market/EV', 'Open to non-members too'],
    url: 'matchmindcom.com/track-record',
    panelColor: '#F43F5E',
  },
]

function Slide({ slide, def }: { slide: number; def: SlideDef }) {
  return (
    <div style={{
      width: W, height: H, display: 'flex', background: COLORS.bg, color: COLORS.fg,
      position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Corner gradient */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 720, height: 720,
        background: 'linear-gradient(225deg, rgba(249,115,22,0.12) 0%, rgba(15,17,21,0) 65%)',
        display: 'flex',
      }} />

      {/* Brand */}
      <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
          MATCH<span style={{ color: COLORS.brand }}>MIND</span>
        </span>
        <span style={{ fontSize: 12, color: COLORS.fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
          {def.feature}
        </span>
      </div>

      {/* Slide pips */}
      <div style={{ position: 'absolute', top: 70, right: PADX, display: 'flex' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            width: 32, height: 4, marginLeft: i > 1 ? 6 : 0,
            background: i === slide ? COLORS.brand : '#2A2D34',
            display: 'flex',
          }} />
        ))}
      </div>

      <div style={{ position: 'absolute', top: 165, left: PADX, width: 80, height: 4, background: COLORS.brand, display: 'flex' }} />

      {/* Headline */}
      <div style={{ position: 'absolute', top: 195, left: PADX, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 80, fontWeight: 900, letterSpacing: '-0.04em', color: COLORS.fg, lineHeight: 1 }}>
          {def.headline}
        </span>
        <span style={{ fontSize: 80, fontWeight: 900, letterSpacing: '-0.04em', color: def.panelColor, lineHeight: 1, marginTop: 6 }}>
          {def.highlight}
        </span>
      </div>

      {/* Body */}
      <div style={{ position: 'absolute', top: 460, left: PADX, width: W - PADX * 2, display: 'flex' }}>
        <span style={{ fontSize: 26, color: COLORS.fgMuted, lineHeight: 1.4, fontWeight: 500 }}>
          {def.body}
        </span>
      </div>

      {/* Bullet block */}
      <div style={{
        position: 'absolute', top: 660, left: PADX, width: W - PADX * 2,
        padding: '32px 36px', background: COLORS.panel,
        display: 'flex', flexDirection: 'column',
        borderLeft: `4px solid ${def.panelColor}`,
      }}>
        {def.bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: i < def.bullets.length - 1 ? 18 : 0 }}>
            <div style={{
              width: 8, height: 8, background: def.panelColor, marginRight: 16, display: 'flex',
            }} />
            <span style={{ fontSize: 24, color: COLORS.fg, fontWeight: 600 }}>
              {b}
            </span>
          </div>
        ))}
      </div>

      {/* Footer URL bar */}
      <div style={{
        position: 'absolute', bottom: 56, left: PADX, right: PADX,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13, color: COLORS.fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
            FIND IT HERE
          </span>
          <span style={{ fontSize: 26, color: COLORS.fg, fontWeight: 800, marginTop: 6 }}>
            {def.url}
          </span>
        </div>
        {slide < 4 && (
          <span style={{ fontSize: 16, color: COLORS.brand, fontWeight: 700, letterSpacing: '0.15em' }}>
            SWIPE →
          </span>
        )}
      </div>
    </div>
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const n = Math.max(1, Math.min(4, parseInt(searchParams.get('slide') ?? '1', 10) || 1))
  const def = SLIDES[n - 1]

  return new ImageResponse(
    Slide({ slide: n, def }),
    { width: W, height: H },
  )
}
