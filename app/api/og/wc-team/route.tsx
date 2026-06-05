/**
 * GET /api/og/wc-team?slug=brazil
 * Per-team WC OG card — 1200×630, absolute positioning (bulletproof).
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

  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62', brand = '#F97316'
  const W = 1200, H = 630, PADX = 64

  const opponents = profile
    ? profile.group.teams.filter(t => t.id !== profile.team.id).map(t => t.name).join(' · ')
    : ''

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

        {/* Group badge */}
        {profile?.group && (
          <div style={{
            position: 'absolute', top: 52, right: PADX, display: 'flex',
            border: `1px solid ${brand}55`, padding: '8px 18px',
          }}>
            <span style={{ fontSize: 14, color: brand, fontWeight: 800, letterSpacing: '0.15em' }}>
              {profile.group.name.toUpperCase()}
            </span>
          </div>
        )}

        {profile ? (
          <>
            {/* Flag + team name */}
            <div style={{ position: 'absolute', top: 180, left: PADX, display: 'flex', alignItems: 'center' }}>
              {profile.team.logo && (
                <img src={profile.team.logo} alt="" width={110} height={110} style={{ marginRight: 32 }} />
              )}
              <span style={{ fontSize: 96, fontWeight: 900, letterSpacing: '-0.04em', color: fg, lineHeight: 1 }}>
                {profile.team.name}
              </span>
            </div>

            {/* Opponents section */}
            <div style={{
              position: 'absolute', top: 360, left: PADX, width: W - PADX * 2,
              borderTop: `1px solid ${fgMuted}55`, borderBottom: `1px solid ${fgMuted}55`,
              padding: '20px 0', display: 'flex', flexDirection: 'column',
            }}>
              <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em' }}>
                GROUP-STAGE OPPONENTS · {profile.fixtures.length} MATCHES
              </span>
              <span style={{ fontSize: 26, fontWeight: 700, color: fg, letterSpacing: '-0.01em', marginTop: 8 }}>
                {opponents}
              </span>
            </div>

            {/* Footer */}
            <div style={{ position: 'absolute', bottom: 52, left: PADX, display: 'flex' }}>
              <span style={{ fontSize: 16, color: fgMuted }}>
                matchmindcom.com · Every pick logged · every result public · 18+
              </span>
            </div>
          </>
        ) : (
          <div style={{ position: 'absolute', top: 180, left: PADX, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: fg }}>World Cup 2026</span>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: brand, marginTop: 4 }}>predictions.</span>
          </div>
        )}
      </div>
    ),
    { width: W, height: H },
  )
}
