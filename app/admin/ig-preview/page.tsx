/**
 * /admin/ig-preview
 *
 * Visual gallery of every IG-format OG card. Auth-gated via the admin
 * layout. Use to preview daily/evergreen/carousel/per-fixture variants
 * before posting to Instagram.
 *
 * The post-instagram cron auto-rotates:
 *   Mon — recap (or biggest-wins if yesterday lost)
 *   Tue — value-card (international)
 *   Wed — fixture-deepdive (next intl) or value-card fallback
 *   Thu — value-card (international)
 *   Fri — biggest-wins (weekly hype)
 *   Sat — value-card (international)
 *   Sun — team-stats / coach-positioning (alternating)
 *
 * Weekly carousels (auto, separate crons):
 *   Tue 15:00 UTC — ev-explainer (4-slide pinnable)
 *   Thu 15:00 UTC — tour (4-slide pinnable)
 */

import Link from 'next/link'
import { getWorldCupGroups, getAllFixtures, type WCGroup, type WCFixture } from '@/lib/world-cup-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

interface CardSpec {
  key: string
  name: string
  endpoint: string
  desc: string
  category: 'daily' | 'weekly' | 'evergreen' | 'per-fixture' | 'per-group' | 'carousel'
  schedule?: string
}

const CORE_CARDS: CardSpec[] = [
  {
    key: 'value-card',
    name: "Today's #1 value bet (intl)",
    endpoint: '/api/og/ig-value-card',
    desc: "Auto-picks today's highest-EV international bet. Posts Tue/Thu/Sat by cron.",
    category: 'daily',
    schedule: 'Tue/Thu/Sat 17:30 UTC',
  },
  {
    key: 'recap',
    name: "Yesterday's W/L recap",
    endpoint: '/api/og/ig-recap',
    desc: "Only auto-posts on profitable days. Losing Mondays auto-fall back to biggest-wins.",
    category: 'daily',
    schedule: 'Mon 17:30 UTC (if profit)',
  },
  {
    key: 'biggest-wins',
    name: 'Biggest wins (30d)',
    endpoint: '/api/og/ig-biggest-wins',
    desc: "Replaces the old 'every loss' hero. Biggest odds cashed + best edge that hit.",
    category: 'weekly',
    schedule: 'Fri 17:30 UTC + Mon fallback',
  },
  {
    key: 'team-stats',
    name: 'Most predictable teams',
    endpoint: '/api/og/ig-team-stats',
    desc: 'Top teams by AI hit rate. Saveable. Auto-posts every other Sun.',
    category: 'weekly',
    schedule: 'Sun 17:30 UTC (alt)',
  },
  {
    key: 'coach-positioning',
    name: "You're the coach",
    endpoint: '/api/og/ig-coach-positioning',
    desc: 'Evergreen brand statement + 4 tools. Auto-posts every other Sun.',
    category: 'evergreen',
    schedule: 'Sun 17:30 UTC (alt)',
  },
  {
    key: 'value-bet-math',
    name: 'Value-bet maths in 30s',
    endpoint: '/api/og/ig-value-bet-math',
    desc: 'Evergreen single-slide explainer. Manual posting only.',
    category: 'evergreen',
  },
]

const CAROUSELS: { name: string; key: string; slides: number; desc: string; schedule: string }[] = [
  {
    name: 'EV explainer (pinnable)',
    key: 'ev-explainer',
    slides: 4,
    desc: 'What\'s a value bet? · The maths · Real example · Try it. Pin to profile.',
    schedule: 'Tue 15:00 UTC (auto)',
  },
  {
    name: 'Product tour (pinnable)',
    key: 'tour',
    slides: 4,
    desc: 'Picks feed · Bet tracker · AI coach · Track record. Pin to profile.',
    schedule: 'Thu 15:00 UTC (auto)',
  },
]

export default async function IGPreviewPage() {
  const [groups, fixtures] = await Promise.all([
    getWorldCupGroups().catch(() => [] as WCGroup[]),
    getAllFixtures().catch(() => [] as WCFixture[]),
  ])
  const bust = Date.now()

  const upcomingFixtures = fixtures
    .filter(f => new Date(f.date).getTime() > Date.now())
    .slice(0, 8)

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">IG card preview gallery</h1>
        <p className="text-sm text-neutral-400 mt-2 max-w-3xl">
          Every 1080×1350 card available for Instagram. Right-click any thumbnail → <em>Save Image As</em> to download.
          Click to open the live URL in a new tab.
        </p>
        <div className="mt-4 p-3 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-300 max-w-3xl">
          <div className="font-semibold text-neutral-100 mb-1">Auto-posting status</div>
          <div className="text-neutral-400">
            Every day 17:30 UTC the IG cron picks a card by day-of-week (see schedule chips). The EV explainer
            and product tour carousels fire weekly (Tue/Thu 15:00 UTC). Losing Mondays automatically swap
            recap → biggest-wins. No manual work needed for the rotating slots; manual posting is only for variety.
          </div>
        </div>
      </header>

      {/* ── CORE CARDS ── */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-4">Daily / weekly / evergreen (single-image)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CORE_CARDS.map(card => {
            const url = `${APP_URL}${card.endpoint}?_=${bust}`
            const liveUrl = `${APP_URL}${card.endpoint}`
            return (
              <article key={card.key} className="bg-neutral-900 border border-neutral-800 overflow-hidden">
                <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={card.name}
                    width={1080}
                    height={1350}
                    className="w-full h-auto block hover:opacity-90 transition-opacity"
                    style={{ aspectRatio: '1080 / 1350' }}
                  />
                </a>
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm">{card.name}</h3>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
                      {card.category}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-snug">{card.desc}</p>
                  {card.schedule && (
                    <p className="text-[11px] text-orange-400 font-mono mt-1">{card.schedule}</p>
                  )}
                  <p className="text-[10px] text-neutral-500 font-mono mt-2 truncate">{card.endpoint}</p>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* ── PINNABLE CAROUSELS ── */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-1">Pinnable carousels (multi-slide)</h2>
        <p className="text-xs text-neutral-400 mb-4">
          Auto-posted weekly. Manually pin to profile after first post.
        </p>
        {CAROUSELS.map(c => (
          <div key={c.key} className="mb-8">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-base font-semibold">{c.name}</h3>
              <span className="text-xs text-orange-400 font-mono">{c.schedule}</span>
            </div>
            <p className="text-xs text-neutral-400 mb-3">{c.desc}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: c.slides }, (_, i) => i + 1).map(slide => {
                const endpoint = `/api/og/ig-${c.key}?slide=${slide}`
                const url = `${APP_URL}${endpoint}&_=${bust}`
                const liveUrl = `${APP_URL}${endpoint}`
                return (
                  <article key={slide} className="bg-neutral-900 border border-neutral-800 overflow-hidden">
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${c.name} slide ${slide}`}
                        width={1080}
                        height={1350}
                        className="w-full h-auto block hover:opacity-90 transition-opacity"
                        style={{ aspectRatio: '1080 / 1350' }}
                      />
                    </a>
                    <div className="p-2.5">
                      <p className="text-[11px] text-neutral-500 font-mono">slide {slide} / {c.slides}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {/* ── BRACKET CAROUSEL ── */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-1">WC bracket carousel (manual)</h2>
        <p className="text-xs text-neutral-400 mb-4">
          12 slides — post as a single IG carousel. One per group.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {groups.length === 0 ? (
            <p className="text-sm text-neutral-500 col-span-full">
              No group data — API-Football WC standings empty.
            </p>
          ) : (
            groups.map(g => {
              const endpoint = `/api/og/ig-bracket?group=${g.slug}`
              const url = `${APP_URL}${endpoint}&_=${bust}`
              const liveUrl = `${APP_URL}${endpoint}`
              return (
                <article key={g.slug} className="bg-neutral-900 border border-neutral-800 overflow-hidden">
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={g.name}
                      width={1080}
                      height={1350}
                      className="w-full h-auto block hover:opacity-90 transition-opacity"
                      style={{ aspectRatio: '1080 / 1350' }}
                    />
                  </a>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold">{g.name}</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{g.teams.length} teams</p>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>

      {/* ── FIXTURE DEEP-DIVE PICKER ── */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-1">Match-preview deep-dive</h2>
        <p className="text-xs text-neutral-400 mb-4">
          Statengine-style with both teams&apos; last-5 form, venue, kick-off. Auto-posts Wed for next intl fixture.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {upcomingFixtures.length === 0 ? (
            <p className="text-sm text-neutral-500 col-span-full">
              No upcoming fixtures.
            </p>
          ) : (
            upcomingFixtures.map(f => {
              const endpoint = `/api/og/ig-fixture-deepdive?id=${f.id}`
              const url = `${APP_URL}${endpoint}&_=${bust}`
              const liveUrl = `${APP_URL}${endpoint}`
              const kickoff = new Date(f.date).toLocaleString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
              })
              return (
                <article key={f.id} className="bg-neutral-900 border border-neutral-800 overflow-hidden">
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${f.home.name} v ${f.away.name}`}
                      width={1080}
                      height={1350}
                      className="w-full h-auto block hover:opacity-90 transition-opacity"
                      style={{ aspectRatio: '1080 / 1350' }}
                    />
                  </a>
                  <div className="p-4">
                    <p className="font-semibold text-sm">{f.home.name} v {f.away.name}</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5 font-mono">{kickoff} BST</p>
                    {f.venue.name && (
                      <p className="text-[10px] text-neutral-500 mt-0.5 truncate">{f.venue.name}</p>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>

      {/* ── USAGE NOTES ── */}
      <section className="mt-12 border-t border-neutral-800 pt-8">
        <h2 className="text-lg font-semibold tracking-tight mb-3">Manual posting (variety / off-rotation)</h2>
        <ol className="text-sm text-neutral-300 space-y-2 list-decimal list-inside max-w-2xl">
          <li>Right-click any thumbnail → <em>Save Image As</em> (or open the URL in a new tab and screenshot at 1080×1350).</li>
          <li>Upload to Instagram via the app or the web composer.</li>
          <li>For the WC bracket: select all 12 group images in order (A → L), upload as a single carousel post.</li>
          <li>For pinnable carousels: cron already posts them — pin to profile once it's live.</li>
          <li>Caption template lives in <code>docs/instagram-growth-plan.md</code>.</li>
        </ol>
      </section>
    </div>
  )
}
