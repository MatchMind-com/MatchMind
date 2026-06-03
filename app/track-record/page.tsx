import Link from 'next/link'
import PublicFooter from '@/components/layout/PublicFooter'

export const revalidate = 300

async function getTrackRecord() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'}/api/track-record`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) throw new Error()
    return await res.json()
  } catch {
    return { stats: null, byLeague: [], byBetType: [], recent: [], chartData: [] }
  }
}

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, { color: string; bg: string; border: string; label: string }> = {
    win:  { color: '#00C853', bg: 'rgba(0,200,83,0.08)',  border: 'rgba(0,200,83,0.25)',  label: 'Won'  },
    loss: { color: '#FF3355', bg: 'rgba(255,51,85,0.08)', border: 'rgba(255,51,85,0.2)',  label: 'Lost' },
    void: { color: '#6B6860', bg: 'rgba(107,104,96,0.1)', border: 'rgba(107,104,96,0.2)', label: 'Void' },
  }
  const s = styles[result] ?? styles.void
  return (
    <span className="font-mono" style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '3px 8px', color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  )
}

const NAV_STYLE = {
  position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 50,
  borderBottom: '1px solid #1A1A22',
  background: 'rgba(9,9,12,0.97)', backdropFilter: 'blur(8px)',
}

export default async function TrackRecordPage() {
  const { stats, byLeague, byBetType, recent } = await getTrackRecord()
  const hasData = stats && stats.total > 0

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
            <Link href="/value-bets" className="nav-link">Value Bets</Link>
            <Link href="/track-record" style={{ color: '#F97316', textDecoration: 'none' }}>Track Record</Link>
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
            <span className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00C853' }}>
              Auto-verified
            </span>
            <span style={{ height: '1px', width: '32px', background: '#1A1A22' }} />
            <span className="font-mono" style={{ fontSize: '10px', color: '#6B6860' }}>
              Every pick logged before kick-off · no cherry-picking
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0, color: '#EDE9DF', margin: '0 0 12px' }}>
            AI Prediction<br />Track Record.
          </h1>
          <p style={{ fontSize: '16px', color: '#6B6860', maxWidth: '560px', lineHeight: 1.6 }}>
            Every prediction is logged before kickoff and automatically verified against the final result.
            No editing history. No cherry-picking.
          </p>
        </div>

        {!hasData ? (
          /* Empty state */
          <div style={{ maxWidth: '560px', margin: '80px auto', border: '1px solid #1A1A22', padding: '48px' }}>
            <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6B6860', marginBottom: '20px' }}>
              Building the record
            </p>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#EDE9DF', marginBottom: '12px', letterSpacing: '-0.02em' }}>
              Predictions are accumulating.
            </h2>
            <p style={{ fontSize: '14px', color: '#6B6860', lineHeight: 1.65, marginBottom: '32px' }}>
              Our AI makes predictions daily. Results are auto-verified after each match finishes.
              Check back in a few days to see the first verified results.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'Predictions locked before kickoff — no post-match editing',
                'Results fetched from official API-Football data',
                'Win/loss auto-calculated, P&L tracked per unit stake',
              ].map(p => (
                <li key={p} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#6B6860' }}>
                  <span style={{ color: '#F97316', flexShrink: 0 }}>→</span> {p}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="font-mono" style={{
              display: 'inline-block', fontSize: '11px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
              background: '#F97316', color: '#fff', padding: '12px 24px', textDecoration: 'none',
            }}>
              Get early access →
            </Link>
          </div>
        ) : (
          <>
            {/* Stats strip */}
            <div style={{ border: '1px solid #1A1A22', marginBottom: '32px' }}>
              <div className="font-mono" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '8px 20px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3A3A48', borderBottom: '1px solid #1A1A22', background: '#0E0E12' }}>
                <span>Performance summary</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {[
                  { label: 'Total tips', value: String(stats.total), color: '#EDE9DF' },
                  { label: 'Win rate', value: `${stats.winRate}%`, color: stats.winRate >= 50 ? '#00C853' : '#EDE9DF' },
                  { label: 'Total P&L', value: `${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit}u`, color: stats.totalProfit >= 0 ? '#00C853' : '#FF3355' },
                  { label: 'ROI', value: `${stats.roi >= 0 ? '+' : ''}${stats.roi}%`, color: stats.roi >= 0 ? '#00C853' : '#FF3355' },
                ].map((s, i) => (
                  <div key={s.label} style={{ padding: '20px 20px', borderRight: i < 3 ? '1px solid #1A1A22' : 'none' }}>
                    <p className="font-mono" style={{ fontSize: '2rem', fontWeight: 900, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', margin: '0 0 6px' }}>
                      {s.value}
                    </p>
                    <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860' }}>
                      {s.label}
                    </p>
                    {i === 0 && (
                      <p className="font-mono" style={{ fontSize: '10px', color: '#3A3A48', marginTop: '4px' }}>
                        {stats.wins}W · {stats.losses}L · {stats.voids} void
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Value bets highlight */}
            {stats.valueBets?.total > 0 && (
              <div style={{ border: '1px solid #1A1A22', borderLeft: '4px solid #F97316', marginBottom: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '0' }}>
                <div style={{ padding: '20px', borderRight: '1px solid #1A1A22', gridColumn: 'span 1' }}>
                  <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#F97316', marginBottom: '8px' }}>
                    Value bets only
                  </p>
                  <p style={{ fontSize: '13px', color: '#6B6860' }}>High EV% picks — our best calls</p>
                </div>
                {[
                  { label: 'Win rate', value: `${stats.valueBets.winRate}%`, color: '#00C853' },
                  { label: 'ROI', value: `${stats.valueBets.roi >= 0 ? '+' : ''}${stats.valueBets.roi}%`, color: '#00C853' },
                ].map((s, i) => (
                  <div key={s.label} style={{ padding: '20px', borderRight: i === 0 ? '1px solid #1A1A22' : 'none' }}>
                    <p className="font-mono" style={{ fontSize: '2rem', fontWeight: 900, color: s.color, lineHeight: 1, margin: '0 0 4px' }}>{s.value}</p>
                    <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* By League and By Bet Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>

              {/* By League */}
              {byLeague.length > 0 && (
                <div style={{ border: '1px solid #1A1A22' }}>
                  <div className="font-mono" style={{ padding: '10px 16px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860', borderBottom: '1px solid #1A1A22', background: '#0E0E12' }}>
                    By League
                  </div>
                  <div>
                    {/* Header row */}
                    <div className="font-mono" style={{ display: 'grid', gridTemplateColumns: '1fr 40px 40px 60px 60px', gap: '8px', padding: '8px 16px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3A3A48', borderBottom: '1px solid #1A1A22' }}>
                      <span>League</span>
                      <span style={{ textAlign: 'center' }}>W</span>
                      <span style={{ textAlign: 'center' }}>L</span>
                      <span style={{ textAlign: 'right' }}>Win%</span>
                      <span style={{ textAlign: 'right' }}>P&L</span>
                    </div>
                    {byLeague.slice(0, 6).map((l: any, i: number) => (
                      <div key={l.league} style={{ display: 'grid', gridTemplateColumns: '1fr 40px 40px 60px 60px', gap: '8px', padding: '10px 16px', alignItems: 'center', borderBottom: i < 5 ? '1px solid #1A1A22' : 'none' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#EDE9DF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.league}</span>
                        <span className="font-mono" style={{ fontSize: '13px', color: '#00C853', textAlign: 'center' }}>{l.wins}</span>
                        <span className="font-mono" style={{ fontSize: '13px', color: '#FF3355', textAlign: 'center' }}>{l.losses}</span>
                        <span className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: '#EDE9DF', textAlign: 'right' }}>{l.winRate}%</span>
                        <span className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: l.profit >= 0 ? '#00C853' : '#FF3355', textAlign: 'right' }}>
                          {l.profit >= 0 ? '+' : ''}{l.profit}u
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By Bet Type */}
              {byBetType.length > 0 && (
                <div style={{ border: '1px solid #1A1A22' }}>
                  <div className="font-mono" style={{ padding: '10px 16px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860', borderBottom: '1px solid #1A1A22', background: '#0E0E12' }}>
                    By Bet Type
                  </div>
                  <div>
                    <div className="font-mono" style={{ display: 'grid', gridTemplateColumns: '1fr 40px 40px 60px 60px', gap: '8px', padding: '8px 16px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3A3A48', borderBottom: '1px solid #1A1A22' }}>
                      <span>Bet type</span>
                      <span style={{ textAlign: 'center' }}>W</span>
                      <span style={{ textAlign: 'center' }}>L</span>
                      <span style={{ textAlign: 'right' }}>Win%</span>
                      <span style={{ textAlign: 'right' }}>P&L</span>
                    </div>
                    {byBetType.slice(0, 6).map((t: any, i: number) => (
                      <div key={t.type} style={{ display: 'grid', gridTemplateColumns: '1fr 40px 40px 60px 60px', gap: '8px', padding: '10px 16px', alignItems: 'center', borderBottom: i < 5 ? '1px solid #1A1A22' : 'none' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#EDE9DF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.type}</span>
                        <span className="font-mono" style={{ fontSize: '13px', color: '#00C853', textAlign: 'center' }}>{t.wins}</span>
                        <span className="font-mono" style={{ fontSize: '13px', color: '#FF3355', textAlign: 'center' }}>{t.losses}</span>
                        <span className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: '#EDE9DF', textAlign: 'right' }}>{t.winRate}%</span>
                        <span className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: t.profit >= 0 ? '#00C853' : '#FF3355', textAlign: 'right' }}>
                          {t.profit >= 0 ? '+' : ''}{t.profit}u
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recent picks */}
            <div style={{ border: '1px solid #1A1A22', marginBottom: '48px' }}>
              <div className="font-mono" style={{ padding: '10px 20px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6860', borderBottom: '1px solid #1A1A22', background: '#0E0E12' }}>
                Recent verified predictions
              </div>
              {/* Table header */}
              <div className="font-mono hidden md:grid" style={{ gridTemplateColumns: '2fr 1.2fr 1fr 70px 70px 70px 60px', gap: '12px', padding: '8px 20px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3A3A48', borderBottom: '1px solid #1A1A22' }}>
                <span>Match</span>
                <span>Bet type</span>
                <span>Date</span>
                <span style={{ textAlign: 'right' }}>Odds</span>
                <span style={{ textAlign: 'right' }}>EV</span>
                <span style={{ textAlign: 'right' }}>P&L</span>
                <span style={{ textAlign: 'right' }}>Result</span>
              </div>
              {recent.map((r: any, i: number) => {
                const kickOff = new Date(r.kick_off).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                const borderLeft = r.result === 'win' ? '3px solid #00C853' : r.result === 'loss' ? '3px solid #FF3355' : '3px solid #3A3A48'
                return (
                  <div key={r.id} style={{
                    display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 70px 70px 70px 60px',
                    gap: '12px', padding: '14px 20px', alignItems: 'center',
                    borderBottom: i < recent.length - 1 ? '1px solid #1A1A22' : 'none',
                    borderLeft,
                  }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '13px', color: '#EDE9DF', margin: 0 }}>{r.home_team} vs {r.away_team}</p>
                      <p className="font-mono" style={{ fontSize: '10px', color: '#6B6860', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{r.league}</p>
                    </div>
                    <p style={{ fontSize: '12px', color: '#9E9B8E', margin: 0 }}>{r.bet_type}</p>
                    <p className="font-mono" style={{ fontSize: '11px', color: '#6B6860', margin: 0 }}>{kickOff}</p>
                    <p className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: '#EDE9DF', textAlign: 'right', margin: 0 }}>
                      {r.odds ? r.odds.toFixed(2) : '—'}
                    </p>
                    <p className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: '#00C853', textAlign: 'right', margin: 0 }}>
                      {r.ev_percent ? `+${r.ev_percent}%` : '—'}
                    </p>
                    <p className="font-mono" style={{ fontSize: '13px', fontWeight: 700, textAlign: 'right', margin: 0, color: r.profit_loss != null ? (r.profit_loss >= 0 ? '#00C853' : '#FF3355') : '#6B6860' }}>
                      {r.profit_loss != null ? `${r.profit_loss >= 0 ? '+' : ''}${r.profit_loss}u` : '—'}
                    </p>
                    <div style={{ textAlign: 'right' }}>
                      <ResultBadge result={r.result} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* CTA */}
            <div style={{ border: '1px solid #1A1A22', borderTop: '4px solid #F97316', padding: '40px', textAlign: 'center' }}>
              <p className="font-mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F97316', marginBottom: '12px' }}>
                Follow picks live
              </p>
              <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#EDE9DF', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                Get AI value bets, alerts and coaching.
              </h2>
              <p style={{ fontSize: '14px', color: '#6B6860', marginBottom: '28px' }}>Free to start. No card needed.</p>
              <Link href="/signup" className="font-mono" style={{
                display: 'inline-block', fontSize: '12px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
                background: '#F97316', color: '#fff', padding: '14px 32px', textDecoration: 'none',
              }}>
                Start Free →
              </Link>
            </div>
          </>
        )}
      </div>
      <PublicFooter />
    </div>
  )
}
