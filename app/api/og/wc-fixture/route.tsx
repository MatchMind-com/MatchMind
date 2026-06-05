/**
 * GET /api/og/wc-fixture?id={fixtureId}
 *
 * Per-fixture WC OG card — 1200×630. Both flags + names + kickoff.
 *
 * IMPORTANT: uses position:'absolute' on every section instead of
 * flexbox stacking. Satori's column flex behaves unpredictably with
 * div children (4 previous attempts with width tricks all left some
 * section inline-flexed to the right). Absolute positioning is
 * documented in Vercel's own OG examples and is bulletproof.
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
  } catch { return '' }
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
  const W = 1200, H = 630
  const PADX = 64

  return new ImageResponse(
    (
      <div
        style={{
          width: W, height: H, display: 'flex',
          background: bg, color: fg, position: 'relative',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* ── Top brand mark ── */}
        <div style={{ position: 'absolute', top: 52, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', color: fg }}>
            MATCH<span style={{ color: brand }}>MIND</span>
          </span>
          <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', marginTop: 3 }}>
            FIFA WORLD CUP 2026
          </span>
        </div>

        {/* ── Group badge (top right) ── */}
        {data && (
          <div style={{
            position: 'absolute', top: 52, right: PADX,
            display: 'flex', alignItems: 'center',
            border: `1px solid ${brand}55`, padding: '8px 18px',
          }}>
            <span style={{ fontSize: 14, color: brand, fontWeight: 800, letterSpacing: '0.15em' }}>
              {data.group.name.toUpperCase()}
            </span>
          </div>
        )}

        {data ? (
          <>
            {/* ── Home row ── */}
            <div style={{ position: 'absolute', top: 170, left: PADX, display: 'flex', alignItems: 'center' }}>
              {data.fixture.home.logo && (
                <img src={data.fixture.home.logo} alt="" width={80} height={80} style={{ marginRight: 28 }} />
              )}
              <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.03em', color: fg, lineHeight: 1 }}>
                {data.fixture.home.name}
              </span>
            </div>

            {/* ── VS separator ── */}
            <div style={{ position: 'absolute', top: 272, left: PADX, display: 'flex' }}>
              <span style={{ fontSize: 18, color: fgMuted, fontWeight: 700, letterSpacing: '0.2em' }}>VS</span>
            </div>

            {/* ── Away row ── */}
            <div style={{ position: 'absolute', top: 304, left: PADX, display: 'flex', alignItems: 'center' }}>
              {data.fixture.away.logo && (
                <img src={data.fixture.away.logo} alt="" width={80} height={80} style={{ marginRight: 28 }} />
              )}
              <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.03em', color: fg, lineHeight: 1 }}>
                {data.fixture.away.name}
              </span>
            </div>

            {/* ── Kickoff strip ── */}
            <div style={{
              position: 'absolute', top: 432, left: PADX, width: W - PADX * 2,
              borderTop: `1px solid ${fgMuted}55`, paddingTop: 20,
              display: 'flex', flexDirection: 'column',
            }}>
              <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em' }}>
                KICK-OFF · {data.fixture.round.toUpperCase()}
              </span>
              <span style={{ fontSize: 22, fontWeight: 700, color: fg, marginTop: 6 }}>
                {fmtKickoff(data.fixture.date)}
                {data.fixture.venue.name ? ` · ${data.fixture.venue.name}` : ''}
              </span>
            </div>

            {/* ── Footer ── */}
            <div style={{ position: 'absolute', bottom: 52, left: PADX, display: 'flex' }}>
              <span style={{ fontSize: 16, color: fgMuted }}>
                matchmindcom.com · AI value-bet prediction logged before kick-off
              </span>
            </div>
          </>
        ) : (
          <div style={{ position: 'absolute', top: 180, left: PADX, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: fg }}>World Cup 2026</span>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: '-0.05em', color: brand, marginTop: 4 }}>fixture predictions.</span>
          </div>
        )}
      </div>
    ),
    { width: W, height: H },
  )
}
