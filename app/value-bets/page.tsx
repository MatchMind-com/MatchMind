import type { Metadata } from 'next'
import Link from 'next/link'
import PublicFooter from '@/components/layout/PublicFooter'

export const metadata: Metadata = {
  title: "Today's AI Football Value Bets — Free Picks with EV Analysis",
  description: "Free AI football value bets updated daily. Every pick shows Expected Value vs bookmaker odds. Transparent track record — all predictions logged before kickoff. No sign-up needed.",
  keywords: ['football value bets today', 'free football tips', 'AI football predictions', 'expected value betting', 'best football bets today', 'football EV tips'],
  openGraph: {
    title: "Today's AI Football Value Bets — Free Picks",
    description: "Free AI football value bets with EV analysis. Predictions updated daily across Premier League, La Liga, Bundesliga, Serie A and more.",
  },
}

async function getTodaysPicks() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'}/api/public/predictions`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) throw new Error()
    const data = await res.json()
    return (data.predictions ?? []).filter((p: any) => p.ev_percent >= 15)
  } catch {
    return []
  }
}

const SAMPLE_PICKS = [
  { home_team: 'Arsenal', away_team: 'Wolves', league: 'Premier League', bet_type: 'Home Win', odds: 1.52, ev_percent: 17.4, ai_probability: 74 },
  { home_team: 'Barcelona', away_team: 'Getafe', league: 'La Liga', bet_type: 'BTTS — Yes', odds: 1.68, ev_percent: 19.1, ai_probability: 71 },
  { home_team: 'PSG', away_team: 'Lyon', league: 'Ligue 1', bet_type: 'Over 2.5 Goals', odds: 1.82, ev_percent: 22.3, ai_probability: 73 },
  { home_team: 'Bayern Munich', away_team: 'Stuttgart', league: 'Bundesliga', bet_type: 'Home Win', odds: 1.45, ev_percent: 16.8, ai_probability: 78 },
  { home_team: 'Juventus', away_team: 'Roma', league: 'Serie A', bet_type: 'Under 2.5 Goals', odds: 1.78, ev_percent: 15.9, ai_probability: 70 },
]

const NAV_STYLE = {
  position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 50,
  borderBottom: '1px solid #1A1A22',
  background: 'rgba(9,9,12,0.97)', backdropFilter: 'blur(8px)',
}

export default async function ValueBetsPage() {
  const picks = await getTodaysPicks()
  const displayPicks = picks.length >= 3 ? picks : SAMPLE_PICKS
  const isDemo = picks.length < 3

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

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
            <Link href="/predictions" className="nav-link">Predictions</Link>
            <Link href="/value-bets" style={{ color: '#F97316', textDecoration: 'none' }}>Value Bets</Link>
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
        <div style={{ paddingTop: '40px', marginBottom: '48px', borderBottom: '1px solid #1A1A22', paddingBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F97316' }}>
              Updated daily · free
            </span>
            <span style={{ height: '1px', width: '32px', background: '#1A1A22' }} />
            <span className="font-mono" style={{ fontSize: '10px', color: '#6B6860' }}>{today}</span>
          </div>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0, color: '#EDE9DF', margin: '0 0 16px' }}>
            AI Football<br />Value Bets.
          </h1>
          <p style={{ fontSize: '16px', color: '#6B6860', maxWidth: '520px', lineHeight: 1.6 }}>
            Every pick is selected because the bookmaker odds underestimate the true probability —
            giving you a statistical edge over time.
          </p>
        </div>

        {/* EV explainer — text only, no card */}
        <div style={{ marginBottom: '32px', borderBottom: '1px solid #1A1A22', paddingBottom: '32px' }}>
          <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6B6860', marginBottom: '10px' }}>
            What is EV%?
          </p>
          <p style={{ fontSize: '14px', color: '#6B6860', lineHeight: 1.7, maxWidth: '680px' }}>
            Expected Value measures how much profit you&apos;d make per £1 wagered over thousands of bets.
            A pick with <span style={{ color: '#F97316', fontWeight: 700 }}>+20% EV</span> means you&apos;d profit 20p per £1 staked on average.
            Positive EV doesn&apos;t guarantee any single win — but it guarantees profitability over time.
          </p>
        </div>

        {/* Demo notice */}
        {isDemo && (
          <div style={{ marginBottom: '24px', padding: '12px 16px', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
            <p className="font-mono" style={{ fontSize: '11px', color: '#F59E0B' }}>
              Sample picks shown — real AI picks generate each morning.{' '}
              <Link href="/signup" style={{ color: '#F59E0B', textDecoration: 'underline' }}>Sign up free</Link> to get live picks emailed daily.
            </p>
          </div>
        )}

        {/* Picks table */}
        <div style={{ border: '1px solid #1A1A22', marginBottom: '48px' }}>
          {/* Column headers */}
          <div className="font-mono hidden md:grid" style={{
            gridTemplateColumns: '2fr 1.5fr 80px 80px 80px',
            gap: '16px', padding: '10px 20px',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860',
            background: '#0E0E12', borderBottom: '1px solid #1A1A22',
          }}>
            <span>Match</span>
            <span>Bet type</span>
            <span style={{ textAlign: 'right' }}>Odds</span>
            <span style={{ textAlign: 'right' }}>EV edge</span>
            <span style={{ textAlign: 'right' }}>AI prob.</span>
          </div>

          {displayPicks.slice(0, 5).map((pick: any, i: number) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 80px 80px 80px',
              gap: '16px',
              padding: '18px 20px',
              alignItems: 'center',
              borderBottom: i < displayPicks.slice(0, 5).length - 1 ? '1px solid #1A1A22' : 'none',
              borderLeft: '3px solid #F97316',
            }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '14px', color: '#EDE9DF', margin: 0 }}>
                  {pick.home_team} <span style={{ color: '#3A3A48' }}>vs</span> {pick.away_team}
                </p>
                <p className="font-mono" style={{ fontSize: '10px', color: '#6B6860', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {pick.league}
                </p>
              </div>
              <p style={{ fontSize: '13px', color: '#9E9B8E', margin: 0 }}>{pick.bet_type}</p>
              <p className="font-mono" style={{ fontWeight: 700, fontSize: '14px', color: '#EDE9DF', textAlign: 'right', margin: 0 }}>
                {Number(pick.odds).toFixed(2)}
              </p>
              <p className="font-mono" style={{ fontWeight: 900, fontSize: '15px', color: '#00C853', textAlign: 'right', margin: 0 }}>
                +{Number(pick.ev_percent).toFixed(0)}%
              </p>
              <p className="font-mono" style={{ fontSize: '13px', color: '#9E9B8E', textAlign: 'right', margin: 0 }}>
                {pick.ai_probability}%
              </p>
            </div>
          ))}

          {/* Gate row */}
          <div style={{ padding: '14px 20px', textAlign: 'center', background: '#0E0E12', borderTop: '1px solid #1A1A22' }}>
            <Link href="/signup" className="font-mono" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F97316', textDecoration: 'none' }}>
              Get all picks emailed at 9 AM — sign up free →
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div style={{ border: '1px solid #1A1A22', borderTop: '4px solid #F97316', padding: '40px', marginBottom: '56px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#EDE9DF', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            Get picks emailed every morning.
          </h2>
          <p style={{ fontSize: '14px', color: '#6B6860', marginBottom: '24px', maxWidth: '480px' }}>
            Sign up free and get today&apos;s AI value bets in your inbox at 9 AM.
            Plus: track your bets, chat with the AI coach, and see your personal ROI.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link href="/signup" className="font-mono" style={{
              fontSize: '12px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
              background: '#F97316', color: '#fff', padding: '12px 28px', textDecoration: 'none', display: 'inline-block',
            }}>
              Start Free →
            </Link>
            <Link href="/track-record" className="font-mono" style={{
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              border: '1px solid #2A2A35', color: '#6B6860', padding: '12px 28px', textDecoration: 'none', display: 'inline-block',
            }}>
              View track record
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6B6860', marginBottom: '24px' }}>
            FAQ
          </p>
          {[
            { q: 'How does MatchMind find value bets?', a: "MatchMind's AI analyses team form, injuries, head-to-head records, and market odds across 25 leagues. It calculates the true probability of each outcome and flags bets where the bookmaker odds imply a lower probability than the AI estimates." },
            { q: 'What is Expected Value (EV) in betting?', a: "Expected Value is the theoretical profit per unit staked over a large number of bets. A bet with +20% EV means that if you placed it 100 times, you'd expect to profit £20 per £1 staked. Individual bets can still lose — EV is a long-run measure of quality." },
            { q: 'Are these football tips guaranteed to win?', a: "No tip service can guarantee wins. MatchMind's AI identifies statistical edges using Expected Value — bets that are priced better than their true probability. Over a large sample, positive EV bets should be profitable, but variance means short-term losing runs are normal." },
            { q: 'Which football leagues does MatchMind cover?', a: 'MatchMind covers 25 leagues including Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, Europa League, Championship, and more.' },
          ].map((item, i, arr) => (
            <details key={i} style={{ borderTop: '1px solid #1A1A22', borderBottom: i === arr.length - 1 ? '1px solid #1A1A22' : 'none' }}>
              <summary style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', listStyle: 'none', padding: '18px 0',
                fontWeight: 700, fontSize: '14px', color: '#EDE9DF',
              }}>
                <span>{item.q}</span>
                <span className="font-mono" style={{ color: '#F97316', fontSize: '20px', lineHeight: 1, marginLeft: '16px', flexShrink: 0 }}>+</span>
              </summary>
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#6B6860', paddingBottom: '18px', margin: 0, paddingRight: '32px' }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>

      </div>
      <PublicFooter />
    </div>
  )
}
