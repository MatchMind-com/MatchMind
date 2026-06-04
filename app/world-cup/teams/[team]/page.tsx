/**
 * /world-cup/teams/[team]
 *
 * Programmatic SEO page — one per WC team (48 pages).
 *
 * Target queries:
 *   "Brazil World Cup 2026 predictions"
 *   "[country] World Cup fixtures 2026"
 *   "France group stage 2026"
 *   "[country] vs [opponent] prediction"
 *
 * Lists the team's group, all three group-stage fixtures, and links
 * back to the group page + sibling teams.
 *
 * Generated statically via generateStaticParams.
 */

import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  getAllTeams,
  getTeamBySlug,
  getTeamEnrichment,
  teamSlug,
  type WCFixture,
  type RecentFixture,
  type SquadPlayer,
  type InjuryReport,
} from '@/lib/world-cup-data'

export const revalidate = 3600

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

export async function generateStaticParams() {
  const profiles = await getAllTeams()
  return profiles.map(p => ({ team: p.slug }))
}

export async function generateMetadata(
  { params }: { params: { team: string } },
): Promise<Metadata> {
  const profile = await getTeamBySlug(params.team)
  if (!profile) {
    return {
      title: 'World Cup 2026 Team — MatchMind',
      description: 'AI predictions for the 2026 World Cup.',
    }
  }
  const { team, group, fixtures } = profile
  const opponents = group.teams.filter(t => t.id !== team.id).map(t => t.name).join(', ')
  const title = `${team.name} — World Cup 2026 Predictions, ${group.name} Fixtures | MatchMind`
  const description = `AI value-bet predictions for ${team.name} at the 2026 World Cup. ${group.name} opponents: ${opponents}. ${fixtures.length} group-stage fixtures logged before kick-off.`
  const ogImage = `${APP_URL}/api/og/world-cup`

  return {
    title,
    description,
    alternates: { canonical: `${APP_URL}/world-cup/teams/${profile.slug}` },
    openGraph: {
      title,
      description,
      images: [ogImage],
      type: 'website',
      url: `${APP_URL}/world-cup/teams/${profile.slug}`,
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

function fmtKickoff(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/London',
    }) + ' BST'
  } catch {
    return ''
  }
}

function FixtureCard({ f, currentTeamId }: { f: WCFixture; currentTeamId: number }) {
  const isHome = f.home.id === currentTeamId
  const opponent = isHome ? f.away : f.home
  return (
    <article className="card hover:border-border-strong transition-colors">
      <p className="eyebrow text-fg-muted mb-2">
        {isHome ? 'Home' : 'Away'} · {f.round}
      </p>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-fg-muted text-sm">vs</span>
        {opponent.logo && (
          <Image src={opponent.logo} alt="" width={28} height={28} className="shrink-0" unoptimized />
        )}
        <Link
          href={`/world-cup/teams/${teamSlug(opponent.name)}`}
          className="font-display text-2xl font-black tracking-tight hover:text-brand transition-colors"
        >
          {opponent.name}
        </Link>
      </div>
      <p className="font-mono text-fg-muted text-xs mb-1">
        {fmtKickoff(f.date)}
      </p>
      {f.venue.name && (
        <p className="font-mono text-fg-muted text-xs">
          {f.venue.name}{f.venue.city ? ` · ${f.venue.city}` : ''}
        </p>
      )}
    </article>
  )
}

function FormPill({ r }: { r: RecentFixture }) {
  const color = r.result === 'W' ? 'bg-success/15 text-success border-success/30'
    : r.result === 'L' ? 'bg-loss/15 text-loss border-loss/30'
    : r.result === 'D' ? 'bg-fg-muted/15 text-fg-muted border-fg-muted/30'
    : 'bg-bg-elevated text-fg-muted border-border-subtle'
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 text-xs font-black border ${color}`} title={`${r.result} vs ${r.opponent}`}>
      {r.result}
    </span>
  )
}

function FormRow({ r, currentTeamName }: { r: RecentFixture; currentTeamName: string }) {
  const scoreStr = (r.goalsFor !== null && r.goalsAgainst !== null) ? `${r.goalsFor}-${r.goalsAgainst}` : '—'
  const date = (() => {
    try { return new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return '' }
  })()
  return (
    <li className="flex items-center gap-3 py-3 border-b border-border-subtle last:border-0">
      <FormPill r={r} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">
          {r.isHome ? currentTeamName : r.opponent} <span className="font-mono text-fg-muted text-xs mx-1">{scoreStr}</span> {r.isHome ? r.opponent : currentTeamName}
        </p>
        <p className="text-fg-muted text-[11px] font-mono">{date} · {r.isHome ? 'Home' : 'Away'}</p>
      </div>
    </li>
  )
}

function SquadGroup({ title, players }: { title: string; players: SquadPlayer[] }) {
  if (players.length === 0) return null
  return (
    <div>
      <p className="eyebrow mb-2">{title} ({players.length})</p>
      <ul className="space-y-1.5">
        {players.map(p => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            {p.number !== null && (
              <span className="font-mono text-fg-muted text-[11px] w-6 text-right tabular-nums">{p.number}</span>
            )}
            <span className="text-fg">{p.name}</span>
            {p.age !== null && (
              <span className="font-mono text-fg-muted text-[11px] ml-auto">{p.age}y</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function TeamPage({ params }: { params: { team: string } }) {
  const profile = await getTeamBySlug(params.team)
  if (!profile) notFound()
  const { team, group, fixtures } = profile

  const teammates = group.teams.filter(t => t.id !== team.id)

  // Editorial enrichment — form, squad, injuries.
  // Fails soft per-section: if API-Football returns nothing for a smaller
  // nation, those sections just don't render.
  const enrichment = await getTeamEnrichment(team.id)
  const wins = enrichment.form.filter(f => f.result === 'W').length
  const draws = enrichment.form.filter(f => f.result === 'D').length
  const losses = enrichment.form.filter(f => f.result === 'L').length

  const squadByPosition = {
    goalkeepers: enrichment.squad.filter(p => p.position === 'Goalkeeper'),
    defenders: enrichment.squad.filter(p => p.position === 'Defender'),
    midfielders: enrichment.squad.filter(p => p.position === 'Midfielder'),
    attackers: enrichment.squad.filter(p => p.position === 'Attacker'),
  }

  return (
    <main className="min-h-screen bg-bg-base text-fg">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 pt-10 lg:pt-16 pb-20">

        {/* Breadcrumb */}
        <nav className="text-fg-muted text-xs mb-6 flex gap-2 items-center flex-wrap">
          <Link href="/" className="hover:text-brand transition-colors">MatchMind</Link>
          <span>·</span>
          <Link href="/world-cup" className="hover:text-brand transition-colors">World Cup 2026</Link>
          <span>·</span>
          <Link href={`/world-cup/groups/${group.slug}`} className="hover:text-brand transition-colors">
            {group.name}
          </Link>
          <span>·</span>
          <span className="text-fg-secondary">{team.name}</span>
        </nav>

        {/* Hero */}
        <p className="eyebrow text-brand mb-3">FIFA World Cup 2026 · {group.name}</p>
        <div className="flex items-center gap-5 mb-6">
          {team.logo && (
            <Image
              src={team.logo}
              alt={`${team.name} flag`}
              width={72}
              height={72}
              className="shrink-0"
              unoptimized
            />
          )}
          <h1 className="font-display text-5xl md:text-7xl font-black tracking-tight leading-[1.05]">
            {team.name}
          </h1>
        </div>
        <p className="text-fg-secondary text-lg max-w-2xl mb-10 leading-relaxed">
          AI value-bet predictions for {team.name}&apos;s {fixtures.length} group-stage fixtures at the
          2026 World Cup. Picks are logged before kick-off and results published publicly.
        </p>

        {/* Group-stage fixtures */}
        <section className="mb-12">
          <p className="eyebrow mb-4">Group-stage schedule</p>
          {fixtures.length === 0 ? (
            <p className="text-fg-muted text-sm">Fixtures will appear here once the draw data syncs.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {fixtures.map(f => (
                <FixtureCard key={f.id} f={f} currentTeamId={team.id} />
              ))}
            </div>
          )}
        </section>

        {/* Recent form — last 5 games */}
        {enrichment.form.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <p className="eyebrow">Form — last 5</p>
              <p className="font-mono text-xs text-fg-muted tabular-nums">
                <span className="text-success">{wins}W</span>
                <span className="mx-1">·</span>
                <span className="text-fg-muted">{draws}D</span>
                <span className="mx-1">·</span>
                <span className="text-loss">{losses}L</span>
              </p>
            </div>
            <div className="card">
              <ul>
                {enrichment.form.map((f, i) => (
                  <FormRow key={`${f.date}-${i}`} r={f} currentTeamName={team.name} />
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Injuries / unavailable */}
        {enrichment.injuries.length > 0 && (
          <section className="mb-12">
            <p className="eyebrow mb-4">Injuries / unavailable</p>
            <div className="card">
              <ul className="space-y-2">
                {enrichment.injuries.map((i, idx) => (
                  <li key={`${i.player}-${idx}`} className="flex items-baseline gap-3 text-sm">
                    <span className="font-semibold">{i.player}</span>
                    <span className="text-fg-muted text-xs">{i.reason}</span>
                    <span className="ml-auto text-loss text-[10px] font-bold uppercase tracking-wider">
                      {i.type}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Squad */}
        {enrichment.squad.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <p className="eyebrow">Squad ({enrichment.squad.length})</p>
              <p className="text-fg-muted text-[10px] font-mono">via API-Football</p>
            </div>
            <div className="card grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
              <SquadGroup title="Goalkeepers" players={squadByPosition.goalkeepers} />
              <SquadGroup title="Defenders" players={squadByPosition.defenders} />
              <SquadGroup title="Midfielders" players={squadByPosition.midfielders} />
              <SquadGroup title="Attackers" players={squadByPosition.attackers} />
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="border border-border-subtle p-6 md:p-8 bg-bg-surface mb-12">
          <h2 className="font-display text-2xl md:text-3xl font-black tracking-tight mb-3">
            Free {team.name} predictions every morning
          </h2>
          <p className="text-fg-secondary mb-5 max-w-2xl">
            One email per morning during the tournament with every value bet our AI finds — including
            every {team.name} fixture. No card, no spam.
          </p>
          <Link
            href="/world-cup#email-capture"
            className="inline-block bg-brand hover:bg-brand-hover text-bg-base font-black text-xs uppercase tracking-[0.1em] px-7 py-4 transition-colors"
          >
            Get free WC picks →
          </Link>
        </section>

        {/* Sibling teams */}
        <section className="pt-8 border-t border-border-subtle">
          <p className="eyebrow mb-4">Other {group.name} teams</p>
          <div className="grid grid-cols-3 gap-3">
            {teammates.map(t => (
              <Link
                key={t.id}
                href={`/world-cup/teams/${teamSlug(t.name)}`}
                className="card hover:border-border-strong transition-colors flex items-center gap-3 group"
              >
                {t.logo && (
                  <Image src={t.logo} alt="" width={24} height={24} className="shrink-0" unoptimized />
                )}
                <span className="font-semibold truncate group-hover:text-brand transition-colors text-sm">
                  {t.name}
                </span>
              </Link>
            ))}
          </div>
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
