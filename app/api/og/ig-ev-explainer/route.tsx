/**
 * GET /api/og/ig-ev-explainer?slide={1-4}
 *
 * 4-slide carousel explaining value bets — designed to be pinned to the
 * Instagram profile. Each slide is 1080×1350.
 *
 *   slide=1  Hook — "What's a value bet?" + visual
 *   slide=2  Maths — odds → implied → AI → edge
 *   slide=3  Live example — a real win from last 30 days
 *   slide=4  CTA — "Try it free → matchmindcom.com"
 *
 * Posting workflow: download all 4, upload as a single carousel post,
 * pin to profile.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const W = 1080, H = 1350, PADX = 64

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const COLORS = {
  bg: '#0F1115', fg: '#F5F1E8', fgMuted: '#6E6B62',
  brand: '#F97316', success: '#10B981', cyan: '#06B6D4',
  panel: '#1A1D24',
}

function Frame({ children, slide }: { children: React.ReactNode; slide: number }) {
  return (
    <div style={{
      width: W, height: H, display: 'flex', background: COLORS.bg, color: COLORS.fg,
      position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Corner gradient */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 720, height: 720,
        background: 'linear-gradient(225deg, rgba(249,115,22,0.12) 0%, rgba(15,17,21,0) 65%)',
        display: 'flex',
      }} />

      {/* Brand */}
      <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
          MATCH<span style={{ color: COLORS.brand }}>MIND</span>
        </span>
        <span style={{ fontSize: 12, color: COLORS.fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
          VALUE BETS · {slide} OF 4
        </span>
      </div>

      {/* Slide counter top-right (pip indicator) */}
      <div style={{ position: 'absolute', top: 70, right: PADX, display: 'flex' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            width: 32, height: 4, marginLeft: i > 1 ? 6 : 0,
            background: i === slide ? COLORS.brand : '#2A2D34',
            display: 'flex',
          }} />
        ))}
      </div>

      <div style={{ position: 'absolute', top: 165, left: PADX, width: 80, height: 4, background: COLORS.brand, display: 'flex' }} />

      {children}

      {/* Footer: swipe prompt + matchmindcom */}
      <div style={{
        position: 'absolute', bottom: 56, left: PADX, right: PADX,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 22, color: COLORS.fg, fontWeight: 700 }}>matchmindcom.com</span>
          <span style={{ fontSize: 14, color: COLORS.fgMuted, marginTop: 6 }}>
            500+ picks tracked · 18+ BeGambleAware
          </span>
        </div>
        {slide < 4 && (
          <span style={{ fontSize: 16, color: COLORS.brand, fontWeight: 700, letterSpacing: '0.15em' }}>
            SWIPE →
          </span>
        )}
      </div>
    </div>
  )
}

// ── Slide 1: hook ─────────────────────────────────────────────────────
function Slide1() {
  // Worked example: bookie 50% vs AI 55% — visualised as overlapping bars.
  // Showing > telling.
  const barW = W - PADX * 2  // 952
  const bookiePct = 50
  const aiPct = 55
  const bookieW = Math.round((bookiePct / 100) * barW)
  const aiW = Math.round((aiPct / 100) * barW)

  return (
    <Frame slide={1}>
      {/* Headline */}
      <div style={{ position: 'absolute', top: 195, left: PADX, width: W - PADX * 2, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 82, fontWeight: 900, letterSpacing: '-0.04em', color: COLORS.fg, lineHeight: 1 }}>
          What&apos;s a
        </span>
        <span style={{ fontSize: 82, fontWeight: 900, letterSpacing: '-0.04em', color: COLORS.brand, lineHeight: 1, marginTop: 6 }}>
          value bet?
        </span>
      </div>

      {/* Worked example label */}
      <div style={{ position: 'absolute', top: 410, left: PADX, display: 'flex' }}>
        <span style={{ fontSize: 14, color: COLORS.fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
          EXAMPLE · ODDS OF 2.00
        </span>
      </div>

      {/* Bookie row */}
      <div style={{ position: 'absolute', top: 450, left: PADX, width: W - PADX * 2, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 22, color: COLORS.fg, fontWeight: 700 }}>Bookie says</span>
        <span style={{ fontSize: 22, color: COLORS.fg, fontWeight: 700 }}>{bookiePct}%</span>
      </div>
      <div style={{
        position: 'absolute', top: 488, left: PADX,
        width: bookieW, height: 28, background: '#3A3D44', display: 'flex',
      }} />

      {/* AI row */}
      <div style={{ position: 'absolute', top: 560, left: PADX, width: W - PADX * 2, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 22, color: COLORS.brand, fontWeight: 700 }}>AI says</span>
        <span style={{ fontSize: 22, color: COLORS.brand, fontWeight: 700 }}>{aiPct}%</span>
      </div>
      <div style={{
        position: 'absolute', top: 598, left: PADX,
        width: aiW, height: 28, background: COLORS.brand, display: 'flex',
      }} />

      {/* Gap callout — the visual punchline */}
      <div style={{
        position: 'absolute', top: 690, left: PADX, width: W - PADX * 2,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          width: 16, height: 16, background: COLORS.success, marginRight: 16, display: 'flex',
        }} />
        <span style={{ fontSize: 26, color: COLORS.success, fontWeight: 800, letterSpacing: '-0.01em' }}>
          That 5-point gap = your EDGE
        </span>
      </div>

      {/* Plain-English rule block */}
      <div style={{
        position: 'absolute', top: 800, left: PADX, width: W - PADX * 2,
        padding: '32px 36px', background: COLORS.panel,
        display: 'flex', flexDirection: 'column',
        borderLeft: `4px solid ${COLORS.success}`,
      }}>
        <span style={{ fontSize: 14, color: COLORS.fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
          THE RULE
        </span>
        <span style={{ fontSize: 32, color: COLORS.fg, fontWeight: 800, marginTop: 14, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
          When AI thinks it&apos;s more likely than the bookie does,
        </span>
        <span style={{ fontSize: 32, color: COLORS.success, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
          that gap is profit over time.
        </span>
        <span style={{ fontSize: 18, color: COLORS.fgMuted, marginTop: 18 }}>
          Long-run profit, not guaranteed wins. (Swipe for the maths.)
        </span>
      </div>
    </Frame>
  )
}

// ── Slide 2: the math ─────────────────────────────────────────────────
function Slide2() {
  const steps = [
    { n: 1, h: 'Odds 2.00 = bookmaker says 50%', s: '1 ÷ 2.00 = 0.50. Their implied probability.', color: COLORS.fg },
    { n: 2, h: "AI says it's actually 55%", s: 'Built from form, lineups, head-to-head, ref tendencies.', color: COLORS.fg },
    { n: 3, h: 'Edge: 55% × 2.00 − 1 = +10%', s: 'Bet £10 → expected value £1. That\'s a +EV bet.', color: COLORS.success },
  ]

  return (
    <Frame slide={2}>
      <div style={{ position: 'absolute', top: 195, left: PADX, width: W - PADX * 2, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 88, fontWeight: 900, letterSpacing: '-0.04em', color: COLORS.fg, lineHeight: 1 }}>
          The maths,
        </span>
        <span style={{ fontSize: 88, fontWeight: 900, letterSpacing: '-0.04em', color: COLORS.brand, lineHeight: 1, marginTop: 6 }}>
          in 30 seconds.
        </span>
      </div>

      {steps.map((s, i) => (
        <div key={s.n} style={{
          position: 'absolute', top: 470 + i * 200, left: PADX, width: W - PADX * 2,
          display: 'flex', alignItems: 'flex-start',
        }}>
          <span style={{
            fontSize: 80, fontWeight: 900, color: s.color, lineHeight: 1, width: 80, letterSpacing: '-0.04em',
          }}>{s.n}</span>
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 32, width: W - PADX * 2 - 112 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: s.color, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              {s.h}
            </span>
            <span style={{ fontSize: 22, color: COLORS.fgMuted, marginTop: 10 }}>
              {s.s}
            </span>
          </div>
        </div>
      ))}
    </Frame>
  )
}

// ── Slide 3: live example ─────────────────────────────────────────────
async function Slide3() {
  const sinceISO = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data } = await supabase
    .from('prediction_records')
    .select('home_team, away_team, bet_type, odds, ev_percent')
    .eq('is_value_bet', true)
    .eq('result', 'win')
    .gt('ev_percent', 0)
    .lte('ev_percent', 10)
    .gte('kick_off', sinceISO)
    .order('ev_percent', { ascending: false })
    .limit(1)

  const win = (data ?? [])[0]
  const fmtBet = (s?: string) => (s ?? '').replace(/_/g, ' ').trim()

  return (
    <Frame slide={3}>
      <div style={{ position: 'absolute', top: 195, left: PADX, width: W - PADX * 2, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 88, fontWeight: 900, letterSpacing: '-0.04em', color: COLORS.fg, lineHeight: 1 }}>
          A real
        </span>
        <span style={{ fontSize: 88, fontWeight: 900, letterSpacing: '-0.04em', color: COLORS.brand, lineHeight: 1, marginTop: 6 }}>
          example.
        </span>
        <span style={{ fontSize: 22, color: COLORS.fgMuted, marginTop: 24, fontWeight: 500 }}>
          Best AI edge that cashed in the last 30 days
        </span>
      </div>

      {win ? (
        <div style={{
          position: 'absolute', top: 540, left: PADX, width: W - PADX * 2,
          padding: '36px 40px', background: COLORS.panel, display: 'flex', flexDirection: 'column',
          borderLeft: `4px solid ${COLORS.success}`,
        }}>
          <span style={{ fontSize: 14, color: COLORS.fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>
            WIN
          </span>
          <span style={{ fontSize: 42, fontWeight: 900, color: COLORS.fg, marginTop: 14, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {win.home_team} v {win.away_team}
          </span>
          <span style={{ fontSize: 24, color: COLORS.fgMuted, marginTop: 12 }}>
            {fmtBet(win.bet_type)}
          </span>
          <div style={{ display: 'flex', marginTop: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: '50%' }}>
              <span style={{ fontSize: 13, color: COLORS.fgMuted, fontWeight: 700, letterSpacing: '0.15em' }}>ODDS</span>
              <span style={{ fontSize: 64, fontWeight: 900, color: COLORS.brand, lineHeight: 1, marginTop: 8 }}>
                {win.odds?.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', width: '50%' }}>
              <span style={{ fontSize: 13, color: COLORS.fgMuted, fontWeight: 700, letterSpacing: '0.15em' }}>EDGE</span>
              <span style={{ fontSize: 64, fontWeight: 900, color: COLORS.success, lineHeight: 1, marginTop: 8 }}>
                +{(win.ev_percent ?? 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ position: 'absolute', top: 540, left: PADX, display: 'flex' }}>
          <span style={{ fontSize: 28, color: COLORS.fgMuted }}>(No wins logged yet.)</span>
        </div>
      )}

      <div style={{ position: 'absolute', top: 1020, left: PADX, width: W - PADX * 2, display: 'flex' }}>
        <span style={{ fontSize: 22, color: COLORS.fgMuted, fontWeight: 500, lineHeight: 1.4 }}>
          Every pick logged 24h before kick-off. Every result public, win or lose.
        </span>
      </div>
    </Frame>
  )
}

// ── Slide 4: CTA ──────────────────────────────────────────────────────
function Slide4() {
  return (
    <Frame slide={4}>
      <div style={{ position: 'absolute', top: 195, left: PADX, width: W - PADX * 2, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 100, fontWeight: 900, letterSpacing: '-0.04em', color: COLORS.fg, lineHeight: 1 }}>
          Want the
        </span>
        <span style={{ fontSize: 100, fontWeight: 900, letterSpacing: '-0.04em', color: COLORS.fg, lineHeight: 1, marginTop: 6 }}>
          edge?
        </span>
      </div>

      <div style={{
        position: 'absolute', top: 580, left: PADX, width: W - PADX * 2,
        display: 'flex', flexDirection: 'column',
      }}>
        {[
          'AI scans 25 leagues',
          'Logs every pick before kick-off',
          'Free tier — 3 picks a day',
          'Every result public on site',
        ].map((line, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            <span style={{
              fontSize: 26, color: COLORS.brand, fontWeight: 900, width: 40,
              letterSpacing: '-0.02em',
            }}>→</span>
            <span style={{ fontSize: 36, color: COLORS.fg, fontWeight: 700, marginLeft: 16 }}>
              {line}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        position: 'absolute', top: 1000, left: PADX, width: W - PADX * 2,
        padding: '28px 36px', background: COLORS.brand, display: 'flex', flexDirection: 'column',
      }}>
        <span style={{ fontSize: 18, color: '#0F1115', fontWeight: 800, letterSpacing: '0.18em' }}>
          FREE — NO CARD
        </span>
        <span style={{ fontSize: 44, fontWeight: 900, color: '#0F1115', marginTop: 8, letterSpacing: '-0.03em' }}>
          matchmindcom.com
        </span>
      </div>
    </Frame>
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const n = Math.max(1, Math.min(4, parseInt(searchParams.get('slide') ?? '1', 10) || 1))

  let node: React.ReactNode
  if (n === 1) node = Slide1()
  else if (n === 2) node = Slide2()
  else if (n === 3) node = await Slide3()
  else node = Slide4()

  return new ImageResponse(node, { width: W, height: H })
}
