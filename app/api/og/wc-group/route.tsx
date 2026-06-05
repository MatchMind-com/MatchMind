/**
 * GET /api/og/wc-group?slug=a
 * Per-group WC OG card — 1200×630, absolute positioning.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getGroupBySlug } from '@/lib/world-cup-data'

export const runtime = 'edge'
export const revalidate = 3600

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug') ?? ''
  const group = slug ? await getGroupBySlug(slug) : null

  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62', brand = '#F97316'
  const W = 1200, H = 630, PADX = 64

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', background: bg, color: fg,
        position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {/* Brand */}
        <div style={{ position: 'absolute', top: 52, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', color: fg }}>
            MATCH<span style={{ color: brand }}>MIND</span>
          </span>
          <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', marginTop: 3 }}>
            FIFA WORLD CUP 2026
          </span>
        </div>

        {/* Matches count badge */}
        {group && (
          <div style={{
            position: 'absolute', top: 52, right: PADX, display: 'flex',
            border: `1px solid ${brand}55`, padding: '8px 18px',
          }}>
            <span style={{ fontSize: 14, color: brand, fontWeight: 800, letterSpacing: '0.15em' }}>
              {group.fixtures.length} MATCHES
            </span>
          </div>
        )}

        {group ? (
          <>
            {/* Big group name — left half */}
            <div style={{ position: 'absolute', top: 200, left: PADX, display: 'flex' }}>
              <span style={{ fontSize: 130, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, color: fg }}>
                {group.name}
              </span>
            </div>

            {/* Teams — right side, stacked */}
            <div style={{
              position: 'absolute', top: 165, right: PADX, width: 440,
              display: 'flex', flexDirection: 'column',
              borderTop: `1px solid ${fgMuted}55`, paddingTop: 18,
            }}>
              {group.teams.map((t, i) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center',
                    paddingTop: i === 0 ? 0 : 12, paddingBottom: 12,
                    borderBottom: i < group.teams.length - 1 ? `1px solid ${fgMuted}55` : 'none',
                  }}
                >
                  {t.logo && (
                    <img src={t.logo} alt="" width={32} height={32} style={{ marginRight: 14 }} />
                  )}
                  <span style={{ fontSize: 28, fontWeight: 800, color: fg, letterSpacing: '-0.02em' }}>
                    {t.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ position: 'absolute', bottom: 52, left: PADX, display: 'flex' }}>
              <span style={{ fontSize: 16, color: fgMuted }}>
                matchmindcom.com · AI value-bet predictions for all 6 fixtures · 18+
              </span>
            </div>
          </>
        ) : (
          <div style={{ position: 'absolute', top: 180, left: PADX, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: fg }}>World Cup 2026</span>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: brand, marginTop: 4 }}>group predictions.</span>
          </div>
        )}
      </div>
    ),
    { width: W, height: H },
  )
}
