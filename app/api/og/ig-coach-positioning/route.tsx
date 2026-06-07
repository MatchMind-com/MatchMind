/**
 * GET /api/og/ig-coach-positioning
 *
 * Evergreen brand positioning IG card — "You're the coach of your own
 * sports betting fund. MatchMind gives you the tools to run it."
 * Bold typography statement, anchored to feature breakdown.
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const W = 1080, H = 1350, PADX = 64

export async function GET() {
  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62', brand = '#F97316'

  const tools = [
    { name: 'Analyst desk', desc: 'AI picks across 25 leagues' },
    { name: 'Embedded coach', desc: 'GPT-4o chat on any match' },
    { name: 'Risk management', desc: 'Bankroll + Kelly staking' },
    { name: 'Public audit log', desc: '500+ picks, every result open' },
  ]

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
          background: 'linear-gradient(45deg, rgba(16,185,129,0.06) 0%, rgba(15,17,21,0) 65%)',
          display: 'flex',
        }} />

        <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
            MATCH<span style={{ color: brand }}>MIND</span>
          </span>
          <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
            POSITIONING
          </span>
        </div>

        <div style={{ position: 'absolute', top: 165, left: PADX, width: 80, height: 4, background: brand, display: 'flex' }} />

        {/* Brand line */}
        <div style={{ position: 'absolute', top: 195, left: PADX, display: 'flex', flexDirection: 'column', width: W - PADX * 2 }}>
          <span style={{ fontSize: 76, fontWeight: 900, letterSpacing: '-0.04em', color: fg, lineHeight: 1 }}>
            You're the coach
          </span>
          <span style={{ fontSize: 76, fontWeight: 900, letterSpacing: '-0.04em', color: fg, lineHeight: 1, marginTop: 6 }}>
            of your own
          </span>
          <span style={{ fontSize: 76, fontWeight: 900, letterSpacing: '-0.04em', color: brand, lineHeight: 1, marginTop: 6 }}>
            betting fund.
          </span>
          <span style={{ fontSize: 28, color: fgMuted, marginTop: 28, fontWeight: 500 }}>
            MatchMind gives you the tools to run it.
          </span>
        </div>

        {/* Tools list */}
        <div style={{
          position: 'absolute', top: 720, left: PADX, width: W - PADX * 2,
          display: 'flex', flexDirection: 'column',
          borderTop: `1px solid ${fgMuted}55`, paddingTop: 24,
        }}>
          {tools.map((t, i) => (
            <div
              key={t.name}
              style={{
                display: 'flex', alignItems: 'center', height: 90,
                borderBottom: i < tools.length - 1 ? `1px solid ${fgMuted}33` : 'none',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: fg, letterSpacing: '-0.02em' }}>
                  {t.name}
                </span>
                <span style={{ fontSize: 18, color: fgMuted, marginTop: 4 }}>
                  {t.desc}
                </span>
              </div>
              <span style={{ fontSize: 32, color: brand, fontWeight: 900, marginLeft: 24 }}>
                →
              </span>
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', bottom: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 22, color: fg, fontWeight: 700 }}>matchmindcom.com</span>
          <span style={{ fontSize: 14, color: fgMuted, marginTop: 6 }}>
            Not a tips site. A workspace · 18+ BeGambleAware
          </span>
        </div>
      </div>
    ),
    { width: W, height: H },
  )
}
