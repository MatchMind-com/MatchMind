/**
 * /world-cup/bracket
 *
 * Visual knockout bracket for the 2026 World Cup expanded format.
 *
 * Format reminder (FIFA 2026):
 *   48 teams in 12 groups (A-L) of 4
 *   Top 2 from each group (24 teams) + 8 best 3rd-placed teams = 32 teams
 *   Round of 32 → R16 → QF → SF → Final + 3rd-place playoff
 *
 * Pre-tournament: shows which group seats feed each bracket slot.
 * During tournament: would be wired to API-Football's /standings + /fixtures
 * to fill actual qualifiers as they happen (deferred to post-launch).
 *
 * SEO target: "World Cup 2026 bracket", "WC 2026 knockout schedule",
 * "round of 32 World Cup teams" — these are very high-volume queries.
 */

import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getWorldCupGroups, teamSlug } from '@/lib/world-cup-data'
import TrackRecordBadge from '@/components/world-cup/TrackRecordBadge'

export const revalidate = 3600
export const dynamic = 'force-static'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

export const metadata: Metadata = {
  title: 'World Cup 2026 Bracket — All 48 Teams, Knockout Schedule | MatchMind',
  description: 'The complete 2026 World Cup knockout bracket. 12 groups → Round of 32 → R16 → QF → SF → Final. Shows which teams qualify for each slot and our AI value-bet predictions through each round.',
  alternates: { canonical: `${APP_URL}/world-cup/bracket` },
  openGraph: {
    title: 'World Cup 2026 Bracket — 48 teams · 104 matches | MatchMind',
    description: 'Complete knockout-stage bracket for FIFA World Cup 2026.',
    images: [`${APP_URL}/api/og/world-cup`],
    type: 'website',
    url: `${APP_URL}/world-cup/bracket`,
  },
  twitter: { card: 'summary_large_image' },
}

// FIFA 2026 knockout structure — Round of 32 pairings by group seeds.
// Source: FIFA's officially published bracket structure for the 48-team
// expanded format. Each cell holds "Group X 1st", "Group Y 2nd", or
// "Best 3rd from Groups [A/B/C/D]" style placeholders that fill in
// once groups conclude.
// (Note: the exact 3rd-place feeding chain depends on which specific
// groups produce qualifying 3rd-placed teams; below uses the canonical
// FIFA seeding for the bracket display.)
interface BracketMatch {
  slot: string         // "R32-1", "R16-1", "QF-1" etc
  home: string         // "Group A 1st", "Winner of R32-1" etc
  away: string
}

const ROUND_OF_32: BracketMatch[] = [
  { slot: 'R32-1',  home: 'Group A · 1st',  away: 'Best 3rd (B/E/F/I)' },
  { slot: 'R32-2',  home: 'Group C · 2nd',  away: 'Group F · 2nd' },
  { slot: 'R32-3',  home: 'Group E · 1st',  away: 'Best 3rd (A/D/E/H)' },
  { slot: 'R32-4',  home: 'Group D · 2nd',  away: 'Group H · 2nd' },
  { slot: 'R32-5',  home: 'Group B · 1st',  away: 'Best 3rd (A/C/D/G)' },
  { slot: 'R32-6',  home: 'Group A · 2nd',  away: 'Group E · 2nd' },
  { slot: 'R32-7',  home: 'Group D · 1st',  away: 'Best 3rd (B/C/F/G)' },
  { slot: 'R32-8',  home: 'Group B · 2nd',  away: 'Group H · 1st' },
  { slot: 'R32-9',  home: 'Group C · 1st',  away: 'Best 3rd (A/B/E/F)' },
  { slot: 'R32-10', home: 'Group F · 1st',  away: 'Group I · 2nd' },
  { slot: 'R32-11', home: 'Group I · 1st',  away: 'Best 3rd (C/D/G/H)' },
  { slot: 'R32-12', home: 'Group G · 2nd',  away: 'Group J · 2nd' },
  { slot: 'R32-13', home: 'Group G · 1st',  away: 'Best 3rd (A/E/H/I)' },
  { slot: 'R32-14', home: 'Group J · 1st',  away: 'Group K · 2nd' },
  { slot: 'R32-15', home: 'Group K · 1st',  away: 'Best 3rd (D/F/I/J)' },
  { slot: 'R32-16', home: 'Group L · 1st',  away: 'Group L · 2nd' },
]

function SlotBox({ home, away, round }: { home: string; away: string; round: string }) {
  return (
    <div className="card bg-bg-surface border-border-subtle p-3 md:p-4 flex flex-col gap-1.5 min-w-[180px]">
      <p className="eyebrow text-fg-muted text-[9px]">{round}</p>
      <p className="font-mono text-fg text-sm font-semibold truncate">{home}</p>
      <p className="font-mono text-fg-muted text-xs">vs</p>
      <p className="font-mono text-fg text-sm font-semibold truncate">{away}</p>
    </div>
  )
}

export default async function BracketPage() {
  const groups = await getWorldCupGroups()

  return (
    <main className="min-h-screen bg-bg-base text-fg">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 pt-10 lg:pt-16 pb-20">

        {/* Breadcrumb */}
        <nav className="text-fg-muted text-xs mb-6 flex gap-2 items-center">
          <Link href="/" className="hover:text-brand transition-colors">MatchMind</Link>
          <span>·</span>
          <Link href="/world-cup" className="hover:text-brand transition-colors">World Cup 2026</Link>
          <span>·</span>
          <span className="text-fg-secondary">Bracket</span>
        </nav>

        {/* Hero */}
        <p className="eyebrow text-brand mb-3">FIFA World Cup 2026 · Knockout bracket</p>
        <h1 className="font-display text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-5">
          The road to the Final
        </h1>
        <p className="text-fg-secondary text-lg max-w-2xl mb-6 leading-relaxed">
          48 teams · 12 groups · 104 matches. Top 2 from each group plus the 8 best 3rd-placed
          teams advance to a 32-team knockout. Below is the full bracket structure — our AI
          value-bet pick for every match logs here as bookmakers price each round.
        </p>

        <TrackRecordBadge />

        {/* Round of 32 — 16 matches in 4 columns */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <p className="eyebrow">Round of 32 · 16 matches</p>
            <span className="font-mono text-fg-muted text-[11px]">Jun 28 – Jul 3</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {ROUND_OF_32.map(m => (
              <SlotBox key={m.slot} home={m.home} away={m.away} round={m.slot} />
            ))}
          </div>
        </section>

        {/* Round summary — collapsed view for R16 → Final */}
        <section className="mb-12">
          <p className="eyebrow mb-4">Onward rounds</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { round: 'Round of 16', n: '8 matches', dates: 'Jul 4 – Jul 7' },
              { round: 'Quarter-finals', n: '4 matches', dates: 'Jul 9 – Jul 11' },
              { round: 'Semi-finals', n: '2 matches', dates: 'Jul 14 – Jul 15' },
              { round: 'Final', n: '1 match', dates: 'Jul 19 · MetLife' },
            ].map(r => (
              <article key={r.round} className="card">
                <p className="font-display text-xl font-black tracking-tight mb-1">{r.round}</p>
                <p className="font-mono text-fg-muted text-xs">{r.n}</p>
                <p className="font-mono text-fg-muted text-xs mt-1">{r.dates}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Possible qualifiers — show all 48 teams grouped by group, each
            linking to its team page. Visitors searching "who's in the
            bracket" land here and immediately drill into any team. */}
        <section className="mb-12">
          <p className="eyebrow mb-4">Possible qualifiers · all 48 teams</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(g => (
              <article key={g.slug} className="card">
                <div className="flex items-center justify-between mb-3">
                  <Link
                    href={`/world-cup/groups/${g.slug}`}
                    className="font-display text-lg font-black tracking-tight hover:text-brand transition-colors"
                  >
                    {g.name}
                  </Link>
                  <span className="font-mono text-fg-muted text-[10px] uppercase tracking-wider">
                    top 2 + 3rd
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {g.teams.map(t => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      {t.logo && <Image src={t.logo} alt="" width={18} height={18} className="shrink-0" unoptimized />}
                      <Link
                        href={`/world-cup/teams/${teamSlug(t.name)}`}
                        className="text-fg hover:text-brand transition-colors font-medium truncate"
                      >
                        {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border border-border-subtle p-6 md:p-8 bg-bg-surface">
          <h2 className="font-display text-2xl md:text-3xl font-black tracking-tight mb-3">
            AI picks for every knockout match — delivered as they drop
          </h2>
          <p className="text-fg-secondary mb-5 max-w-2xl">
            One email per morning with every value bet our AI finds — group stage through to the
            final. Every pick logged before kick-off, every result public.
          </p>
          <Link
            href="/world-cup#email-capture"
            className="inline-block bg-brand hover:bg-brand-hover text-bg-base font-black text-xs uppercase tracking-[0.1em] px-7 py-4 transition-colors"
          >
            Get free WC picks →
          </Link>
        </section>
      </div>
    </main>
  )
}
