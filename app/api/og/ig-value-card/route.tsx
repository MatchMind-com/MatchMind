/**
 * GET /api/og/ig-value-card?fixture={fixtureId}&internationals=0
 *
 * Instagram-format value-bet card — 1080×1350 (4:5 portrait).
 * Posted daily via post-instagram cron OR shared manually.
 *
 * INTERNATIONAL-FIRST by default. Filters predictions to national-team
 * competitions only (WC, qualifiers, friendlies, Nations League, AFCON,
 * Copa America, etc). Override with ?internationals=0 to allow clubs.
 *
 * Visual polish pass:
 *   - Subtle corner gradient overlay
 *   - Implied (bookie) vs AI probability comparison bar
 *   - League flag prominent
 *   - Magazine-style mixed typography
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'
const W = 1080, H = 1350, PADX = 64

interface Prediction {
  id: number
  home_team: string
  away_team: string
  league: string
  date?: string
  best_value?: { ev?: number; odds?: number; label?: string }
  recommended_bet?: string
  is_value_bet?: boolean
  leagueFlag?: string
}

function fmtKickoff(iso: string | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
    }) + ' BST'
  } catch { return '' }
}

/**
 * National-team / international competitions only.
 * Allow list of substrings — explicit exclude for FIFA Club World Cup.
 */
function isInternational(league: string): boolean {
  const l = league.toLowerCase()
  if (l.includes('club world cup')) return false
  if (l.includes('uefa champions') || l.includes('europa') || l.includes('conference league')) return false
  return (
    l.includes('world cup') ||
    l.includes('friendlies (intl)') ||
    l.includes('international friend') ||
    l.includes('nations league') ||
    /\bqualif/.test(l) ||
    /afcon|africa cup of nations/.test(l) ||
    /\beuro\b/.test(l) ||
    l.includes('copa america') ||
    l.includes('gold cup') ||
    l.includes('asian cup') ||
    l.includes('concacaf nations') ||
    l.includes('conmebol')
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const idParam = searchParams.get('fixture') ?? searchParams.get('id')
  const id = idParam ? parseInt(idParam, 10) : NaN
  const internationalsOnly = searchParams.get('internationals') !== '0'

  let pick: Prediction | null = null
  try {
    const res = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
    const json = await res.json()
    const preds = Array.isArray(json?.predictions) ? (json.predictions as Prediction[]) : []
    if (Number.isFinite(id)) {
      pick = preds.find(p => p.id === id) ?? null
    } else {
      const pool = preds
        .filter(p => p.is_value_bet && (p.best_value?.ev ?? 0) > 0)
        .filter(p => internationalsOnly ? isInternational(p.league) : true)
        .sort((a, b) => (b.best_value?.ev ?? 0) - (a.best_value?.ev ?? 0))
      pick = pool[0] ?? null
      // Fallback: if internationals-only returned nothing, allow all leagues
      if (!pick && internationalsOnly) {
        pick = preds
          .filter(p => p.is_value_bet && (p.best_value?.ev ?? 0) > 0)
          .sort((a, b) => (b.best_value?.ev ?? 0) - (a.best_value?.ev ?? 0))[0] ?? null
      }
    }
  } catch {}

  const label = pick?.best_value?.label ?? null
  const odds = pick?.best_value?.odds ?? null
  const ev = pick?.best_value?.ev ?? null

  // Derive bookmaker implied % and AI estimated %
  const impliedPct = odds && odds > 1 ? (100 / odds) : null
  const aiPct = impliedPct !== null && ev !== null
    ? Math.min(100, impliedPct * (1 + ev / 100))
    : null

  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62'
  const brand = '#F97316', success = '#10B981'
  const barBg = '#1A1D24'

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', background: bg, color: fg,
        position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {/* Corner gradient — adds depth without cost */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 720, height: 720,
          background: 'linear-gradient(225deg, rgba(249,115,22,0.12) 0%, rgba(15,17,21,0) 65%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: 600, height: 600,
          background: 'linear-gradient(45deg, rgba(16,185,129,0.06) 0%, rgba(15,17,21,0) 65%)',
          display: 'flex',
        }} />

        {/* Brand top-left */}
        <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
            MATCH<span style={{ color: brand }}>MIND</span>
          </span>
          <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
            AI VALUE BET · LOGGED BEFORE KICK-OFF
          </span>
        </div>

        {/* Date badge top-right */}
        {pick?.date && (
          <div style={{
            position: 'absolute', top: 56, right: PADX, display: 'flex',
            border: `1px solid ${brand}55`, padding: '8px 16px',
          }}>
            <span style={{ fontSize: 13, color: brand, fontWeight: 800, letterSpacing: '0.15em' }}>
              {new Date(pick.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()}
            </span>
          </div>
        )}

        {/* Diagonal orange accent line */}
        <div style={{
          position: 'absolute', top: 165, left: PADX, width: 80, height: 4,
          background: brand, display: 'flex',
        }} />

        {pick && label && odds ? (
          <>
            {/* League row — leagueFlag from /api/predictions is an emoji
                string (e.g. "🌍"), NOT a URL. Render as text only when it
                looks like a URL; otherwise skip (Satori can't load emoji
                as <img src>). */}
            <div style={{ position: 'absolute', top: 195, left: PADX, display: 'flex', alignItems: 'center' }}>
              {pick.leagueFlag && pick.leagueFlag.startsWith('http') && (
                <img
                  src={pick.leagueFlag}
                  alt=""
                  width={28}
                  height={20}
                  style={{ marginRight: 12, objectFit: 'cover' }}
                />
              )}
              <span style={{ fontSize: 18, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em' }}>
                {pick.league.toUpperCase()}
              </span>
            </div>

            {/* Big matchup */}
            <div style={{ position: 'absolute', top: 250, left: PADX, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 80, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: fg }}>
                {pick.home_team}
              </span>
              <span style={{ fontSize: 24, color: fgMuted, fontWeight: 700, letterSpacing: '0.2em', marginTop: 12 }}>
                VS
              </span>
              <span style={{ fontSize: 80, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: fg, marginTop: 12 }}>
                {pick.away_team}
              </span>
            </div>

            {/* Kickoff time */}
            {pick.date && (
              <div style={{ position: 'absolute', top: 600, left: PADX, display: 'flex' }}>
                <span style={{ fontSize: 18, color: fgMuted }}>
                  {fmtKickoff(pick.date)}
                </span>
              </div>
            )}

            {/* AI PICK row */}
            <div style={{
              position: 'absolute', top: 670, left: PADX, width: W - PADX * 2,
              borderTop: `1px solid ${fgMuted}55`, paddingTop: 28,
              display: 'flex', flexDirection: 'column',
            }}>
              <span style={{ fontSize: 14, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
                AI PICK
              </span>
              <span style={{ fontSize: 50, fontWeight: 900, marginTop: 10, letterSpacing: '-0.03em', color: fg }}>
                {label}
              </span>
            </div>

            {/* Probability comparison bar — bookie vs AI (absolute px widths for Satori) */}
            {impliedPct !== null && aiPct !== null && (() => {
              const barW = W - PADX * 2
              const impW = Math.round((impliedPct / 100) * barW)
              const edgeW = Math.max(0, Math.round(((aiPct - impliedPct) / 100) * barW))
              return (
                <>
                  <div style={{ position: 'absolute', top: 850, left: PADX, display: 'flex' }}>
                    <span style={{ fontSize: 13, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em' }}>
                      BOOKIE SAYS
                    </span>
                  </div>
                  <div style={{ position: 'absolute', top: 850, right: PADX, display: 'flex' }}>
                    <span style={{ fontSize: 13, color: brand, fontWeight: 700, letterSpacing: '0.15em' }}>
                      AI SAYS
                    </span>
                  </div>
                  {/* Implied bar */}
                  <div style={{
                    position: 'absolute', top: 880, left: PADX,
                    width: impW, height: 32, background: '#3A3D44',
                    display: 'flex', alignItems: 'center', paddingLeft: 12,
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: fg }}>
                      {impliedPct.toFixed(0)}%
                    </span>
                  </div>
                  {/* Edge bar */}
                  {edgeW > 0 && (
                    <div style={{
                      position: 'absolute', top: 880, left: PADX + impW,
                      width: edgeW, height: 32, background: brand,
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12,
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#0F1115' }}>
                        {aiPct.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </>
              )
            })()}

            {/* Odds + EV row at bottom */}
            <div style={{
              position: 'absolute', top: 970, left: PADX, width: W - PADX * 2,
              display: 'flex',
            }}>
              {/* Odds box */}
              <div style={{
                display: 'flex', flexDirection: 'column', width: (W - PADX * 2) / 2 - 16,
                padding: '24px 32px', background: barBg, marginRight: 16,
              }}>
                <span style={{ fontSize: 13, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
                  ODDS
                </span>
                <span style={{ fontSize: 80, fontWeight: 900, color: brand, marginTop: 8, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {odds.toFixed(2)}
                </span>
              </div>
              {/* EV box */}
              <div style={{
                display: 'flex', flexDirection: 'column', width: (W - PADX * 2) / 2 - 16,
                padding: '24px 32px', background: barBg,
              }}>
                <span style={{ fontSize: 13, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
                  AI EDGE
                </span>
                <span style={{ fontSize: 80, fontWeight: 900, color: success, marginTop: 8, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  +{ev ?? 0}%
                </span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ position: 'absolute', bottom: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 22, color: fg, fontWeight: 700 }}>
                matchmindcom.com
              </span>
              <span style={{ fontSize: 14, color: fgMuted, marginTop: 6 }}>
                Every pick logged before kick-off · every result public · 18+
              </span>
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{ position: 'absolute', top: 280, left: PADX, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 120, fontWeight: 900, letterSpacing: '-0.05em', color: fg, lineHeight: 1 }}>Find</span>
            <span style={{ fontSize: 120, fontWeight: 900, letterSpacing: '-0.05em', color: fg, lineHeight: 1, marginTop: 8 }}>the</span>
            <span style={{ fontSize: 120, fontWeight: 900, letterSpacing: '-0.05em', color: brand, lineHeight: 1, marginTop: 8 }}>edge.</span>
            <span style={{ fontSize: 24, color: fgMuted, marginTop: 36 }}>
              AI value bets across 25 leagues · matchmindcom.com
            </span>
          </div>
        )}
      </div>
    ),
    { width: W, height: H },
  )
}
