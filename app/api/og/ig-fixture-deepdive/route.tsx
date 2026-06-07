/**
 * GET /api/og/ig-fixture-deepdive?id={fixtureId}
 *
 * Statengine-style match preview infographic — 1080×1350.
 * Pulls both teams' last-5 form + AI pick + kick-off.
 * Designed for the manual deep-dive posts on Fri/Sun before big matches.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getFixtureById, getTeamEnrichment } from '@/lib/world-cup-data'

export const runtime = 'edge'
export const revalidate = 3600

const W = 1080, H = 1350, PADX = 64

function fmtKickoff(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
    }) + ' BST'
  } catch { return '' }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const idParam = searchParams.get('id')
  const id = idParam ? parseInt(idParam, 10) : NaN
  const data = Number.isFinite(id) ? await getFixtureById(id) : null

  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62'
  const brand = '#F97316', success = '#10B981', loss = '#F43F5E'

  if (!data) {
    return new ImageResponse(
      (
        <div style={{ width: W, height: H, display: 'flex', background: bg, color: fg, padding: PADX,
          fontFamily: 'Inter, system-ui, sans-serif' }}>
          <span style={{ fontSize: 60 }}>Fixture not found.</span>
        </div>
      ),
      { width: W, height: H },
    )
  }

  // Pull form for both teams (each fails soft)
  const [homeEnr, awayEnr] = await Promise.all([
    getTeamEnrichment(data.fixture.home.id).catch(() => null),
    getTeamEnrichment(data.fixture.away.id).catch(() => null),
  ])

  const homeForm = (homeEnr?.form ?? []).map(f => f.result)
  const awayForm = (awayEnr?.form ?? []).map(f => f.result)

  function FormPills({ form }: { form: string[] }) {
    if (form.length === 0) return null
    return (
      <div style={{ display: 'flex' }}>
        {form.map((r, i) => {
          const color = r === 'W' ? success : r === 'L' ? loss : fgMuted
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, marginRight: 8,
              border: `1.5px solid ${color}`,
            }}>
              <span style={{ fontSize: 22, fontWeight: 900, color }}>{r}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', background: bg, color: fg,
        position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {/* Brand top-left */}
        <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
            MATCH<span style={{ color: brand }}>MIND</span>
          </span>
          <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
            MATCH PREVIEW · {data.group.name.toUpperCase()}
          </span>
        </div>

        {/* Kickoff badge top-right */}
        <div style={{
          position: 'absolute', top: 56, right: PADX, display: 'flex',
          border: `1px solid ${brand}55`, padding: '8px 16px',
        }}>
          <span style={{ fontSize: 13, color: brand, fontWeight: 800, letterSpacing: '0.15em' }}>
            {fmtKickoff(data.fixture.date)}
          </span>
        </div>

        {/* Accent line */}
        <div style={{ position: 'absolute', top: 165, left: PADX, width: 80, height: 4, background: brand, display: 'flex' }} />

        {/* Home team */}
        <div style={{ position: 'absolute', top: 200, left: PADX, display: 'flex', alignItems: 'center' }}>
          {data.fixture.home.logo && (
            <img src={data.fixture.home.logo} alt="" width={64} height={64} style={{ marginRight: 24 }} />
          )}
          <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.03em', color: fg, lineHeight: 1 }}>
            {data.fixture.home.name}
          </span>
        </div>

        {/* VS */}
        <div style={{ position: 'absolute', top: 296, left: PADX, display: 'flex' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: fgMuted, letterSpacing: '0.25em' }}>VS</span>
        </div>

        {/* Away team */}
        <div style={{ position: 'absolute', top: 330, left: PADX, display: 'flex', alignItems: 'center' }}>
          {data.fixture.away.logo && (
            <img src={data.fixture.away.logo} alt="" width={64} height={64} style={{ marginRight: 24 }} />
          )}
          <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.03em', color: fg, lineHeight: 1 }}>
            {data.fixture.away.name}
          </span>
        </div>

        {/* Form section header */}
        <div style={{
          position: 'absolute', top: 470, left: PADX, width: W - PADX * 2,
          borderTop: `1px solid ${fgMuted}55`, paddingTop: 24, display: 'flex',
        }}>
          <span style={{ fontSize: 14, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
            FORM · LAST 5
          </span>
        </div>

        {/* Home form row */}
        <div style={{ position: 'absolute', top: 540, left: PADX, width: W - PADX * 2, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: fg, width: 280 }}>
            {data.fixture.home.name}
          </span>
          <FormPills form={homeForm} />
        </div>

        {/* Away form row */}
        <div style={{ position: 'absolute', top: 620, left: PADX, width: W - PADX * 2, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: fg, width: 280 }}>
            {data.fixture.away.name}
          </span>
          <FormPills form={awayForm} />
        </div>

        {/* Venue */}
        <div style={{
          position: 'absolute', top: 740, left: PADX, width: W - PADX * 2,
          borderTop: `1px solid ${fgMuted}55`, paddingTop: 24, display: 'flex', flexDirection: 'column',
        }}>
          <span style={{ fontSize: 14, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>VENUE</span>
          <span style={{ fontSize: 30, fontWeight: 700, color: fg, marginTop: 8 }}>
            {data.fixture.venue.name ?? 'TBA'}{data.fixture.venue.city ? `, ${data.fixture.venue.city}` : ''}
          </span>
        </div>

        {/* AI angle CTA strip */}
        <div style={{
          position: 'absolute', top: 920, left: PADX, width: W - PADX * 2,
          padding: '32px 36px', background: '#1A1D24', display: 'flex', flexDirection: 'column',
        }}>
          <span style={{ fontSize: 14, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
            AI VALUE PICK
          </span>
          <span style={{ fontSize: 36, fontWeight: 900, color: brand, marginTop: 12, letterSpacing: '-0.02em' }}>
            Logs 24h before kick-off →
          </span>
          <span style={{ fontSize: 18, color: fgMuted, marginTop: 12 }}>
            matchmindcom.com/world-cup/fixtures/{data.fixture.id}
          </span>
        </div>

        <div style={{ position: 'absolute', bottom: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 22, color: fg, fontWeight: 700 }}>matchmindcom.com</span>
          <span style={{ fontSize: 14, color: fgMuted, marginTop: 6 }}>
            Every pick logged before kick-off · every result public · 18+
          </span>
        </div>
      </div>
    ),
    { width: W, height: H },
  )
}
