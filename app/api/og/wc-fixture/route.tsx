/**
 * GET /api/og/wc-fixture?id={fixtureId}
 *
 * Per-fixture World Cup OG card — 1200×630. Shows both flags + team
 * names + kickoff. Used as the OG image for /world-cup/fixtures/[id]
 * pages.
 *
 * Satori-friendly: width:1072 on every section div, no grid, no
 * marginTop:'auto', no flexGrow.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getFixtureById } from '@/lib/world-cup-data'

export const runtime = 'edge'
export const revalidate = 3600

function fmtKickoff(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
    }) + ' BST'
  } catch {
    return ''
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const idParam = searchParams.get('id')
  const id = idParam ? parseInt(idParam, 10) : NaN
  const data = Number.isFinite(id) ? await getFixtureById(id) : null

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 1072, height: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', color: fg }}>
              MATCH<span style={{ color: brand }}>MIND</span>
            </span>
            <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', marginTop: 3 }}>
              FIFA WORLD CUP 2026
            </span>
          </div>
          {data && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${brand}55`, padding: '8px 18px',
            }}>
              <span style={{ fontSize: 14, color: brand, fontWeight: 800, letterSpacing: '0.15em' }}>
                {data.group.name.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {data ? (
          <>
            {/* Home team — flag + name on one row */}
            <div style={{ display: 'flex', alignItems: 'center', width: 1072, height: 96, marginTop: 40 }}>
              {data.fixture.home.logo && (
                <img src={data.fixture.home.logo} alt="" width={80} height={80} style={{ marginRight: 28 }} />
              )}
              <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.03em', color: fg, lineHeight: 1 }}>
                {data.fixture.home.name}
              </span>
            </div>

            {/* vs separator */}
            <div style={{ display: 'flex', width: 1072, marginTop: 8 }}>
              <span style={{ fontSize: 18, color: fgMuted, fontWeight: 700, letterSpacing: '0.2em' }}>
                VS
              </span>
            </div>

            {/* Away team */}
            <div style={{ display: 'flex', alignItems: 'center', width: 1072, height: 96, marginTop: 8 }}>
              {data.fixture.away.logo && (
                <img src={data.fixture.away.logo} alt="" width={80} height={80} style={{ marginRight: 28 }} />
              )}
              <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.03em', color: fg, lineHeight: 1 }}>
                {data.fixture.away.name}
              </span>
            </div>

            {/* Kickoff + venue strip */}
            <div style={{
              display: 'flex', flexDirection: 'column', width: 1072, marginTop: 32,
              borderTop: `1px solid ${fgMuted}55`, padding: '18px 0',
            }}>
              <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em' }}>
                KICK-OFF · {data.fixture.round.toUpperCase()}
              </span>
              <span style={{ fontSize: 22, fontWeight: 700, color: fg, marginTop: 6 }}>
                {fmtKickoff(data.fixture.date)}
                {data.fixture.venue.name ? ` · ${data.fixture.venue.name}` : ''}
              </span>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', width: 1072, marginTop: 16 }}>
              <span style={{ fontSize: 16, color: fgMuted }}>
                matchmindcom.com · AI value-bet prediction logged before kick-off
              </span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', width: 1072, marginTop: 60 }}>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: fg }}>World Cup 2026</span>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: brand, marginTop: 4 }}>fixture predictions.</span>
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
