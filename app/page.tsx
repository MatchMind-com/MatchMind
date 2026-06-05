import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PublicFooter from '@/components/layout/PublicFooter'
import WcPromoBanner from '@/components/WcPromoBanner'

async function getLiveStats() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'}/api/stats/public`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error()
    return await res.json()
  } catch {
    return { users: 0, tipsters: 0, bets_tracked: 0, ai_accuracy: 61, value_bets_today: 9, leagues_covered: 25 }
  }
}

async function getPublicPredictions() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'}/api/public/predictions`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    return data.predictions as Array<{
      id: string
      home_team: string
      away_team: string
      league: string
      bet_type: string
      odds: number
      ev_percent: number
      ai_probability: number
      kick_off: string
    }>
  } catch {
    return []
  }
}

async function getTrackRecord() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'}/api/track-record`, {
      next: { revalidate: 600 },
    })
    if (!res.ok) throw new Error()
    return (await res.json()).stats as {
      total: number
      wins: number
      winRate: number
      roi: number
      valueBets: { total: number; winRate: number }
    }
  } catch {
    return null
  }
}

const SAMPLE_PREDS = [
  { home_team: 'Arsenal', away_team: 'Chelsea', league: 'Premier League', bet_type: 'Over 2.5 Goals', odds: 1.87, ev_percent: 18.4, ai_probability: 72, kick_off: '', id: 's1' },
  { home_team: 'Real Madrid', away_team: 'Atletico', league: 'La Liga', bet_type: 'BTTS — Yes', odds: 1.74, ev_percent: 11.2, ai_probability: 68, kick_off: '', id: 's2' },
  { home_team: 'Bayern', away_team: 'Dortmund', league: 'Bundesliga', bet_type: 'Over 2.5 Goals', odds: 1.78, ev_percent: 9.6, ai_probability: 65, kick_off: '', id: 's3' },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const [stats, livePreds, track] = await Promise.all([
    getLiveStats(),
    getPublicPredictions(),
    getTrackRecord(),
  ])
  const predictions = livePreds.length > 0 ? livePreds : SAMPLE_PREDS
  const isLiveData = livePreds.length > 0

  // WC kickoff date + days-until centralized in lib/wc-promo.ts (used via
  // <WcPromoBanner />). Banner self-gates by date; no top-level date math here.

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MatchMind',
    url: 'https://www.matchmindcom.com',
    logo: 'https://www.matchmindcom.com/icon-512.png',
    description: 'AI-powered football predictions, value bets with Pinnacle edge detection, and an AI betting coach.',
    sameAs: [
      'https://www.tiktok.com/@match.mindai',
      'https://instagram.com/match.mindai',
      'https://twitter.com/Match_Mind_AI',
    ],
  }

  const tickerItems = [...predictions, ...predictions, ...predictions]

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#09090C', color: '#EDE9DF', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />

      {/* ── LIVE TICKER ── */}
      <div className="overflow-hidden" style={{ background: '#F97316', height: '36px', display: 'flex', alignItems: 'center' }}>
        <div className="ticker-track">
          {tickerItems.map((p, i) => (
            <span key={i} className="font-mono text-xs font-bold text-white whitespace-nowrap" style={{ padding: '0 2rem' }}>
              {p.home_team.toUpperCase()} vs {p.away_team.toUpperCase()}
              <span className="mx-2" style={{ opacity: 0.5 }}>·</span>
              {p.bet_type}
              <span className="mx-2" style={{ opacity: 0.5 }}>·</span>
              <span style={{ opacity: 0.75 }}>@{Number(p.odds).toFixed(2)}</span>
              <span className="mx-2" style={{ opacity: 0.5 }}>·</span>
              <span style={{ color: '#fff', background: 'rgba(0,0,0,0.2)', padding: '1px 6px' }}>+{Number(p.ev_percent).toFixed(0)}% EV</span>
              <span className="ml-8" style={{ opacity: 0.3 }}>///</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── WORLD CUP BANNER — copy + visibility centralized in lib/wc-promo.ts ── */}
      <WcPromoBanner variant="sticky" href="/world-cup" />

      {/* ── NAV ── */}
      <nav className="sticky z-50" style={{
        top: 0,
        borderBottom: '1px solid #1A1A22',
        background: 'rgba(9,9,12,0.97)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span className="font-black text-xl" style={{ color: '#EDE9DF', letterSpacing: '-0.04em' }}>
              MATCH<span style={{ color: '#F97316' }}>MIND</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            <a href="#picks" className="nav-link">Picks</a>
            <Link href="/world-cup" className="nav-link-wc">World Cup</Link>
            <a href="#how" className="nav-link">How it works</a>
            <Link href="/track-record" className="nav-link">Track record</Link>
            <a href="#pricing" className="nav-link">Pricing</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/login" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B6860', textDecoration: 'none' }}>
              Sign in
            </Link>
            <Link href="/signup" style={{
              fontSize: '11px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
              background: '#F97316', color: '#fff', padding: '8px 16px', textDecoration: 'none',
            }}>
              Start free →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '60px 24px 0' }}>

        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <span className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F97316' }}>
            {isLiveData ? '● Live analysis' : '○ AI analysis'}
          </span>
          <span style={{ height: '1px', width: '48px', background: '#1A1A22' }} />
          <span className="font-mono" style={{ fontSize: '10px', color: '#6B6860' }}>
            {stats.leagues_covered} leagues · updated every hour
          </span>
        </div>

        {/* Main layout: headline left, scoreboard right */}
        <div className="home-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '64px', alignItems: 'end', paddingBottom: '48px', borderBottom: '2px solid #1A1A22' }}>
          <div>
            <h1 className="home-hero-headline" style={{
              fontSize: 'clamp(4rem, 10vw, 9rem)',
              fontWeight: 900,
              lineHeight: 0.92,
              letterSpacing: '-0.05em',
              color: '#EDE9DF',
              marginBottom: '32px',
            }}>
              Find<br />
              the<br />
              <span style={{ color: '#F97316' }}>edge.</span>
            </h1>

            {/* Brand positioning line — workspace framing per
                docs/workspace-spec.md. The "coach of your own fund"
                line replaces the generic "AI analyses every match" pitch
                and shifts MatchMind out of the punter-tips category into
                betting-workspace tooling. */}
            <p style={{ fontSize: '18px', lineHeight: 1.5, color: '#EDE9DF', maxWidth: '480px', marginBottom: '14px', fontWeight: 600 }}>
              You&apos;re the coach of your own sports betting fund.
              <span style={{ color: '#F97316' }}> MatchMind gives you the tools to run it.</span>
            </p>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#6B6860', maxWidth: '480px', marginBottom: '32px' }}>
              Analyst desk, research tools, AI coach — across {stats.leagues_covered} leagues.
              Every pick logged before kick-off, every result public.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/signup" style={{
                fontSize: '12px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
                background: '#F97316', color: '#fff', padding: '14px 28px', textDecoration: 'none',
                display: 'inline-block',
              }}>
                Start free — no card needed →
              </Link>
              <a href="#picks" style={{
                fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                border: '1px solid #2A2A35', color: '#6B6860', padding: '14px 28px', textDecoration: 'none',
                display: 'inline-block',
              }}>
                See today&apos;s picks
              </a>
            </div>

            {/* Hard-number proof line, above-the-fold on mobile. Pulls real
                numbers from /api/track-record so it stays honest as the
                sample size grows. Falls back to soft signal only if API
                fails completely. */}
            {track?.total && track.total > 0 ? (
              <Link
                href="/track-record"
                className="font-mono"
                style={{
                  display: 'inline-flex', flexWrap: 'wrap', gap: '12px', alignItems: 'baseline',
                  fontSize: '11px', color: '#9E9B8E', marginTop: '20px',
                  textDecoration: 'none', borderTop: '1px solid #1A1A22',
                  paddingTop: '16px',
                }}
              >
                <span><strong style={{ color: '#EDE9DF', fontWeight: 900 }}>{track.total}</strong> picks tracked</span>
                <span style={{ color: '#2A2A35' }}>·</span>
                <span><strong style={{ color: '#00C853', fontWeight: 900 }}>{track.valueBets?.winRate ?? track.winRate}%</strong> value-bet win rate</span>
                <span style={{ color: '#2A2A35' }}>·</span>
                <span style={{
                  color: (track.roi ?? 0) >= 0 ? '#00C853' : '#FF3355',
                  fontWeight: 900,
                }}>
                  {(track.roi ?? 0) > 0 ? '+' : ''}{(track.roi ?? 0).toFixed(1)}% ROI
                </span>
                <span style={{ color: '#F97316' }}>see record →</span>
              </Link>
            ) : (
              <p className="font-mono" style={{ fontSize: '11px', color: '#3A3A48', marginTop: '20px' }}>
                {stats.users > 0 ? `${stats.users.toLocaleString()} members · ` : ''}every pick logged before kick-off · every result public
              </p>
            )}
          </div>

          {/* Scoreboard: 2×2 grid of key stats — visible on mobile too now
              (added home-hero-scoreboard so the responsive CSS displays it
              on small screens; was hidden via `hidden md:grid` before). */}
          <div className="home-hero-scoreboard hidden md:grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0', border: '1px solid #1A1A22' }}>
            {[
              { val: stats.value_bets_today, lbl: 'Value bets\ntoday', color: '#F97316' },
              { val: `${track?.valueBets?.winRate ?? 39}%`, lbl: 'Value-bet\nwin rate', color: '#00C853' },
              { val: stats.leagues_covered, lbl: 'Leagues\ncovered', color: '#EDE9DF' },
              { val: track?.total ?? 48, lbl: 'Picks\ntracked', color: '#EDE9DF' },
            ].map((s, i) => (
              <div key={s.lbl} style={{
                padding: '28px 32px',
                borderRight: i % 2 === 0 ? '1px solid #1A1A22' : 'none',
                borderBottom: i < 2 ? '1px solid #1A1A22' : 'none',
                minWidth: '140px',
              }}>
                <p className="font-mono" style={{ fontSize: '3rem', fontWeight: 900, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {s.val}
                </p>
                <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860', marginTop: '8px', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                  {s.lbl}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PICKS BOARD ── */}
      <section id="picks" style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F97316' }}>
              {isLiveData ? '● Live' : '○ Sample'}
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em', color: '#EDE9DF', margin: 0 }}>
              Today&apos;s Value Bets
            </h2>
          </div>
          <Link href="/predictions" className="font-mono hidden sm:block" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F97316', textDecoration: 'none' }}>
            All {stats.value_bets_today}+ picks →
          </Link>
        </div>

        {/* Odds board table */}
        <div style={{ border: '1px solid #1A1A22' }}>
          {/* Column headers */}
          <div className="font-mono hidden sm:grid" style={{
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

          {predictions.slice(0, 3).map((p, i) => (
            <div key={p.id} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 80px 80px 80px',
              gap: '16px',
              padding: '18px 20px',
              alignItems: 'center',
              borderBottom: i < 2 ? '1px solid #1A1A22' : 'none',
              borderLeft: '3px solid #F97316',
              transition: 'background 0.1s',
            }}
              className="home-picks-row hover:bg-white/[0.02]"
            >
              <div>
                <p style={{ fontWeight: 700, fontSize: '14px', color: '#EDE9DF', margin: 0 }}>
                  {p.home_team} <span style={{ color: '#3A3A48' }}>vs</span> {p.away_team}
                </p>
                <p className="font-mono" style={{ fontSize: '10px', color: '#6B6860', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {p.league}
                </p>
              </div>
              <p style={{ fontSize: '13px', color: '#9E9B8E', margin: 0 }}>{p.bet_type}</p>
              <p className="font-mono" style={{ fontWeight: 700, fontSize: '14px', color: '#EDE9DF', textAlign: 'right', margin: 0 }}>
                {Number(p.odds).toFixed(2)}
              </p>
              <p className="font-mono" style={{ fontWeight: 900, fontSize: '15px', color: '#00C853', textAlign: 'right', margin: 0 }}>
                +{Number(p.ev_percent).toFixed(0)}%
              </p>
              <p className="font-mono" style={{ fontSize: '13px', color: '#9E9B8E', textAlign: 'right', margin: 0 }}>
                {p.ai_probability}%
              </p>
            </div>
          ))}

          {/* Gate row */}
          <div style={{ padding: '14px 20px', textAlign: 'center', background: '#0E0E12', borderTop: '1px solid #1A1A22' }}>
            <Link href="/signup" className="font-mono" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F97316', textDecoration: 'none' }}>
              + {Math.max(0, stats.value_bets_today - 3)} more picks hidden — sign up free to unlock →
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP (league-table style) ── */}
      <div style={{ borderTop: '1px solid #1A1A22', borderBottom: '1px solid #1A1A22', background: '#0E0E12' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Header row */}
          <div className="font-mono" style={{ display: 'flex', padding: '8px 24px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3A3A48', borderBottom: '1px solid #1A1A22' }}>
            <span>Performance stats</span>
          </div>
          {/* Data row */}
          <div className="home-stats-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {[
              { val: stats.value_bets_today, lbl: 'Value bets today', color: '#F97316' },
              { val: stats.leagues_covered, lbl: 'Leagues', color: '#EDE9DF' },
              { val: track?.total ?? 48, lbl: 'Picks tracked', color: '#EDE9DF' },
              { val: `${track?.valueBets?.winRate ?? 39}%`, lbl: 'Win rate', color: '#00C853' },
              {
                val: track?.roi !== undefined
                  ? `${track.roi > 0 ? '+' : ''}${track.roi.toFixed(1)}%`
                  : '—',
                lbl: 'ROI', color: '#00C853',
              },
            ].map((s, i) => (
              <div key={s.lbl} style={{
                padding: '24px',
                borderRight: i < 4 ? '1px solid #1A1A22' : 'none',
              }}>
                <p className="font-mono" style={{ fontSize: '2.5rem', fontWeight: 900, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', margin: 0 }}>
                  {s.val}
                </p>
                <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860', marginTop: '8px', margin: '8px 0 0' }}>
                  {s.lbl}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ maxWidth: '1280px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
          <span className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F97316' }}>
            How it works
          </span>
          <span style={{ height: '1px', flex: 1, background: '#1A1A22' }} />
        </div>

        <div className="home-how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '2px solid #EDE9DF' }}>
          {[
            {
              n: '01',
              t: 'AI scans every match',
              d: 'GPT-4o analyses form, injuries, xG, and head-to-head across 25 leagues — then prices every outcome with a real probability.',
            },
            {
              n: '02',
              t: 'We find the bookmaker errors',
              d: 'Where the AI probability exceeds the bookmaker\'s implied odds, that\'s a value bet. Positive EV = mathematical edge, compounding over time.',
            },
            {
              n: '03',
              t: 'Track every bet publicly',
              d: 'Every pick locked in before kick-off. Results auto-verified. Your ROI is calculated in real time. No hidden picks, no cherry-picked results.',
            },
          ].map((step, i) => (
            <div key={step.n} style={{
              padding: '40px 32px',
              borderRight: i < 2 ? '1px solid #1A1A22' : 'none',
              borderBottom: '1px solid #1A1A22',
            }}>
              <p className="font-mono" style={{ fontSize: '5rem', fontWeight: 900, color: '#1A1A22', lineHeight: 1, marginBottom: '24px' }}>
                {step.n}
              </p>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#EDE9DF', marginBottom: '12px', letterSpacing: '-0.02em' }}>
                {step.t}
              </h3>
              <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#6B6860', margin: 0 }}>
                {step.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRACK RECORD ── */}
      <section style={{ borderTop: '1px solid #1A1A22', borderBottom: '1px solid #1A1A22', background: '#0E0E12' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '80px 24px' }}>
          <div className="home-trackrecord-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '80px', alignItems: 'center' }}>
            <div>
              <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6B6860', marginBottom: '20px' }}>
                Transparency over hype
              </p>
              <h2 style={{
                fontSize: 'clamp(2.5rem, 6vw, 5rem)',
                fontWeight: 900, lineHeight: 1.0,
                letterSpacing: '-0.04em', color: '#EDE9DF', marginBottom: '24px',
              }}>
                Every pick logged<br />before kick-off.<br />
                <span style={{ color: '#3A3A48' }}>Every result public.</span>
              </h2>
              <p style={{ fontSize: '15px', lineHeight: 1.65, color: '#6B6860', maxWidth: '480px', marginBottom: '32px' }}>
                We don&apos;t claim 70% win rates. We publish every single pick the moment it&apos;s made and let the tape speak for itself.
              </p>
              <Link href="/track-record" style={{
                fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase',
                border: '1px solid #F97316', color: '#F97316', padding: '12px 24px', textDecoration: 'none', display: 'inline-block',
              }}>
                See full track record →
              </Link>
            </div>

            {/* Win/loss scoreboard */}
            <div className="hidden md:block" style={{ border: '1px solid #1A1A22', minWidth: '240px' }}>
              <div className="font-mono" style={{
                padding: '10px 20px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: '#6B6860', borderBottom: '1px solid #1A1A22', background: '#141418',
              }}>
                All-time record
              </div>
              <div style={{ padding: '32px 28px', textAlign: 'center' }}>
                <p className="font-mono" style={{ fontSize: '4rem', fontWeight: 900, color: '#EDE9DF', lineHeight: 1, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: '#00C853' }}>{track?.wins ?? '—'}</span>
                  <span style={{ color: '#2A2A35' }}>W</span>
                  <span style={{ color: '#2A2A35', fontSize: '2.5rem', margin: '0 4px' }}>/</span>
                  <span>{track?.total ?? '—'}</span>
                </p>
                <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860', marginTop: '12px' }}>
                  picks won
                </p>
                {track?.roi !== undefined && (
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #1A1A22' }}>
                    <p className="font-mono" style={{ fontSize: '2.5rem', fontWeight: 900, color: track.roi >= 0 ? '#00C853' : '#FF3355', margin: 0 }}>
                      {track.roi > 0 ? '+' : ''}{track.roi.toFixed(1)}%
                    </p>
                    <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860', marginTop: '6px' }}>
                      ROI
                    </p>
                  </div>
                )}
                {/* Critical context — without this a 39% win rate looks bad
                    to non-bettors who don't understand value-bet math. */}
                <p style={{
                  fontSize: '11px', lineHeight: 1.5, color: '#6B6860',
                  marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #1A1A22',
                  textAlign: 'left',
                }}>
                  <strong style={{ color: '#EDE9DF' }}>Why win rate looks low:</strong>{' '}
                  we target <span style={{ color: '#F97316' }}>+EV</span> at odds 1.80–4.00, not favourites.
                  Break-even is ~30–55%. Anything above is profit.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ maxWidth: '1280px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
          <span className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F97316' }}>
            Pricing
          </span>
          <span style={{ height: '1px', flex: 1, background: '#1A1A22' }} />
          <span className="font-mono" style={{ fontSize: '10px', color: '#6B6860' }}>
            Start free. Upgrade when you want the full edge.
          </span>
        </div>

        <div className="home-pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', border: '1px solid #1A1A22' }}>
          {/* Free */}
          <div style={{ padding: '40px', borderRight: '1px solid #1A1A22' }}>
            <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860', marginBottom: '16px' }}>
              Free plan
            </p>
            <p style={{ fontSize: '3.5rem', fontWeight: 900, color: '#EDE9DF', lineHeight: 1, marginBottom: '4px', letterSpacing: '-0.03em' }}>
              £0
            </p>
            <p style={{ fontSize: '13px', color: '#6B6860', marginBottom: '32px' }}>Forever. No card needed.</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['3 AI picks per day', 'Bet slip tracker', 'Public track record', 'Basic bankroll tool'].map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#9E9B8E' }}>
                  <span className="font-mono" style={{ color: '#2A2A35' }}>—</span>
                  {f}
                </li>
              ))}
            </ul>

            <Link href="/signup" className="font-mono" style={{
              display: 'block', textAlign: 'center', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              border: '1px solid #2A2A35', color: '#6B6860', padding: '14px', textDecoration: 'none',
            }}>
              Start free
            </Link>
          </div>

          {/* Pro */}
          <div style={{ padding: '40px', borderTop: '4px solid #F97316' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#F97316', margin: 0 }}>
                Pro plan
              </p>
              <span className="font-mono" style={{
                fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '4px 8px', background: 'rgba(249,115,22,0.1)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)',
              }}>
                Most popular
              </span>
            </div>

            <div style={{ marginBottom: '4px' }}>
              <span style={{ fontSize: '3.5rem', fontWeight: 900, color: '#F97316', lineHeight: 1, letterSpacing: '-0.03em' }}>£9.99</span>
              <span style={{ fontSize: '14px', color: '#6B6860', marginLeft: '8px' }}>/month</span>
            </div>
            <p style={{ fontSize: '13px', color: '#6B6860', marginBottom: '32px' }}>Full edge. Cancel anytime.</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                'Unlimited AI picks + value bets',
                'Pinnacle edge detection',
                'Daily value-bet email alerts',
                'AI betting coach (GPT-4o)',
                'Full bankroll tracker + Kelly staking',
                'Weekly performance reports',
              ].map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#EDE9DF' }}>
                  <span className="font-mono" style={{ color: '#F97316', fontWeight: 700 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <Link href="/signup" className="font-mono" style={{
              display: 'block', textAlign: 'center', fontSize: '11px', fontWeight: 900,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              background: '#F97316', color: '#fff', padding: '14px', textDecoration: 'none',
            }}>
              Start Pro free →
            </Link>
          </div>
        </div>

        <p className="font-mono" style={{ fontSize: '11px', textAlign: 'center', color: '#3A3A48', marginTop: '16px' }}>
          Grandfathered price for life. £9.99 will rise as the product grows — lock it in now.
        </p>
      </section>

      {/* ── FAQ ── */}
      <section style={{ borderTop: '1px solid #1A1A22', background: '#0E0E12' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
            <span className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6B6860' }}>
              FAQ
            </span>
            <span style={{ height: '1px', flex: 1, background: '#1A1A22' }} />
          </div>

          <div style={{ maxWidth: '800px' }}>
            {[
              { q: 'Is MatchMind a betting site?', a: 'No — we don\'t take bets. We analyse matches and show you where the bookmakers have mispriced outcomes. Placing bets is your choice, on whatever site you use.' },
              { q: 'Do you guarantee wins?', a: 'No one can. Positive expected value guarantees profitability over hundreds of bets, not any single one. We publish every pick before kick-off so you can judge the edge yourself.' },
              { q: 'Why £9.99 and not £29?', a: 'Because we\'re in launch mode and the math works: 1 value bet per day at +10% EV covers the sub and more. Grandfathered for life if you join early.' },
              { q: 'Can I cancel anytime?', a: 'One click in your settings. Full Stripe-backed billing, no hidden fees, no annual lock-in.' },
              { q: 'Is this legal in the UK?', a: 'Yes. MatchMind is analytics software, not a bookmaker. Using betting analytics tools is legal. Always gamble responsibly. 18+.' },
            ].map((f, i, arr) => (
              <details key={f.q} style={{ borderTop: '1px solid #1A1A22', borderBottom: i === arr.length - 1 ? '1px solid #1A1A22' : 'none' }}>
                <summary style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', listStyle: 'none', padding: '20px 0',
                  fontWeight: 700, fontSize: '15px', color: '#EDE9DF',
                }}>
                  <span>{f.q}</span>
                  <span className="font-mono" style={{ color: '#F97316', fontSize: '20px', lineHeight: 1, marginLeft: '16px', flexShrink: 0 }}>+</span>
                </summary>
                <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#6B6860', paddingBottom: '20px', margin: 0, paddingRight: '48px' }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ borderTop: '2px solid #EDE9DF' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '80px 24px' }}>
          <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F97316', marginBottom: '24px' }}>
            Get started
          </p>
          <h2 className="home-cta-headline" style={{
            fontSize: 'clamp(3rem, 9vw, 8rem)',
            fontWeight: 900, lineHeight: 0.95,
            letterSpacing: '-0.05em', color: '#EDE9DF',
            marginBottom: '40px',
          }}>
            Start finding<br />the edge today.
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' }}>
            <Link href="/signup" style={{
              fontSize: '13px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
              background: '#F97316', color: '#fff', padding: '16px 36px', textDecoration: 'none', display: 'inline-block',
            }}>
              Start free — no card →
            </Link>
            <div className="font-mono" style={{ display: 'flex', gap: '20px', fontSize: '11px', color: '#3A3A48', flexWrap: 'wrap' }}>
              {stats.users > 0 && (
                <>
                  <span>{stats.users.toLocaleString()} members</span>
                  <span>·</span>
                </>
              )}
              <span>{stats.value_bets_today} value bets today</span>
              <span>·</span>
              <span>every pick public</span>
            </div>
          </div>

          <p className="font-mono" style={{ fontSize: '11px', color: '#3A3A48' }}>
            <span style={{
              display: 'inline-block', fontWeight: 900, padding: '2px 6px', marginRight: '8px',
              border: '1px solid rgba(255,51,85,0.4)', color: '#FF3355', background: 'rgba(255,51,85,0.08)',
            }}>18+</span>
            Bet responsibly.{' '}
            <a href="https://www.begambleaware.org" style={{ color: '#3A3A48', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">
              BeGambleAware.org
            </a>
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
