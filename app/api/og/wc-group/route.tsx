/**
 * GET /api/og/wc-group?slug=a
 *
 * Per-group World Cup OG card — 1200×630.
 * Renders when /world-cup/groups/[group] is shared on social.
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
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: bg, color: fg, padding: '56px 64px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em' }}>
              MATCH<span style={{ color: brand }}>MIND</span>
            </span>
            <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 3 }}>
              FIFA World Cup 2026
            </span>
          </div>
          {group && (
            <span style={{
              fontSize: 14, color: brand, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
              border: `1px solid ${brand}55`, padding: '8px 16px',
            }}>
              {group.fixtures.length} matches
            </span>
          )}
        </div>

        {group ? (
          <>
            {/* Group name — massive */}
            <span style={{ fontSize: 140, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 0.95, marginBottom: 24 }}>
              {group.name}
            </span>

            {/* 2x2 team grid w/ flags */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
              border: `1px solid ${fgMuted}40`, marginTop: 12, marginBottom: 'auto',
            }}>
              {group.teams.map((t, i) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px',
                    borderRight: i % 2 === 0 ? `1px solid ${fgMuted}40` : 'none',
                    borderBottom: i < 2 ? `1px solid ${fgMuted}40` : 'none',
                  }}
                >
                  {t.logo && (
                    <img src={t.logo} alt="" width={36} height={36} style={{ display: 'block' }} />
                  )}
                  <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>
                    {t.name}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 20, color: fgMuted, marginTop: 18 }}>
              AI value-bet predictions for all 6 fixtures · matchmindcom.com
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40 }}>
              <span style={{ fontSize: 96, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1 }}>World Cup 2026</span>
              <span style={{ fontSize: 96, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, color: brand }}>group predictions.</span>
            </div>
            <p style={{ fontSize: 24, color: fgMuted, marginTop: 'auto' }}>
              12 groups · matchmindcom.com
            </p>
          </>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
