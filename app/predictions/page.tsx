import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient as createAdmin } from '@supabase/supabase-js'
import PublicFooter from '@/components/layout/PublicFooter'

export const metadata: Metadata = {
  title: "Today's AI Football Predictions — Free Match Tips | MatchMind",
  description: "Free AI-generated football match predictions with EV analysis. MatchMind analyses 25 leagues daily — see today's picks before kickoff.",
  openGraph: {
    title: "Today's AI Football Predictions — MatchMind",
    description: "AI-powered match predictions across Premier League, La Liga, Champions League and more. Free, updated daily.",
  },
}

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

async function getPredictions() {
  try {
    const from = new Date()
    from.setDate(from.getDate() - 1)
    const to = new Date()
    to.setDate(to.getDate() + 4)

    const { data } = await supabaseAdmin
      .from('prediction_records')
      .select('id, home_team, away_team, league, kick_off, bet_type, odds, ev_percent, is_value_bet, result')
      .gte('kick_off', from.toISOString())
      .lte('kick_off', to.toISOString())
      .lte('ev_percent', 25)
      .lte('odds', 4.0)
      .order('kick_off', { ascending: true })

    const fixtures: Record<string, NonNullable<typeof data>[number]> = {}
    for (const row of (data || [])) {
      const key = `${row.home_team}|${row.away_team}|${row.kick_off?.slice(0, 10)}`
      if (!fixtures[key] || (row.ev_percent ?? 0) > (fixtures[key].ev_percent ?? 0)) {
        fixtures[key] = row
      }
    }
    return Object.values(fixtures)
  } catch {
    return []
  }
}

const NAV_STYLE = {
  position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 50,
  borderBottom: '1px solid #1A1A22',
  background: 'rgba(9,9,12,0.97)', backdropFilter: 'blur(8px)',
}

export default async function PredictionsIndexPage() {
  const matches = await getPredictions()

  const today = new Date().toDateString()
  const todayMatches = matches.filter(m => m.kick_off && new Date(m.kick_off).toDateString() === today)
  const upcomingMatches = matches.filter(m => m.kick_off && new Date(m.kick_off).toDateString() !== today)

  return (
    <div className="min-h-screen" style={{ background: '#09090C', color: '#EDE9DF' }}>

      {/* Nav */}
      <nav style={NAV_STYLE}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span className="font-black text-xl" style={{ color: '#EDE9DF', letterSpacing: '-0.04em' }}>
              MATCH<span style={{ color: '#F97316' }}>MIND</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            <Link href="/predictions" style={{ color: '#F97316', textDecoration: 'none' }}>Predictions</Link>
            <Link href="/value-bets" className="nav-link">Value Bets</Link>
            <Link href="/track-record" className="nav-link">Track Record</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/login" className="nav-link" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sign in</Link>
            <Link href="/signup" className="font-mono" style={{
              fontSize: '11px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
              background: '#F97316', color: '#fff', padding: '8px 16px', textDecoration: 'none',
            }}>Start free →</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '80px 24px 80px' }}>

        {/* Header */}
        <div style={{ paddingTop: '40px', marginBottom: '40px', borderBottom: '1px solid #1A1A22', paddingBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F97316' }}>
              AI-generated · updated daily
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0, color: '#EDE9DF', margin: '0 0 16px' }}>
            AI Football<br />Match Predictions.
          </h1>
          <p style={{ fontSize: '16px', color: '#6B6860', maxWidth: '520px', lineHeight: 1.6 }}>
            Every pick selected using Expected Value analysis across 25 leagues.
            Predictions logged before kickoff and auto-verified against results.
          </p>
        </div>

        {/* Stats strip */}
        <div style={{ border: '1px solid #1A1A22', marginBottom: '40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { label: 'Matches analysed', value: String(matches.length), color: '#EDE9DF' },
              { label: 'Value bets today', value: String(todayMatches.filter(m => m.is_value_bet).length), color: '#F97316' },
              { label: 'Leagues covered', value: '25', color: '#EDE9DF' },
            ].map((s, i) => (
              <div key={s.label} style={{ padding: '20px 24px', borderRight: i < 2 ? '1px solid #1A1A22' : 'none' }}>
                <p className="font-mono" style={{ fontSize: '2.5rem', fontWeight: 900, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', margin: '0 0 6px' }}>
                  {s.value}
                </p>
                <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860' }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Today's picks */}
        {todayMatches.length > 0 && (
          <section style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00C853' }}>
                Today
              </span>
              <span style={{ height: '1px', flex: 1, background: '#1A1A22' }} />
            </div>
            <MatchTable matches={todayMatches} />
          </section>
        )}

        {/* Upcoming */}
        {upcomingMatches.length > 0 && (
          <section style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6B6860' }}>
                Upcoming
              </span>
              <span style={{ height: '1px', flex: 1, background: '#1A1A22' }} />
            </div>
            <MatchTable matches={upcomingMatches} />
          </section>
        )}

        {matches.length === 0 && (
          <div style={{ padding: '80px 0', textAlign: 'center', border: '1px solid #1A1A22', marginBottom: '40px' }}>
            <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6B6860', marginBottom: '12px' }}>
              No picks yet
            </p>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#EDE9DF', marginBottom: '6px' }}>Predictions loading</p>
            <p style={{ fontSize: '14px', color: '#6B6860' }}>New picks are generated daily at 8 AM GMT</p>
          </div>
        )}

        {/* CTA */}
        <div style={{ border: '1px solid #1A1A22', borderTop: '4px solid #F97316', padding: '40px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#EDE9DF', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            Track these bets and get daily alerts.
          </h2>
          <p style={{ fontSize: '14px', color: '#6B6860', marginBottom: '24px', maxWidth: '480px' }}>
            Sign up free — log your bets, get AI coaching, and receive value bets in your inbox at 9 AM.
          </p>
          <Link href="/signup" className="font-mono" style={{
            fontSize: '12px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
            background: '#F97316', color: '#fff', padding: '12px 28px', textDecoration: 'none', display: 'inline-block',
          }}>
            Start Free →
          </Link>
        </div>

      </div>
      <PublicFooter />
    </div>
  )
}

function MatchTable({ matches }: { matches: Awaited<ReturnType<typeof getPredictions>> }) {
  return (
    <div style={{ border: '1px solid #1A1A22' }}>
      {/* Header */}
      <div className="font-mono hidden md:grid" style={{
        gridTemplateColumns: '2fr 1.5fr 1fr 70px 70px 80px',
        gap: '12px', padding: '8px 20px',
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860',
        background: '#0E0E12', borderBottom: '1px solid #1A1A22',
      }}>
        <span>Match</span>
        <span>Bet type</span>
        <span>Kick-off</span>
        <span style={{ textAlign: 'right' }}>Odds</span>
        <span style={{ textAlign: 'right' }}>EV</span>
        <span style={{ textAlign: 'right' }}>Result</span>
      </div>
      {matches.map((m, i) => {
        const slug = makeSlug(m.home_team, m.away_team, m.kick_off!)
        const kickOff = m.kick_off ? new Date(m.kick_off) : null
        const settled = m.result !== null
        const borderLeft = settled
          ? m.result === 'win' ? '3px solid #00C853' : m.result === 'loss' ? '3px solid #FF3355' : '3px solid #3A3A48'
          : m.is_value_bet ? '3px solid #F97316' : '3px solid #1A1A22'

        return (
          <Link
            key={m.id}
            href={`/predictions/${slug}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1fr 70px 70px 80px',
              gap: '12px',
              padding: '16px 20px',
              alignItems: 'center',
              borderBottom: i < matches.length - 1 ? '1px solid #1A1A22' : 'none',
              borderLeft,
              textDecoration: 'none',
              transition: 'background 0.1s',
            }}
            className="hover:bg-white/[0.02]"
          >
            <div>
              <p style={{ fontWeight: 700, fontSize: '13px', color: '#EDE9DF', margin: 0 }}>
                {m.home_team} <span style={{ color: '#3A3A48' }}>vs</span> {m.away_team}
              </p>
              <p className="font-mono" style={{ fontSize: '10px', color: '#6B6860', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {m.league}
                {m.is_value_bet && <span style={{ color: '#F97316', marginLeft: '8px' }}>VALUE</span>}
              </p>
            </div>
            <p style={{ fontSize: '12px', color: '#9E9B8E', margin: 0 }}>{m.bet_type}</p>
            <p className="font-mono" style={{ fontSize: '11px', color: '#6B6860', margin: 0 }}>
              {kickOff ? kickOff.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
            </p>
            <p className="font-mono" style={{ fontWeight: 700, fontSize: '13px', color: '#EDE9DF', textAlign: 'right', margin: 0 }}>
              {m.odds ? m.odds.toFixed(2) : '—'}
            </p>
            <p className="font-mono" style={{ fontWeight: 700, fontSize: '13px', color: '#00C853', textAlign: 'right', margin: 0 }}>
              {m.ev_percent ? `+${m.ev_percent}%` : '—'}
            </p>
            <div style={{ textAlign: 'right' }}>
              {settled ? (
                <span className="font-mono" style={{
                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px',
                  color: m.result === 'win' ? '#00C853' : m.result === 'loss' ? '#FF3355' : '#6B6860',
                  background: m.result === 'win' ? 'rgba(0,200,83,0.08)' : m.result === 'loss' ? 'rgba(255,51,85,0.08)' : 'rgba(107,104,96,0.1)',
                  border: `1px solid ${m.result === 'win' ? 'rgba(0,200,83,0.25)' : m.result === 'loss' ? 'rgba(255,51,85,0.2)' : 'rgba(107,104,96,0.2)'}`,
                }}>
                  {m.result === 'win' ? 'Won' : m.result === 'loss' ? 'Lost' : 'Void'}
                </span>
              ) : (
                <span className="font-mono" style={{ fontSize: '10px', color: '#3A3A48' }}>Pending</span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
