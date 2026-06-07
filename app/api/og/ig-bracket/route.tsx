/**
 * GET /api/og/ig-bracket?group={A-L}
 *
 * Instagram carousel slide for the WC bracket — 1080×1350.
 * One slide per group; post 12 of them as a carousel.
 * Shows group letter, 4 teams w/ flags, first-match date.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getGroupBySlug } from '@/lib/world-cup-data'

export const runtime = 'edge'
export const revalidate = 3600

const W = 1080, H = 1350, PADX = 64

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = (searchParams.get('group') ?? 'a').toLowerCase()
  const group = await getGroupBySlug(slug)

  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62', brand = '#F97316'

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', background: bg, color: fg,
        position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {/* Brand */}
        <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
            MATCH<span style={{ color: brand }}>MIND</span>
          </span>
          <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
            FIFA WORLD CUP 2026
          </span>
        </div>

        {/* Match count badge */}
        {group && (
          <div style={{
            position: 'absolute', top: 56, right: PADX, display: 'flex',
            border: `1px solid ${brand}55`, padding: '8px 16px',
          }}>
            <span style={{ fontSize: 13, color: brand, fontWeight: 800, letterSpacing: '0.15em' }}>
              {group.fixtures.length} MATCHES
            </span>
          </div>
        )}

        {/* Diagonal accent */}
        <div style={{ position: 'absolute', top: 165, left: PADX, width: 80, height: 4, background: brand, display: 'flex' }} />

        {group ? (
          <>
            {/* Giant group name */}
            <div style={{ position: 'absolute', top: 200, left: PADX, display: 'flex' }}>
              <span style={{ fontSize: 200, fontWeight: 900, letterSpacing: '-0.07em', color: fg, lineHeight: 1 }}>
                {group.name}
              </span>
            </div>

            {/* 4 teams stacked, each on own row with flag */}
            <div style={{
              position: 'absolute', top: 480, left: PADX, width: W - PADX * 2,
              display: 'flex', flexDirection: 'column',
              borderTop: `1px solid ${fgMuted}55`, paddingTop: 24,
            }}>
              {group.teams.map((t, i) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', height: 130,
                    borderBottom: i < group.teams.length - 1 ? `1px solid ${fgMuted}33` : 'none',
                  }}
                >
                  {t.logo && (
                    <img src={t.logo} alt="" width={72} height={72} style={{ marginRight: 32 }} />
                  )}
                  <span style={{ fontSize: 56, fontWeight: 900, color: fg, letterSpacing: '-0.03em' }}>
                    {t.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ position: 'absolute', bottom: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 22, color: fg, fontWeight: 700 }}>matchmindcom.com</span>
              <span style={{ fontSize: 14, color: fgMuted, marginTop: 6 }}>
                AI value-bet predictions for all 104 WC matches · 18+
              </span>
            </div>
          </>
        ) : (
          <div style={{ position: 'absolute', top: 300, left: PADX, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 120, fontWeight: 900, letterSpacing: '-0.05em', color: fg }}>World Cup</span>
            <span style={{ fontSize: 120, fontWeight: 900, letterSpacing: '-0.05em', color: brand, marginTop: 8 }}>2026.</span>
          </div>
        )}
      </div>
    ),
    { width: W, height: H },
  )
}
