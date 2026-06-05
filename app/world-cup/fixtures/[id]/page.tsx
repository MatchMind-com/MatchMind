/**
 * /world-cup/fixtures/[id]
 *
 * Programmatic SEO page — one per group-stage fixture (72 pages).
 *
 * Target queries:
 *   "Brazil vs Mexico World Cup 2026 prediction"
 *   "Spain vs Sweden predictions"
 *   "[team A] vs [team B] kickoff time"
 *
 * Each page combines:
 *   - Match header (flags, kickoff, venue, group)
 *   - AI pick if the predictions cache has a value bet for this id,
 *     otherwise "Odds release closer to kickoff" (honest)
 *   - Both teams' last 5 form
 *   - Internal links to both team pages + group page
 *
 * Built statically via generateStaticParams. Falls back to dynamic
 * render if a new fixture is added between deploys.
 */

import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  getAllFixtures,
  getFixtureById,
  getTeamEnrichment,
  teamSlug,
  type RecentFixture,
} from '@/lib/world-cup-data'

export const revalidate = 3600
export const dynamicParams = true

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

export async function generateStaticParams() {
  const fixtures = await getAllFixtures()
  return fixtures.map(f => ({ id: String(f.id) }))
}

export async function generateMetadata(
  { params }: { params: { id: string } },
): Promise<Metadata> {
  const id = parseInt(params.id, 10)
  const data = Number.isFinite(id) ? await getFixtureById(id) : null
  if (!data) {
    return {
      title: 'World Cup 2026 Fixture — MatchMind',
      description: 'AI predictions for the 2026 World Cup.',
    }
  }
  const { fixture } = data
  const title = `${fixture.home.name} vs ${fixture.away.name} — World Cup 2026 Prediction | MatchMind`
  const description = `AI value-bet prediction for ${fixture.home.name} vs ${fixture.away.name} at the 2026 World Cup. Kick-off ${fmtKickoffLong(fixture.date)}${fixture.venue.name ? ` · ${fixture.venue.name}` : ''}.`
  const ogImage = `${APP_URL}/api/og/wc-team?slug=${teamSlug(fixture.home.name)}`
  return {
    title,
    description,
    alternates: { canonical: `${APP_URL}/world-cup/fixtures/${id}` },
    openGraph: { title, description, images: [ogImage], type: 'website', url: `${APP_URL}/world-cup/fixtures/${id}` },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

function fmtKickoffLong(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
    }) + ' BST'
  } catch { return '' }
}

function FormPills({ form, teamName }: { form: RecentFixture[]; teamName: string }) {
  if (!form.length) return <p className="text-fg-muted text-xs">No recent form data.</p>
  const wins = form.filter(f => f.result === 'W').length
  const draws = form.filter(f => f.result === 'D').length
  const losses = form.filter(f => f.result === 'L').length
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {form.map((f, i) => {
          const color = f.result === 'W' ? 'bg-success/15 text-success border-success/30'
            : f.result === 'L' ? 'bg-loss/15 text-loss border-loss/30'
            : 'bg-fg-muted/15 text-fg-muted border-fg-muted/30'
          return (
            <span
              key={`${teamName}-${i}`}
              className={`inline-flex items-center justify-center w-7 h-7 text-[11px] font-black border ${color}`}
              title={`${f.result} vs ${f.opponent}`}
            >
              {f.result}
            </span>
          )
        })}
        <span className="font-mono text-fg-muted text-xs ml-2 tabular-nums">
          <span className="text-success">{wins}W</span>
          <span className="mx-1">·</span>
          <span>{draws}D</span>
          <span className="mx-1">·</span>
          <span className="text-loss">{losses}L</span>
        </span>
      </div>
      <ul className="text-xs space-y-1">
        {form.slice(0, 5).map((f, i) => (
          <li key={i} className="text-fg-muted">
            <span className="font-mono">{new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            <span className="mx-2">·</span>
            <span className="text-fg">{f.isHome ? teamName : f.opponent}</span>
            <span className="font-mono mx-2">{f.goalsFor}-{f.goalsAgainst}</span>
            <span>{f.isHome ? f.opponent : teamName}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function FixturePage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  const data = Number.isFinite(id) ? await getFixtureById(id) : null
  if (!data) notFound()
  const { fixture, group } = data

  // Pull form for both teams in parallel — failing soft per side.
  const [homeEnr, awayEnr] = await Promise.all([
    getTeamEnrichment(fixture.home.id).catch(() => null),
    getTeamEnrichment(fixture.away.id).catch(() => null),
  ])

  return (
    <main className="min-h-screen bg-bg-base text-fg">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 pt-10 lg:pt-16 pb-20">

        {/* Breadcrumb */}
        <nav className="text-fg-muted text-xs mb-6 flex gap-2 items-center flex-wrap">
          <Link href="/" className="hover:text-brand transition-colors">MatchMind</Link>
          <span>·</span>
          <Link href="/world-cup" className="hover:text-brand transition-colors">World Cup 2026</Link>
          <span>·</span>
          <Link href={`/world-cup/groups/${group.slug}`} className="hover:text-brand transition-colors">{group.name}</Link>
          <span>·</span>
          <span className="text-fg-secondary">{fixture.home.name} v {fixture.away.name}</span>
        </nav>

        {/* Hero */}
        <p className="eyebrow text-brand mb-3">FIFA World Cup 2026 · {group.name} · {fixture.round}</p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-center mb-6">
          {/* Home */}
          <Link
            href={`/world-cup/teams/${teamSlug(fixture.home.name)}`}
            className="flex items-center gap-4 hover:text-brand transition-colors group min-w-0"
          >
            {fixture.home.logo && <Image src={fixture.home.logo} alt="" width={56} height={56} className="shrink-0" unoptimized />}
            <span className="font-display text-2xl md:text-4xl font-black tracking-tight truncate">
              {fixture.home.name}
            </span>
          </Link>
          <span className="text-fg-muted text-sm md:text-base text-center font-mono uppercase tracking-widest">vs</span>
          {/* Away */}
          <Link
            href={`/world-cup/teams/${teamSlug(fixture.away.name)}`}
            className="flex items-center gap-4 hover:text-brand transition-colors group min-w-0 md:justify-end"
          >
            <span className="font-display text-2xl md:text-4xl font-black tracking-tight truncate md:text-right">
              {fixture.away.name}
            </span>
            {fixture.away.logo && <Image src={fixture.away.logo} alt="" width={56} height={56} className="shrink-0" unoptimized />}
          </Link>
        </div>

        <div className="mb-10">
          <p className="text-fg-secondary text-base">
            <span className="font-mono">{fmtKickoffLong(fixture.date)}</span>
            {fixture.venue.name && (
              <>
                <span className="text-fg-muted mx-3">·</span>
                <span>{fixture.venue.name}{fixture.venue.city ? `, ${fixture.venue.city}` : ''}</span>
              </>
            )}
          </p>
        </div>

        {/* AI pick placeholder — actual pick wiring would pull from
            prediction_records once WC odds drop. For now, a clean
            "odds release closer to kickoff" note keeps the page honest. */}
        <section className="card mb-12 bg-bg-elevated">
          <div className="flex items-center gap-3">
            <span className="text-brand text-2xl leading-none">⚡</span>
            <div>
              <p className="font-semibold text-fg">AI prediction publishes 24h before kick-off</p>
              <p className="text-fg-muted text-sm mt-1">
                Bookmakers don&apos;t typically price World Cup fixtures more than ~3 days out. The
                AI value bet for this match will appear here as soon as odds drop —
                logged before kick-off, result published after full-time.
              </p>
            </div>
          </div>
        </section>

        {/* Form — both teams side by side */}
        <section className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">{fixture.home.name} · last 5</p>
              <Link href={`/world-cup/teams/${teamSlug(fixture.home.name)}`} className="text-brand text-[11px] font-bold uppercase tracking-widest hover:underline">
                Full squad →
              </Link>
            </div>
            <FormPills form={homeEnr?.form ?? []} teamName={fixture.home.name} />
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">{fixture.away.name} · last 5</p>
              <Link href={`/world-cup/teams/${teamSlug(fixture.away.name)}`} className="text-brand text-[11px] font-bold uppercase tracking-widest hover:underline">
                Full squad →
              </Link>
            </div>
            <FormPills form={awayEnr?.form ?? []} teamName={fixture.away.name} />
          </div>
        </section>

        {/* Email capture CTA */}
        <section className="border border-border-subtle p-6 md:p-8 bg-bg-surface mb-12">
          <h2 className="font-display text-2xl md:text-3xl font-black tracking-tight mb-3">
            {fixture.home.name} v {fixture.away.name} pick — delivered when it drops
          </h2>
          <p className="text-fg-secondary mb-5 max-w-2xl">
            One morning email during the tournament with every value bet our AI finds. No card,
            no spam — your address comes off the list with one click.
          </p>
          <Link
            href="/world-cup#email-capture"
            className="inline-block bg-brand hover:bg-brand-hover text-bg-base font-black text-xs uppercase tracking-[0.1em] px-7 py-4 transition-colors"
          >
            Get free WC picks →
          </Link>
        </section>

        {/* Other fixtures in this group */}
        <section className="pt-8 border-t border-border-subtle">
          <p className="eyebrow mb-4">Other {group.name} fixtures</p>
          <ul className="space-y-2">
            {group.fixtures.filter(f => f.id !== fixture.id).slice(0, 5).map(f => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link
                  href={`/world-cup/fixtures/${f.id}`}
                  className="text-fg hover:text-brand transition-colors font-medium truncate"
                >
                  {f.home.name} <span className="text-fg-muted">v</span> {f.away.name}
                </Link>
                <span className="font-mono text-fg-muted text-[11px] whitespace-nowrap">
                  {fmtKickoffLong(f.date).split(',')[1]?.trim() ?? ''}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Link
              href={`/world-cup/groups/${group.slug}`}
              className="text-brand text-xs font-bold uppercase tracking-[0.12em] hover:underline"
            >
              See full {group.name} →
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
