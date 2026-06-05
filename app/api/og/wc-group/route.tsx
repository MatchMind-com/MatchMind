/**
 * GET /api/og/wc-group?slug=a
 *
 * Per-group World Cup OG card — 1200×630.
 * Satori-friendly: flexbox only, explicit dimensions everywhere.
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

  const bg = '#0F1115'
  const fg = '#F5F1E8'
  const fgMuted = '#6E6B62'
  const brand = '#F97316'

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630, display: 'flex', flexDirection: 'column',
          background: bg, color: fg, padding: '52px 64px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', color: fg }}>
              MATCH<span style={{ color: brand }}>MIND</span>
            </span>
            <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', marginTop: 3 }}>
              FIFA WORLD CUP 2026
            </span>
          </div>
          {group && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${brand}55`, padding: '8px 18px',
            }}>
              <span style={{ fontSize: 14, color: brand, fontWeight: 800, letterSpacing: '0.15em' }}>
                {group.fixtures.length} MATCHES
              </span>
            </div>
          )}
        </div>

        {group ? (
          <>
            {/* Big group name */}
            <div style={{ display: 'flex', marginTop: 24, height: 130 }}>
              <span style={{ fontSize: 120, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, color: fg }}>
                {group.name}
              </span>
            </div>

            {/* 4 team rows — each full width, stacked vertically */}
            <div style={{
              display: 'flex', flexDirection: 'column', marginTop: 28,
              borderTop: `1px solid ${fgMuted}55`,
            }}>
              {group.teams.map(t => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', width: 1072, height: 64,
                    padding: '0 4px', borderBottom: `1px solid ${fgMuted}55`,
                  }}
                >
                  {t.logo && (
                    <img src={t.logo} alt="" width={36} height={36} style={{ marginRight: 16 }} />
                  )}
                  <span style={{ fontSize: 30, fontWeight: 800, color: fg, letterSpacing: '-0.02em' }}>
                    {t.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer — fixed at bottom via fixed total content height */}
            <div style={{ display: 'flex', marginTop: 16 }}>
              <span style={{ fontSize: 18, color: fgMuted, width: 1072 }}>
                AI value-bet predictions for all 6 fixtures · matchmindcom.com
              </span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 80 }}>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: fg }}>World Cup 2026</span>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: brand, marginTop: 4 }}>group predictions.</span>
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
