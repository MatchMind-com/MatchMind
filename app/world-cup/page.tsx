/**
 * /world-cup
 *
 * Tournament landing page — the single bio-link destination for TikTok /
 * Twitter / Reddit traffic during the 2026 World Cup ramp.
 *
 * Conversion-focused: countdown above the fold, email capture as the
 * primary CTA ("free WC predictions delivered daily"), then 12 group
 * cards for content depth + SEO. No login wall — visitors who care can
 * leave their email and start receiving picks the morning matches begin.
 *
 * Data: fetched server-side from API-Football (league=1, season=2026)
 * with 1hr ISR. The 72 group-stage fixtures + standings are draw-locked
 * so cache aggressively — only re-fetch if the draw is amended (rare).
 */
import Link from 'next/link'
import { Suspense } from 'react'
import EmailCapture from './email-capture'

export const revalidate = 3600 // 1 hour — fixtures don't move once drawn
export const dynamic = 'force-static'

const WORLD_CUP_KICKOFF = '2026-06-11T19:00:00+00:00'
const API_KEY = process.env.API_FOOTBALL_KEY!
const API_BASE = 'https://v3.football.api-sports.io'

// ── Data fetching ──────────────────────────────────────────────────────

interface Fixture {
  id: number
  date: string
  venue: { city: string | null; name: string | null }
  round: string
  home: { id: number; name: string; logo: string }
  away: { id: number; name: string; logo: string }
}

interface Group {
  name: string  // "Group A" .. "Group L"
  teams: Array<{ id: number; name: string; logo: string }>
  fixtures: Fixture[]
}

async function fetchFixtures(): Promise<Fixture[]> {
  try {
    const res = await fetch(`${API_BASE}/fixtures?league=1&season=2026`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.response ?? []).map((f: any) => ({
      id: f.fixture?.id,
      date: f.fixture?.date,
      venue: { city: f.fixture?.venue?.city ?? null, name: f.fixture?.venue?.name ?? null },
      round: f.league?.round ?? '?',
      home: { id: f.teams?.home?.id, name: f.teams?.home?.name, logo: f.teams?.home?.logo },
      away: { id: f.teams?.away?.id, name: f.teams?.away?.name, logo: f.teams?.away?.logo },
    }))
  } catch {
    return []
  }
}

/**
 * Pre-WC friendlies fixture — same shape as a group-stage Fixture but
 * comes from league=10 (Friendlies Intl) instead of league=1 (WC).
 * Filtered to fixtures involving at least one WC team for relevance.
 */
async function fetchFriendlies(): Promise<Fixture[]> {
  try {
    // Calendar year season for tournaments/intl friendlies — same fix as
    // the cron's per-league season logic. Hardcoded since this page only
    // runs in calendar 2026 (will need an update if WC moves to 2027 etc).
    const res = await fetch(`${API_BASE}/fixtures?league=10&season=2026`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.response ?? []).map((f: any) => ({
      id: f.fixture?.id,
      date: f.fixture?.date,
      venue: { city: f.fixture?.venue?.city ?? null, name: f.fixture?.venue?.name ?? null },
      round: f.league?.round ?? 'Friendly',
      home: { id: f.teams?.home?.id, name: f.teams?.home?.name, logo: f.teams?.home?.logo },
      away: { id: f.teams?.away?.id, name: f.teams?.away?.name, logo: f.teams?.away?.logo },
    }))
  } catch {
    return []
  }
}

async function fetchGroupAssignments(): Promise<Map<string, Array<{ id: number; name: string; logo: string }>>> {
  try {
    const res = await fetch(`${API_BASE}/standings?league=1&season=2026`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return new Map()
    const json = await res.json()
    const leagues = json.response ?? []
    if (!leagues[0]?.league?.standings) return new Map()
    const map = new Map<string, Array<{ id: number; name: string; logo: string }>>()
    for (const groupRows of leagues[0].league.standings) {
      if (!Array.isArray(groupRows) || groupRows.length === 0) continue
      const groupName: string = groupRows[0].group
      if (!groupName?.startsWith('Group ')) continue
      map.set(
        groupName,
        groupRows.map((r: any) => ({
          id: r.team?.id,
          name: r.team?.name,
          logo: r.team?.logo,
        })),
      )
    }
    return map
  } catch {
    return new Map()
  }
}

/**
 * Filter the full friendlies list down to fixtures involving at least one
 * WC-qualified team, kicking off between now and WC kickoff. These are the
 * "pre-tournament tune-ups" — what every WC nation is playing this week.
 *
 * Includes fixtures where EITHER team is a WC team (so France v Ivory
 * Coast surfaces — France is the WC team) and excludes already-played.
 */
function filterRelevantFriendlies(
  friendlies: Fixture[],
  groupAssignments: Map<string, Array<{ id: number; name: string; logo: string }>>,
  wcKickoffISO: string,
): Fixture[] {
  const wcTeamIds = new Set<number>()
  for (const teams of groupAssignments.values()) {
    for (const t of teams) wcTeamIds.add(t.id)
  }
  const nowMs = Date.now()
  const wcKickoffMs = new Date(wcKickoffISO).getTime()
  return friendlies
    .filter((f) => {
      const t = new Date(f.date).getTime()
      if (!Number.isFinite(t)) return false
      if (t < nowMs) return false             // already kicked off
      if (t > wcKickoffMs) return false       // after WC starts — irrelevant
      return wcTeamIds.has(f.home.id) || wcTeamIds.has(f.away.id)
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function organizeIntoGroups(
  fixtures: Fixture[],
  groupAssignments: Map<string, Array<{ id: number; name: string; logo: string }>>,
): Group[] {
  const teamIdToGroup = new Map<number, string>()
  for (const [groupName, teams] of groupAssignments.entries()) {
    for (const t of teams) teamIdToGroup.set(t.id, groupName)
  }
  const groups: Group[] = Array.from(groupAssignments.entries()).map(([name, teams]) => ({
    name,
    teams,
    fixtures: [],
  }))
  const groupByName = new Map(groups.map((g) => [g.name, g]))
  for (const f of fixtures) {
    const groupName = teamIdToGroup.get(f.home.id)
    if (!groupName) continue
    const g = groupByName.get(groupName)
    if (!g) continue
    g.fixtures.push(f)
  }
  for (const g of groups) {
    g.fixtures.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }
  groups.sort((a, b) => a.name.localeCompare(b.name))
  return groups
}

// ── Format helpers ─────────────────────────────────────────────────────

function fmtKickoffShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

// ── Page metadata ──────────────────────────────────────────────────────

export const metadata = {
  title: 'AI predictions for the 2026 World Cup — free every day | MatchMind',
  description:
    'Daily AI-powered predictions and value bets for every match of the FIFA World Cup 2026. Free during the tournament. 48 teams, 12 groups, 104 matches — every one analysed.',
  openGraph: {
    title: 'AI predictions for the 2026 World Cup — free every day',
    description:
      'Every match analysed by GPT-4 + live odds. Group previews, value bets, knockout brackets. Free daily during the tournament.',
    images: ['/api/og/world-cup'],
    url: 'https://www.matchmindcom.com/world-cup',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI predictions for the 2026 World Cup — free every day',
    description: 'Every match analysed by GPT-4 + live odds. Free during the tournament.',
    images: ['/api/og/world-cup'],
  },
}

// ── Page ───────────────────────────────────────────────────────────────

export default async function WorldCupPage() {
  const [fixtures, groupAssignments, friendlies] = await Promise.all([
    fetchFixtures(),
    fetchGroupAssignments(),
    fetchFriendlies(),
  ])
  const groups = organizeIntoGroups(fixtures, groupAssignments)
  const tuneUps = filterRelevantFriendlies(friendlies, groupAssignments, WORLD_CUP_KICKOFF)
  const days = daysUntil(WORLD_CUP_KICKOFF)
  const totalMatches = fixtures.length + 32 // 72 group + 32 knockout

  return (
    <main className="min-h-screen bg-bg-base text-fg">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand/10 via-bg-base to-bg-base" aria-hidden />
        <div className="relative max-w-5xl mx-auto px-5 lg:px-8 pt-10 lg:pt-20 pb-12 lg:pb-16">
          <Link href="/" className="inline-flex items-center gap-2 text-fg-muted hover:text-brand text-sm font-medium mb-8">
            <span>←</span>
            <span>MatchMind</span>
          </Link>

          <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/30 rounded-full px-3 py-1 mb-6">
            <span className="text-brand text-xs font-bold uppercase tracking-widest">FIFA World Cup 2026</span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            Every match of the World Cup.
            <br />
            <span className="text-brand">AI-analysed.</span> Free every day.
          </h1>

          <p className="text-fg-secondary text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
            48 teams · 12 groups · {totalMatches}+ matches across USA, Canada and Mexico.
            One email per morning during the tournament with every value bet our AI finds —
            grouped by group, ranked by edge, fully tracked.
          </p>

          {/* Countdown */}
          <div className="flex flex-wrap items-baseline gap-3 mb-10">
            <span className="font-stat text-brand text-6xl md:text-7xl font-black tabular-nums leading-none">
              {days}
            </span>
            <span className="text-fg-muted text-lg font-medium">
              {days === 1 ? 'day' : 'days'} until kickoff — Mexico v South Africa, Estadio Azteca
            </span>
          </div>

          {/* Email capture — the conversion */}
          <EmailCapture />

          {/* Trust strip */}
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-fg-muted">
            <span className="flex items-center gap-2"><span className="text-success">✓</span> Free during the tournament</span>
            <span className="flex items-center gap-2"><span className="text-success">✓</span> Unsubscribe in one click</span>
            <span className="flex items-center gap-2"><span className="text-success">✓</span> Every pick publicly tracked</span>
          </div>
        </div>
      </section>

      {/* ── Pre-tournament tune-ups ── */}
      {/* Shown right after the hero because these matches kick off TODAY
          and tomorrow — most urgent content on the page. Stable for the
          next 9 days through to WC kickoff, then this section becomes
          empty (no WC-team friendlies after the tournament starts). */}
      {tuneUps.length > 0 && (
        <section className="border-t border-border-subtle bg-bg-surface">
          <div className="max-w-5xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
            <div className="flex items-baseline justify-between flex-wrap gap-4 mb-3">
              <p className="eyebrow">Pre-tournament tune-ups</p>
              <span className="text-fg-muted text-xs font-medium">
                {tuneUps.length} match{tuneUps.length === 1 ? '' : 'es'} · refreshed hourly
              </span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-black mb-3 max-w-2xl">
              Every WC team is playing this week.
            </h2>
            <p className="text-fg-secondary text-base mb-12 max-w-2xl">
              International friendlies before kickoff are where the real squad shape leaks —
              new caps, recovering injuries, set-piece routines. All times UK local.
            </p>

            <ul className="grid md:grid-cols-2 gap-3">
              {tuneUps.slice(0, 12).map((f) => (
                <FriendlyRow key={f.id} fixture={f} />
              ))}
            </ul>

            {tuneUps.length > 12 && (
              <p className="text-fg-muted text-xs mt-6">
                + {tuneUps.length - 12} more WC-team friendlies in the next 9 days.
                Full daily breakdown lands in your inbox once you sign up above.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── What you'll get ── */}
      <section className="border-t border-border-subtle bg-bg-surface">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
          <p className="eyebrow mb-3">What lands in your inbox</p>
          <h2 className="font-display text-3xl md:text-4xl font-black mb-12 max-w-2xl">
            One morning email. Every value bet. No fluff.
          </h2>
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            <Feature
              eyebrow="Every morning"
              title="Today's value picks"
              body="Ranked by EV against live Pinnacle + Bet365 odds. We only highlight bets where the market is mispricing — usually 3-6 per matchday."
            />
            <Feature
              eyebrow="Per match"
              title="GPT-4 + live data"
              body="Lineups, form, xG, head-to-head, key injuries. Every pick comes with the reasoning so you can fade us if you disagree."
            />
            <Feature
              eyebrow="Fully tracked"
              title="Public results"
              body="Every prediction logged before kickoff, settled after. No survivorship bias. See the misses as clearly as the wins."
            />
          </div>
        </div>
      </section>

      {/* ── Groups ── */}
      <section>
        <div className="max-w-5xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
          <p className="eyebrow mb-3">The Draw</p>
          <h2 className="font-display text-3xl md:text-4xl font-black mb-3 max-w-2xl">
            12 groups, 48 teams, 72 group-stage matches.
          </h2>
          <p className="text-fg-secondary text-base mb-12 max-w-2xl">
            All times shown in UK local. The full bracket fills in as the group stage completes.
          </p>

          {groups.length === 0 ? (
            <div className="card text-fg-muted text-center py-12">
              Fixtures will appear here once the draw data publishes.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {groups.map((g) => (
                <GroupCard key={g.name} group={g} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t border-border-subtle bg-gradient-to-b from-brand/5 to-bg-base">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 py-16 lg:py-20 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-black mb-5 leading-tight">
            Don't miss a single matchday.
          </h2>
          <p className="text-fg-secondary text-lg mb-10 max-w-xl mx-auto">
            Group stage runs daily for 12 days from June 11. Sign up once, hear from us every morning of the tournament.
          </p>
          <EmailCapture />
          <p className="text-fg-muted text-xs mt-5">
            Or skip the wait — <Link href="/predictions" className="text-brand hover:underline">see today&apos;s picks across all leagues</Link>.
          </p>
        </div>
      </section>
    </main>
  )
}

// ── Sub-components (server) ────────────────────────────────────────────

function Feature({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div>
      <p className="text-brand text-[10px] font-bold uppercase tracking-widest mb-2">{eyebrow}</p>
      <h3 className="font-display text-xl font-black mb-3">{title}</h3>
      <p className="text-fg-secondary text-sm leading-relaxed">{body}</p>
    </div>
  )
}

function FriendlyRow({ fixture }: { fixture: Fixture }) {
  return (
    <li className="card flex items-center gap-3 py-3.5 hover:border-border-strong transition-colors">
      {/* Date column */}
      <div className="flex flex-col items-center justify-center w-14 shrink-0 border-r border-border-subtle pr-3">
        <span className="text-fg-muted text-[10px] font-bold uppercase tracking-widest">
          {new Date(fixture.date).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' })}
        </span>
        <span className="font-stat text-fg text-lg font-bold leading-none">
          {new Date(fixture.date).toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Europe/London' })}
        </span>
        <span className="text-fg-muted text-[10px] mt-0.5">
          {new Date(fixture.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
        </span>
      </div>

      {/* Teams */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          {fixture.home.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fixture.home.logo} alt="" className="w-4 h-4 object-contain shrink-0" loading="lazy" />
          ) : null}
          <span className="text-fg font-semibold truncate">{fixture.home.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm mt-1">
          {fixture.away.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fixture.away.logo} alt="" className="w-4 h-4 object-contain shrink-0" loading="lazy" />
          ) : null}
          <span className="text-fg font-semibold truncate">{fixture.away.name}</span>
        </div>
      </div>

      {/* Venue */}
      {fixture.venue.city && (
        <div className="text-fg-muted text-[10px] text-right hidden sm:block shrink-0">
          {fixture.venue.city}
        </div>
      )}
    </li>
  )
}

function GroupCard({ group }: { group: Group }) {
  return (
    <div className="card hover:border-border-strong transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-black">{group.name}</h3>
        <span className="text-fg-muted text-xs font-medium">{group.fixtures.length} matches</span>
      </div>

      {/* Team list */}
      <ul className="space-y-2 mb-5">
        {group.teams.map((t) => (
          <li key={t.id} className="flex items-center gap-3 text-sm">
            {t.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logo} alt="" className="w-5 h-5 object-contain" loading="lazy" />
            ) : (
              <span className="w-5 h-5 inline-block bg-bg-elevated rounded-sm" />
            )}
            <span className="text-fg font-medium">{t.name}</span>
          </li>
        ))}
      </ul>

      {/* First 3 fixtures inline */}
      {group.fixtures.length > 0 && (
        <div className="border-t border-border-subtle pt-4">
          <p className="text-fg-muted text-[10px] font-bold uppercase tracking-widest mb-3">First matches</p>
          <ul className="space-y-2.5">
            {group.fixtures.slice(0, 3).map((f) => (
              <li key={f.id} className="text-xs">
                <div className="text-fg-secondary">{fmtKickoffShort(f.date)}</div>
                <div className="text-fg mt-0.5">
                  <span className="font-medium">{f.home.name}</span>
                  <span className="text-fg-muted mx-1.5">v</span>
                  <span className="font-medium">{f.away.name}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
