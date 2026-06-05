/**
 * GET /api/og/wc-team?slug=brazil
 *
 * Per-team World Cup OG card — 1200×630 (Twitter/Facebook link spec).
 * Renders when /world-cup/teams/[team] is shared on social.
 *
 * Edge runtime — fast generation + CDN-cached.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getTeamBySlug } from '@/lib/world-cup-data'

export const runtime = 'edge'
// 1h ISR — same as the team page itself
export const revalidate = 3600

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug') ?? ''
  const profile = slug ? await getTeamBySlug(slug) : null

  // Tokens — must inline, no Tailwind in Edge
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
          {profile?.group && (
            <span style={{
              fontSize: 14, color: brand, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
              border: `1px solid ${brand}55`, padding: '8px 16px',
            }}>
              {profile.group.name}
            </span>
          )}
        </div>

        {profile ? (
          <>
            {/* Flag + team name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 24, marginBottom: 28 }}>
              {profile.team.logo && (
                <img
                  src={profile.team.logo}
                  alt=""
                  width={120}
                  height={120}
                  style={{ display: 'block' }}
                />
              )}
              <span style={{ fontSize: 110, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {profile.team.name}
              </span>
            </div>

            {/* Strap */}
            <p style={{
              fontSize: 24, color: fgMuted, marginTop: 0, marginBottom: 32, lineHeight: 1.3, maxWidth: '95%',
            }}>
              {profile.fixtures.length} group-stage matches · AI value-bet predictions logged before each kick-off
            </p>

            {/* Opponents row */}
            <div style={{
              display: 'flex', alignItems: 'stretch', borderTop: `1px solid ${fgMuted}40`,
              borderBottom: `1px solid ${fgMuted}40`, paddingTop: 22, paddingBottom: 22, marginTop: 'auto',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  Opponents
                </span>
                <span style={{ fontSize: 26, fontWeight: 700, marginTop: 6, letterSpacing: '-0.01em' }}>
                  {profile.group.teams.filter(t => t.id !== profile.team.id).map(t => t.name).join(' · ')}
                </span>
              </div>
            </div>

            {/* Footer */}
            <p style={{ fontSize: 18, color: fgMuted, marginTop: 18 }}>
              matchmindcom.com · Every pick logged · every result public
            </p>
          </>
        ) : (
          /* Fallback when team not found */
          <>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40 }}>
              <span style={{ fontSize: 96, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1 }}>World Cup 2026</span>
              <span style={{ fontSize: 96, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, color: brand }}>predictions.</span>
            </div>
            <p style={{ fontSize: 24, color: fgMuted, marginTop: 'auto' }}>
              48 teams · 12 groups · matchmindcom.com
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
