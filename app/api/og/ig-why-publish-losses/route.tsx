/**
 * GET /api/og/ig-why-publish-losses
 *
 * Evergreen educational IG card — "Why we publish every loss."
 * Trust-building post. Pulls live track-record numbers.
 */

import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const W = 1080, H = 1350, PADX = 64

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
  const { data } = await supabase
    .from('prediction_records')
    .select('result')
    .not('result', 'is', null)
    .eq('is_value_bet', true)
    .limit(2000)

  const rows = (data ?? []) as Array<{ result: 'win' | 'loss' | 'void' }>
  const wins = rows.filter(r => r.result === 'win').length
  const losses = rows.filter(r => r.result === 'loss').length
  const total = wins + losses
  const winRate = total ? Math.round((wins / total) * 100) : 0

  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62'
  const brand = '#F97316', success = '#10B981', loss = '#F43F5E'

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', background: bg, color: fg,
        position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
            MATCH<span style={{ color: brand }}>MIND</span>
          </span>
          <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
            ANTI-HYPE · TRANSPARENCY OVER POSTURING
          </span>
        </div>

        <div style={{ position: 'absolute', top: 165, left: PADX, width: 80, height: 4, background: brand, display: 'flex' }} />

        <div style={{ position: 'absolute', top: 195, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 92, fontWeight: 900, letterSpacing: '-0.04em', color: fg, lineHeight: 1 }}>
            Why we
          </span>
          <span style={{ fontSize: 92, fontWeight: 900, letterSpacing: '-0.04em', color: fg, lineHeight: 1, marginTop: 6 }}>
            publish
          </span>
          <span style={{ fontSize: 92, fontWeight: 900, letterSpacing: '-0.04em', color: brand, lineHeight: 1, marginTop: 6 }}>
            every loss.
          </span>
        </div>

        {/* Stats row */}
        <div style={{
          position: 'absolute', top: 600, left: PADX, width: W - PADX * 2,
          padding: '36px 40px', background: '#1A1D24', display: 'flex',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '50%' }}>
            <span style={{ fontSize: 13, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>WINS</span>
            <span style={{ fontSize: 96, fontWeight: 900, color: success, lineHeight: 1, marginTop: 8 }}>{wins}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', width: '50%' }}>
            <span style={{ fontSize: 13, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em' }}>LOSSES</span>
            <span style={{ fontSize: 96, fontWeight: 900, color: loss, lineHeight: 1, marginTop: 8 }}>{losses}</span>
          </div>
        </div>

        {/* Honest body copy */}
        <div style={{
          position: 'absolute', top: 850, left: PADX, width: W - PADX * 2,
          display: 'flex', flexDirection: 'column',
        }}>
          <span style={{ fontSize: 28, color: fg, lineHeight: 1.4, fontWeight: 500 }}>
            Every tipster shows the wins. We show the {losses}. Because a {winRate}% value-bet hit rate is the truth — not 70%, not "guaranteed", not edited.
          </span>
          <span style={{ fontSize: 22, color: fgMuted, marginTop: 24, lineHeight: 1.4 }}>
            Anything above 30-55% on +EV picks at odds 1.80-4.00 is profit. The maths is on the site.
          </span>
        </div>

        <div style={{ position: 'absolute', bottom: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 22, color: fg, fontWeight: 700 }}>matchmindcom.com/track-record</span>
          <span style={{ fontSize: 14, color: fgMuted, marginTop: 6 }}>
            Every pick logged before kick-off · every result public · 18+
          </span>
        </div>
      </div>
    ),
    { width: W, height: H },
  )
}
