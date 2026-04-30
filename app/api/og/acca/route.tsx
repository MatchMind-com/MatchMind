/**
 * GET /api/og/acca
 *
 * Vercel OG image route — renders a 1200x1200 square card showing
 * tonight's AI value acca, suitable for Instagram feed posts.
 *
 * Query params:
 *   ?legs=4           how many picks to combine (default 4)
 *   ?windowHours=18   how far ahead to look (default 18)
 *
 * Used by /api/admin/post-instagram which takes the rendered image URL
 * and pushes it to Instagram Graph API.
 *
 * Edge runtime — fast generation (<1s) and the image is cached on
 * Vercel CDN, so subsequent IG fetches are instant.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

interface Pick {
  id?: number
  home_team?: string
  away_team?: string
  league?: string
  leagueFlag?: string
  date?: string
  recommended_bet?: string
  recommended_odds_range?: string
  best_value?: { ev?: number; odds?: number; label?: string }
  value_score?: number
}

function parseOdds(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/[\d.]+/)
  if (!m) return null
  const n = parseFloat(m[0])
  return Number.isFinite(n) && n > 1 ? n : null
}

function legSummary(p: Pick): { label: string; odds: number; ev: number } | null {
  if (p.best_value?.label && p.best_value.odds && p.best_value.odds > 1) {
    return { label: p.best_value.label, odds: p.best_value.odds, ev: p.best_value.ev ?? 0 }
  }
  const o = parseOdds(p.recommended_odds_range)
  if (p.recommended_bet && o) return { label: p.recommended_bet, odds: o, ev: p.value_score ?? 0 }
  return null
}

function isInWindow(iso: string | undefined, hours: number): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  const now = Date.now()
  return t > now - 3 * 3_600_000 && t < now + hours * 3_600_000
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const legCount = Math.max(2, Math.min(8, parseInt(searchParams.get('legs') ?? '4', 10) || 4))
  const windowHours = Math.max(3, Math.min(72, parseInt(searchParams.get('windowHours') ?? '18', 10) || 18))

  let predictions: Pick[] = []
  try {
    const res = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
    const json = await res.json()
    predictions = Array.isArray(json?.predictions) ? json.predictions : []
  } catch {
    // Render an empty-state card below
  }

  const ranked = predictions
    .filter((p) => isInWindow(p.date, windowHours))
    .map((p) => ({ pick: p, sum: legSummary(p) }))
    .filter((x): x is { pick: Pick; sum: NonNullable<ReturnType<typeof legSummary>> } => x.sum !== null)
    .sort((a, b) => (b.sum.ev ?? 0) - (a.sum.ev ?? 0))

  // Dedupe by fixture id and cap to legCount
  const seen = new Set<number>()
  const legs: typeof ranked = []
  for (const r of ranked) {
    const id = r.pick.id ?? -1
    if (id !== -1 && seen.has(id)) continue
    if (id !== -1) seen.add(id)
    legs.push(r)
    if (legs.length >= legCount) break
  }

  const combinedOdds = legs.reduce((acc, l) => acc * l.sum.odds, 1)
  const stake = 10
  const payout = Math.round(combinedOdds * stake * 100) / 100

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0F1115',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '60px',
          color: '#F5F1E8',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 22, color: '#F97316', fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase' }}>
              MatchMind · AI value acca
            </span>
            <span style={{ fontSize: 56, fontWeight: 800, marginTop: 6, color: '#F5F1E8', lineHeight: 1 }}>
              Tonight&apos;s {legs.length}-fold
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              backgroundColor: '#1A1D24',
              border: '2px solid #F97316',
              borderRadius: 16,
              padding: '12px 20px',
            }}
          >
            <span style={{ fontSize: 16, color: '#9CA3AF', fontWeight: 600, letterSpacing: 2 }}>COMBINED</span>
            <span style={{ fontSize: 56, color: '#F97316', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {combinedOdds.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Legs */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 14 }}>
          {legs.length === 0 && (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 28 }}>
              No upcoming AI picks right now.
            </div>
          )}
          {legs.map((l, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#1A1D24',
                border: '1px solid #2A2F38',
                borderRadius: 12,
                padding: '18px 24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20, color: '#F97316', fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 30 }}>
                  {i + 1}.
                </span>
                <span style={{ fontSize: 26, fontWeight: 700, color: '#F5F1E8', flex: 1 }}>
                  {l.pick.home_team} v {l.pick.away_team}
                </span>
                <span style={{ fontSize: 28, color: '#F97316', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  @{l.sum.odds.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, marginLeft: 42 }}>
                <span style={{ fontSize: 18, color: '#9CA3AF' }}>{l.pick.league}</span>
                <span style={{ fontSize: 18, color: '#9CA3AF' }}>·</span>
                <span style={{ fontSize: 18, color: '#22C55E', fontWeight: 700 }}>
                  {l.sum.label}
                </span>
                {l.sum.ev > 0 && (
                  <>
                    <span style={{ fontSize: 18, color: '#9CA3AF' }}>·</span>
                    <span style={{ fontSize: 18, color: '#22C55E', fontWeight: 700 }}>+{l.sum.ev}% EV</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 30,
            paddingTop: 24,
            borderTop: '1px solid #2A2F38',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 16, color: '#9CA3AF', letterSpacing: 2, fontWeight: 600 }}>£10 RETURNS</span>
            <span style={{ fontSize: 38, color: '#22C55E', fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
              £{payout.toFixed(2)}
            </span>
          </div>
          <span style={{ fontSize: 22, color: '#F5F1E8', fontWeight: 700 }}>matchmindcom.com</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      headers: { 'Cache-Control': 'public, s-maxage=300, max-age=300' },
    },
  )
}
