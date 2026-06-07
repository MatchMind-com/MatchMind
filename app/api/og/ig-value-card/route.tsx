/**
 * GET /api/og/ig-value-card?fixture={fixtureId}
 *
 * Instagram-format value-bet card — 1080×1350 (4:5 portrait).
 * Posted daily via post-instagram cron OR shared manually.
 *
 * Pulls the pick from /api/predictions (live cron cache). Designed to
 * read at thumbnail size on a grid (big numbers, single matchup line).
 *
 * Absolute-positioning layout (Satori-friendly).
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const idParam = searchParams.get('fixture') ?? searchParams.get('id')
  const id = idParam ? parseInt(idParam, 10) : NaN

  let pick: Prediction | null = null
  try {
    const res = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
    const json = await res.json()
    const preds = Array.isArray(json?.predictions) ? (json.predictions as Prediction[]) : []
    // If no specific fixture requested, surface today's best value bet
    if (Number.isFinite(id)) {
      pick = preds.find(p => p.id === id) ?? null
    } else {
      pick = preds
        .filter(p => p.is_value_bet && (p.best_value?.ev ?? 0) > 0)
        .sort((a, b) => (b.best_value?.ev ?? 0) - (a.best_value?.ev ?? 0))[0] ?? null
    }
  } catch {}

  const label = pick?.best_value?.label ?? null
  const odds = pick?.best_value?.odds ?? null
  const ev = pick?.best_value?.ev ?? null

  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62'
  const brand = '#F97316', success = '#10B981'

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
            {/* League */}
            <div style={{ position: 'absolute', top: 195, left: PADX, display: 'flex' }}>
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

            {/* AI PICK block — big surface area */}
            <div style={{
              position: 'absolute', top: 680, left: PADX, width: W - PADX * 2,
              borderTop: `1px solid ${fgMuted}55`, paddingTop: 36,
              display: 'flex', flexDirection: 'column',
            }}>
              <span style={{ fontSize: 14, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
                AI PICK
              </span>
              <span style={{ fontSize: 56, fontWeight: 900, marginTop: 14, letterSpacing: '-0.03em', color: fg }}>
                {label}
              </span>
            </div>

            {/* Odds + EV row at bottom */}
            <div style={{
              position: 'absolute', top: 920, left: PADX, width: W - PADX * 2,
              display: 'flex',
            }}>
              {/* Odds box */}
              <div style={{
                display: 'flex', flexDirection: 'column', width: (W - PADX * 2) / 2 - 16,
                padding: '28px 32px', background: '#1A1D24', marginRight: 16,
              }}>
                <span style={{ fontSize: 13, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
                  ODDS
                </span>
                <span style={{ fontSize: 96, fontWeight: 900, color: brand, marginTop: 10, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {odds.toFixed(2)}
                </span>
              </div>
              {/* EV box */}
              <div style={{
                display: 'flex', flexDirection: 'column', width: (W - PADX * 2) / 2 - 16,
                padding: '28px 32px', background: '#1A1D24',
              }}>
                <span style={{ fontSize: 13, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
                  AI EDGE
                </span>
                <span style={{ fontSize: 96, fontWeight: 900, color: success, marginTop: 10, letterSpacing: '-0.03em', lineHeight: 1 }}>
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
