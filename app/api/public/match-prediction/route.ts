import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { rateLimit, getClientKey, rateLimitResponse } from '@/lib/rate-limit'

export const revalidate = 300

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(str: string) {
  return str.toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

function makeSlug(home: string, away: string, kickOff: string) {
  const date = new Date(kickOff)
  const day = date.getDate()
  const month = date.toLocaleString('en-US', { month: 'long' }).toLowerCase()
  const year = date.getFullYear()
  return `${slugify(home)}-vs-${slugify(away)}-${day}-${month}-${year}`
}

export async function GET(request: Request) {
  const rl = rateLimit(`match-prediction:${getClientKey(request)}`, 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.resetMs)

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  try {
    const from = new Date()
    from.setDate(from.getDate() - 7)
    const to = new Date()
    to.setDate(to.getDate() + 7)

    const { data, error } = await supabaseAdmin
      .from('prediction_records')
      .select('id, home_team, away_team, league, kick_off, bet_type, prediction, ai_probability, odds, ev_percent, is_value_bet, result, home_score, away_score')
      .gte('kick_off', from.toISOString())
      .lte('kick_off', to.toISOString())
      .lte('ev_percent', 10)   // MAX_REAL_EV — kill stale +20% rows
      .lte('odds', 4.0)
      .order('ev_percent', { ascending: false })

    if (error) throw error

    const matching = (data || []).filter(r => makeSlug(r.home_team, r.away_team, r.kick_off) === slug)

    if (matching.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const first = matching[0]
    return NextResponse.json({
      success: true,
      match: {
        home_team: first.home_team,
        away_team: first.away_team,
        league: first.league,
        kick_off: first.kick_off,
        slug,
      },
      picks: matching.map(r => ({
        id: r.id,
        bet_type: r.bet_type,
        prediction: r.prediction,
        ai_probability: r.ai_probability,
        odds: r.odds,
        ev_percent: r.ev_percent,
        is_value_bet: r.is_value_bet,
        result: r.result,
        home_score: r.home_score,
        away_score: r.away_score,
      })),
    })
  } catch (err) {
    console.error('Match prediction error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
