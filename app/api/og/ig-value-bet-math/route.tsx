/**
 * GET /api/og/ig-value-bet-math
 *
 * Evergreen educational IG card — "Value-bet maths in 30 seconds."
 * Saveable explainer infographic. No data dependencies.
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const W = 1080, H = 1350, PADX = 64

export async function GET() {
  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62'
  const brand = '#F97316', success = '#10B981'

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', background: bg, color: fg,
        position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {/* Corner gradients */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 720, height: 720,
          background: 'linear-gradient(225deg, rgba(249,115,22,0.12) 0%, rgba(15,17,21,0) 65%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: 600, height: 600,
          background: 'linear-gradient(45deg, rgba(16,185,129,0.08) 0%, rgba(15,17,21,0) 65%)',
          display: 'flex',
        }} />

        <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
            MATCH<span style={{ color: brand }}>MIND</span>
          </span>
          <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
            EXPLAINER · SAVE THIS
          </span>
        </div>

        <div style={{ position: 'absolute', top: 165, left: PADX, width: 80, height: 4, background: brand, display: 'flex' }} />

        <div style={{ position: 'absolute', top: 195, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 86, fontWeight: 900, letterSpacing: '-0.04em', color: fg, lineHeight: 1 }}>
            Value bets,
          </span>
          <span style={{ fontSize: 86, fontWeight: 900, letterSpacing: '-0.04em', color: brand, lineHeight: 1, marginTop: 6 }}>
            in 30 seconds.
          </span>
        </div>

        {/* Step 1 */}
        <div style={{ position: 'absolute', top: 470, left: PADX, width: W - PADX * 2, display: 'flex', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 60, fontWeight: 900, color: brand, marginRight: 24, lineHeight: 1, width: 80 }}>1</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: fg, lineHeight: 1.1 }}>Odds 2.00 = bookmaker says 50%</span>
            <span style={{ fontSize: 20, color: fgMuted, marginTop: 10, lineHeight: 1.4 }}>1 ÷ 2.00 = 0.50. Their implied probability.</span>
          </div>
        </div>

        {/* Step 2 */}
        <div style={{ position: 'absolute', top: 660, left: PADX, width: W - PADX * 2, display: 'flex', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 60, fontWeight: 900, color: brand, marginRight: 24, lineHeight: 1, width: 80 }}>2</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: fg, lineHeight: 1.1 }}>AI says it's actually 55%</span>
            <span style={{ fontSize: 20, color: fgMuted, marginTop: 10, lineHeight: 1.4 }}>Built from form, lineups, head-to-head, ref tendencies.</span>
          </div>
        </div>

        {/* Step 3 - the punchline */}
        <div style={{ position: 'absolute', top: 850, left: PADX, width: W - PADX * 2, display: 'flex', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 60, fontWeight: 900, color: success, marginRight: 24, lineHeight: 1, width: 80 }}>3</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: success, lineHeight: 1.1 }}>Edge: 55% × 2.00 − 1 = +10%</span>
            <span style={{ fontSize: 20, color: fgMuted, marginTop: 10, lineHeight: 1.4 }}>Bet £10 → expected value £1. Long-run profit, not guaranteed wins.</span>
          </div>
        </div>

        {/* Bottom strip */}
        <div style={{
          position: 'absolute', top: 1075, left: PADX, width: W - PADX * 2,
          padding: '24px 28px', background: '#1A1D24', display: 'flex', flexDirection: 'column',
        }}>
          <span style={{ fontSize: 14, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>HOW MATCHMIND WORKS</span>
          <span style={{ fontSize: 24, color: fg, marginTop: 8, lineHeight: 1.3 }}>
            Scans 25 leagues, finds where AI &gt; bookmaker. Logs every pick before kick-off.
          </span>
        </div>

        <div style={{ position: 'absolute', bottom: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 22, color: fg, fontWeight: 700 }}>matchmindcom.com</span>
          <span style={{ fontSize: 14, color: fgMuted, marginTop: 6 }}>
            500+ picks tracked · 43% value-bet win rate · 18+ BeGambleAware
          </span>
        </div>
      </div>
    ),
    { width: W, height: H },
  )
}
