/**
 * GET /api/og/wc-team?slug=brazil
 *
 * Per-team World Cup OG card — 1200×630.
 * Edge runtime + 1h ISR. Satori-friendly: only flexbox, no grid, no
 * marginTop:auto, explicit widths on text spans.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getTeamBySlug } from '@/lib/world-cup-data'

export const runtime = 'edge'
export const revalidate = 3600

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug') ?? ''
  const profile = slug ? await getTeamBySlug(slug) : null

  const bg = '#0F1115'
  const fg = '#F5F1E8'
  const fgMuted = '#6E6B62'
  const brand = '#F97316'

  const opponents = profile
    ? profile.group.teams.filter(t => t.id !== profile.team.id).map(t => t.name).join(' · ')
    : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630, display: 'flex', flexDirection: 'column',
          background: bg, color: fg, padding: '52px 64px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Top bar — fixed-height row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', color: fg }}>
              MATCH<span style={{ color: brand }}>MIND</span>
            </span>
            <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', marginTop: 3 }}>
              FIFA WORLD CUP 2026
            </span>
          </div>
          {profile?.group && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${brand}55`, padding: '8px 18px',
            }}>
              <span style={{ fontSize: 14, color: brand, fontWeight: 800, letterSpacing: '0.15em' }}>
                {profile.group.name.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {profile ? (
          <>
            {/* Flag + team name */}
            <div style={{ display: 'flex', alignItems: 'center', width: 1072, height: 120, marginTop: 28 }}>
              {profile.team.logo && (
                <img src={profile.team.logo} alt="" width={96} height={96} style={{ marginRight: 26 }} />
              )}
              <span style={{ fontSize: 84, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: fg }}>
                {profile.team.name}
              </span>
            </div>

            {/* Opponents row — matches the working group-card pattern
                (column flex container with stacked spans, no
                width:1072 trick needed because the parent's children
                are spans, not flex divs). */}
            <div style={{
              display: 'flex', flexDirection: 'column', marginTop: 36,
              borderTop: `1px solid ${fgMuted}55`, borderBottom: `1px solid ${fgMuted}55`,
              padding: '20px 0',
            }}>
              <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em' }}>
                GROUP-STAGE OPPONENTS · {profile.fixtures.length} MATCHES
              </span>
              <span style={{ fontSize: 26, fontWeight: 700, color: fg, letterSpacing: '-0.01em', marginTop: 8 }}>
                {opponents}
              </span>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', marginTop: 28 }}>
              <span style={{ fontSize: 16, color: fgMuted }}>
                matchmindcom.com · Every pick logged · every result public · 18+
              </span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 80 }}>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: fg }}>World Cup 2026</span>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: brand, marginTop: 4 }}>predictions.</span>
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
