'use client'

import { useEffect, useState } from 'react'

/**
 * FixtureDetailModal — comprehensive pre/in/post-match panel for a single
 * fixture. Used by:
 *   - Money tab acca legs (click a leg row to open)
 *   - Home tab live bets section (click a single or acca leg)
 *   - Anywhere else a user wants to drill into "what's actually happening"
 *
 * Sections (tabs):
 *   - Overview: score, venue, kickoff, weather, AI prediction
 *   - Lineups: starting XI per team + formations + subs + coach
 *   - Stats: shots, possession, xG, corners, cards (live during match)
 *   - Events: goals, cards, subs (timeline)
 *   - Form & H2H: last 5 each + last 5 meetings
 *   - Injuries: current injuries for both sides
 *
 * Polls every 60s while the fixture is in-play.
 */

interface Lineup {
  team_id: number | null
  team_name: string | null
  team_logo: string | null
  formation: string | null
  coach: string | null
  starting_xi: Array<{ id: number; name: string; number: number; pos: string; grid: string | null }>
  substitutes: Array<{ id: number; name: string; number: number; pos: string }>
}

interface MatchEvent {
  minute: number | null
  extra: number | null
  team_id: number
  team_name: string
  player: string | null
  assist: string | null
  type: string
  detail: string
  comments: string | null
}

interface Injury {
  player: { name: string; photo?: string }
  player_name?: string
  type?: string
  reason?: string
}

interface FormMatch {
  date: string
  opponent: string
  home: boolean
  goals_for: number
  goals_against: number
  result: 'W' | 'D' | 'L'
}

interface H2H {
  date: string
  home_team: string
  away_team: string
  home_goals: number
  away_goals: number
  league: string
}

interface FixtureDetail {
  fixture: {
    id: number
    date: string
    status: string
    elapsed: number | null
    venue: string | null
    city: string | null
    referee: string | null
  }
  league: {
    id: number
    name: string
    logo: string | null
    round: string | null
  }
  home: {
    id: number
    name: string
    logo: string | null
    goals: number | null
    injuries: Injury[]
    form: FormMatch[]
  }
  away: {
    id: number
    name: string
    logo: string | null
    goals: number | null
    injuries: Injury[]
    form: FormMatch[]
  }
  h2h: H2H[]
  prediction: any
  statistics: any
  home_lineup: Lineup | null
  away_lineup: Lineup | null
  events: MatchEvent[]
}

interface Props {
  fixtureId: number | string
  /** Pre-known names for the loading state header. */
  homeName?: string
  awayName?: string
  onClose: () => void
}

type Tab = 'overview' | 'lineups' | 'stats' | 'events' | 'form' | 'injuries'

const POLL_MS = 60_000

export default function FixtureDetailModal({ fixtureId, homeName, awayName, onClose }: Props) {
  const [data, setData] = useState<FixtureDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  async function fetchDetail() {
    try {
      const res = await fetch(`/api/fixtures/${fixtureId}`, { cache: 'no-store' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as FixtureDetail
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load fixture')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function tick() {
      if (cancelled) return
      // Capture the result of THIS fetch, not the (stale) closed-over `data`
      // state — that bug stopped polling after the first tick because state
      // updates batched after the .finally() callback fired.
      try {
        const res = await fetch(`/api/fixtures/${fixtureId}`, { cache: 'no-store' })
        if (cancelled) return
        if (res.ok) {
          const json = (await res.json()) as FixtureDetail
          if (cancelled) return
          setData(json)
          setError(null)
          // Only keep polling if game is in-play OR not yet started (could
          // start mid-session). Stop polling on FT / postponed / cancelled.
          const status = json.fixture?.status
          const keepPolling =
            ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE', 'NS', 'TBD'].includes(status)
          if (keepPolling) timer = setTimeout(tick, POLL_MS)
        }
      } catch {
        // Best-effort — silently retry next tick if a network blip happened.
        if (!cancelled) timer = setTimeout(tick, POLL_MS)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Initial fetch + start the poll chain.
    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId])

  const status = data?.fixture.status ?? 'NS'
  const isLive = ['1H', '2H', 'HT', 'ET'].includes(status)
  const isFinished = ['FT', 'AET', 'PEN'].includes(status)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative bg-bg-surface border border-border-strong rounded-2xl w-full max-w-4xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-border-subtle flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {data && (
              <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1">
                {data.league.name} {data.league.round ? `· ${data.league.round}` : ''}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                {data?.home.logo && <img src={data.home.logo} alt="" className="h-6 w-6 object-contain" />}
                <span className="text-fg font-bold text-base lg:text-lg truncate">
                  {data?.home.name ?? homeName ?? 'Home'}
                </span>
              </div>
              {(isLive || isFinished) && data ? (
                <span className="font-stat text-fg text-2xl lg:text-3xl font-bold tabular-nums">
                  {data.home.goals ?? 0} – {data.away.goals ?? 0}
                </span>
              ) : (
                <span className="text-fg-muted text-sm">vs</span>
              )}
              <div className="flex items-center gap-2 min-w-0">
                {data?.away.logo && <img src={data.away.logo} alt="" className="h-6 w-6 object-contain" />}
                <span className="text-fg font-bold text-base lg:text-lg truncate">
                  {data?.away.name ?? awayName ?? 'Away'}
                </span>
              </div>
              {data && (
                <span
                  className={`font-stat font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full border ${
                    isLive
                      ? 'bg-loss/10 border-loss/40 text-loss animate-pulse'
                      : isFinished
                        ? 'bg-bg-elevated border-border-subtle text-fg-secondary'
                        : 'bg-bg-elevated border-border-subtle text-fg-muted'
                  }`}
                >
                  {isLive ? `LIVE ${data.fixture.elapsed ?? ''}'` : isFinished ? 'FT' : data.fixture.date ? new Date(data.fixture.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'NS'}
                </span>
              )}
            </div>
            {data && (data.fixture.venue || data.fixture.referee) && (
              <p className="text-fg-muted text-[11px] mt-2">
                {data.fixture.venue && (
                  <>📍 {data.fixture.venue}{data.fixture.city ? `, ${data.fixture.city}` : ''}</>
                )}
                {data.fixture.venue && data.fixture.referee && ' · '}
                {data.fixture.referee && <>🧑‍⚖️ {data.fixture.referee}</>}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-muted hover:text-fg text-2xl leading-none -mt-1 -mr-2 px-2"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {/* Tabs */}
        <nav className="border-b border-border-subtle flex overflow-x-auto">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'lineups', label: 'Lineups' },
            { id: 'stats', label: 'Stats' },
            { id: 'events', label: 'Events' },
            { id: 'form', label: 'Form & H2H' },
            { id: 'injuries', label: 'Injuries' },
          ] as Array<{ id: Tab; label: string }>).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${
                tab === t.id
                  ? 'text-brand border-brand'
                  : 'text-fg-muted hover:text-fg border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && !data && <LoadingState />}
          {error && (
            <div className="bg-loss/10 border border-loss/30 text-loss text-sm rounded-lg p-3">
              Failed to load — {error}.{' '}
              <button onClick={() => void fetchDetail()} className="underline font-bold uppercase tracking-wider text-[10px] ml-2">
                Retry
              </button>
            </div>
          )}
          {data && tab === 'overview' && <OverviewTab data={data} />}
          {data && tab === 'lineups' && <LineupsTab data={data} />}
          {data && tab === 'stats' && <StatsTab data={data} />}
          {data && tab === 'events' && <EventsTab data={data} />}
          {data && tab === 'form' && <FormTab data={data} />}
          {data && tab === 'injuries' && <InjuriesTab data={data} />}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="h-32 bg-bg-elevated rounded-xl animate-pulse" />
      <div className="h-32 bg-bg-elevated rounded-xl animate-pulse" />
    </div>
  )
}

function OverviewTab({ data }: { data: FixtureDetail }) {
  const pred = data.prediction
  return (
    <div className="space-y-4">
      {/* AI prediction */}
      {pred && (
        <section className="bg-bg-base/60 border border-border-subtle rounded-xl p-4">
          <p className="eyebrow mb-3">AI Prediction</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <PredictionBar label={data.home.name} pct={pred.homeWinPercent} accent="brand" />
            <PredictionBar label="Draw" pct={pred.drawPercent} accent="muted" />
            <PredictionBar label={data.away.name} pct={pred.awayWinPercent} accent="brand" />
          </div>
          {pred.advice && (
            <p className="text-fg text-sm">
              <span className="text-fg-muted text-[10px] font-bold uppercase tracking-wider">Advice: </span>
              {pred.advice}
            </p>
          )}
          {pred.winnerName && (
            <p className="text-fg-secondary text-[12px] mt-1">
              <span className="text-fg-muted">Predicted winner: </span>
              <span className="font-semibold">{pred.winnerName}</span>
              {pred.winnerComment && <span className="text-fg-muted"> — {pred.winnerComment}</span>}
            </p>
          )}
        </section>
      )}

      {/* Quick stats */}
      <section className="bg-bg-base/60 border border-border-subtle rounded-xl p-4">
        <p className="eyebrow mb-3">Recent form</p>
        <div className="grid grid-cols-2 gap-4">
          <FormStrip team={data.home.name} form={data.home.form} />
          <FormStrip team={data.away.name} form={data.away.form} />
        </div>
      </section>
    </div>
  )
}

function PredictionBar({ label, pct, accent }: { label: string; pct: any; accent: 'brand' | 'muted' }) {
  const v = typeof pct === 'string' ? parseInt(pct.replace('%', ''), 10) : Number(pct)
  const safe = Number.isFinite(v) ? v : 0
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-fg-secondary truncate">{label}</span>
        <span className="font-stat font-bold text-fg tabular-nums">{safe}%</span>
      </div>
      <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className={accent === 'brand' ? 'h-full bg-brand' : 'h-full bg-fg-muted/40'}
          style={{ width: `${Math.max(0, Math.min(100, safe))}%` }}
        />
      </div>
    </div>
  )
}

function FormStrip({ team, form }: { team: string; form: FormMatch[] }) {
  return (
    <div>
      <p className="text-fg text-[12px] font-semibold mb-2 truncate">{team}</p>
      <div className="flex items-center gap-1 mb-2">
        {form.length === 0 && <span className="text-fg-muted text-[11px]">No data</span>}
        {form.slice(0, 5).map((m, i) => (
          <span
            key={i}
            className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${
              m.result === 'W' ? 'bg-success/20 text-success'
              : m.result === 'L' ? 'bg-loss/20 text-loss'
              : 'bg-fg-muted/15 text-fg-muted'
            }`}
            title={`${m.opponent} ${m.goals_for}-${m.goals_against} (${m.home ? 'H' : 'A'})`}
          >
            {m.result}
          </span>
        ))}
      </div>
    </div>
  )
}

function LineupsTab({ data }: { data: FixtureDetail }) {
  if (!data.home_lineup && !data.away_lineup) {
    return (
      <div className="text-center py-8 text-fg-muted text-sm">
        Lineups not yet announced. Usually published 1 hour before kickoff.
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.home_lineup && <LineupBlock lineup={data.home_lineup} />}
        {data.away_lineup && <LineupBlock lineup={data.away_lineup} />}
      </div>
    </div>
  )
}

function LineupBlock({ lineup }: { lineup: Lineup }) {
  return (
    <section className="bg-bg-base/60 border border-border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {lineup.team_logo && <img src={lineup.team_logo} alt="" className="h-5 w-5 object-contain" />}
          <span className="text-fg font-bold text-sm truncate">{lineup.team_name}</span>
        </div>
        {lineup.formation && (
          <span className="font-stat text-brand text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-brand/10 border border-brand/30">
            {lineup.formation}
          </span>
        )}
      </div>
      {lineup.coach && (
        <p className="text-fg-muted text-[10px] mb-3">Coach: <span className="text-fg-secondary">{lineup.coach}</span></p>
      )}
      <p className="eyebrow mb-2">Starting XI</p>
      <ul className="space-y-1 mb-4">
        {lineup.starting_xi.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-[12px]">
            <span className="font-stat text-fg-muted w-6 text-right tabular-nums">{p.number}</span>
            <span className="font-stat text-[10px] text-fg-muted bg-bg-elevated px-1.5 py-0.5 rounded">{p.pos}</span>
            <span className="text-fg font-semibold flex-1 truncate">{p.name}</span>
          </li>
        ))}
      </ul>
      {lineup.substitutes.length > 0 && (
        <>
          <p className="eyebrow mb-2">Bench</p>
          <ul className="space-y-1">
            {lineup.substitutes.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[11px]">
                <span className="font-stat text-fg-muted w-6 text-right tabular-nums">{p.number}</span>
                <span className="font-stat text-[10px] text-fg-muted">{p.pos}</span>
                <span className="text-fg-secondary flex-1 truncate">{p.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function StatsTab({ data }: { data: FixtureDetail }) {
  const stats = data.statistics
  // The /api/fixtures/[fixtureId] endpoint pre-processes match stats into
  // a fixed shape: { home: { possession, shots_total, shots_on_goal, xg,
  // corners, fouls, yellow_cards, red_cards, saves, pass_accuracy,
  // offsides, ... }, away: {...} }. We DON'T use the raw API-Football
  // string types here — those would all read as null.
  const home = (stats as any)?.home
  const away = (stats as any)?.away
  if (!home && !away) {
    const status = data.fixture.status
    const live = ['1H', '2H', 'HT', 'ET'].includes(status)
    return (
      <div className="text-center py-8 text-fg-muted text-sm">
        {live
          ? 'Live stats not available for this fixture yet — they usually populate within a few minutes of kickoff.'
          : status === 'NS'
            ? 'Live stats appear once the match is underway.'
            : 'No stats available for this fixture.'}
      </div>
    )
  }
  type Row = { label: string; key: string; suffix?: string }
  const rows: Row[] = [
    { label: 'Possession', key: 'possession', suffix: '%' },
    { label: 'Total Shots', key: 'shots_total' },
    { label: 'Shots on Goal', key: 'shots_on_goal' },
    { label: 'Expected Goals (xG)', key: 'xg' },
    { label: 'Corners', key: 'corners' },
    { label: 'Fouls', key: 'fouls' },
    { label: 'Yellow Cards', key: 'yellow_cards' },
    { label: 'Red Cards', key: 'red_cards' },
    { label: 'Saves', key: 'saves' },
    { label: 'Pass Accuracy', key: 'pass_accuracy', suffix: '%' },
    { label: 'Offsides', key: 'offsides' },
  ]
  function show(v: any): string {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
    return String(v)
  }
  // Visual bar: % of the larger value of the two — gives a quick "who's
  // doing what" read at a glance.
  function bar(h: any, a: any): { hPct: number; aPct: number } {
    const hn = Number(h) || 0
    const an = Number(a) || 0
    const total = hn + an
    if (total <= 0) return { hPct: 0, aPct: 0 }
    return { hPct: Math.round((hn / total) * 100), aPct: Math.round((an / total) * 100) }
  }
  const visibleRows = rows.filter((r) => {
    const hv = home?.[r.key]
    const av = away?.[r.key]
    return (hv != null && hv !== '') || (av != null && av !== '')
  })
  if (visibleRows.length === 0) {
    return (
      <div className="text-center py-8 text-fg-muted text-sm">
        Live stats not yet populated. Refreshing every minute.
      </div>
    )
  }
  return (
    <div className="space-y-2.5">
      {visibleRows.map((r) => {
        const hv = home?.[r.key]
        const av = away?.[r.key]
        const { hPct, aPct } = bar(hv, av)
        const hStr = show(hv) + (hv != null && r.suffix ? r.suffix : '')
        const aStr = show(av) + (av != null && r.suffix ? r.suffix : '')
        return (
          <div key={r.key} className="py-2 px-3 rounded-lg bg-bg-base/40">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-1.5">
              <span className="font-stat text-fg text-right tabular-nums text-sm font-bold">{hStr}</span>
              <span className="text-fg-muted text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{r.label}</span>
              <span className="font-stat text-fg text-left tabular-nums text-sm font-bold">{aStr}</span>
            </div>
            <div className="flex h-1 rounded-full overflow-hidden bg-bg-elevated">
              <div className="bg-brand/70" style={{ width: `${hPct}%` }} />
              <div className="bg-fg-secondary/40" style={{ width: `${aPct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EventsTab({ data }: { data: FixtureDetail }) {
  if (!data.events?.length) {
    return (
      <div className="text-center py-8 text-fg-muted text-sm">
        No events yet. Goals, cards and subs appear here as they happen.
      </div>
    )
  }
  // Sort chronologically
  const sorted = [...data.events].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
  return (
    <ol className="space-y-2">
      {sorted.map((e, i) => {
        const isHome = e.team_id === data.home.id
        const icon = e.type === 'Goal' ? '⚽'
                  : e.type === 'Card' && e.detail?.includes('Yellow') ? '🟨'
                  : e.type === 'Card' && e.detail?.includes('Red') ? '🟥'
                  : e.type === 'subst' ? '🔁'
                  : e.type === 'Var' ? '📺' : '•'
        return (
          <li
            key={i}
            className={`flex items-center gap-3 py-2 px-3 rounded-lg bg-bg-base/40 ${isHome ? '' : 'flex-row-reverse'}`}
          >
            <span className="font-stat text-fg-muted text-[12px] tabular-nums w-10 shrink-0 text-center">
              {e.minute ?? 0}{e.extra ? `+${e.extra}` : ''}'
            </span>
            <span className="text-base shrink-0">{icon}</span>
            <span className={`text-fg text-sm flex-1 ${isHome ? '' : 'text-right'}`}>
              <span className="font-semibold">{e.player ?? e.team_name}</span>
              {e.assist && <span className="text-fg-muted text-[12px]"> (assist: {e.assist})</span>}
              <span className="text-fg-muted text-[10px] block">{e.detail}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function FormTab({ data }: { data: FixtureDetail }) {
  return (
    <div className="space-y-5">
      <section className="bg-bg-base/60 border border-border-subtle rounded-xl p-4">
        <p className="eyebrow mb-3">Last 5 — {data.home.name}</p>
        <FormList form={data.home.form} />
      </section>
      <section className="bg-bg-base/60 border border-border-subtle rounded-xl p-4">
        <p className="eyebrow mb-3">Last 5 — {data.away.name}</p>
        <FormList form={data.away.form} />
      </section>
      <section className="bg-bg-base/60 border border-border-subtle rounded-xl p-4">
        <p className="eyebrow mb-3">Head-to-head (last 5)</p>
        {data.h2h?.length ? (
          <ul className="space-y-1">
            {data.h2h.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px] py-1.5 px-2 rounded bg-bg-base/40">
                <span className="font-stat text-fg-muted w-20 shrink-0">{m.date?.slice(0, 10)}</span>
                <span className="text-fg flex-1 truncate">{m.home_team} <span className="font-stat font-bold">{m.home_goals}-{m.away_goals}</span> {m.away_team}</span>
                <span className="text-fg-muted text-[10px] truncate max-w-[120px]">{m.league}</span>
              </li>
            ))}
          </ul>
        ) : <span className="text-fg-muted text-sm">No H2H data</span>}
      </section>
    </div>
  )
}

function FormList({ form }: { form: FormMatch[] }) {
  if (!form?.length) return <span className="text-fg-muted text-sm">No form data</span>
  return (
    <ul className="space-y-1.5">
      {form.map((m, i) => (
        <li key={i} className="flex items-center gap-2 text-[12px] py-1.5 px-2 rounded bg-bg-base/40">
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 ${
            m.result === 'W' ? 'bg-success/20 text-success'
            : m.result === 'L' ? 'bg-loss/20 text-loss'
            : 'bg-fg-muted/15 text-fg-muted'
          }`}>{m.result}</span>
          <span className="font-stat text-fg-muted w-20 shrink-0">{m.date?.slice(0, 10)}</span>
          <span className="text-fg flex-1 truncate">
            {m.home ? 'vs' : '@'} <span className="font-semibold">{m.opponent}</span>
          </span>
          <span className="font-stat text-fg font-bold tabular-nums">{m.goals_for}–{m.goals_against}</span>
        </li>
      ))}
    </ul>
  )
}

function InjuriesTab({ data }: { data: FixtureDetail }) {
  return (
    <div className="space-y-4">
      <InjuriesBlock teamName={data.home.name} injuries={data.home.injuries} />
      <InjuriesBlock teamName={data.away.name} injuries={data.away.injuries} />
    </div>
  )
}

function InjuriesBlock({ teamName, injuries }: { teamName: string; injuries: Injury[] }) {
  return (
    <section className="bg-bg-base/60 border border-border-subtle rounded-xl p-4">
      <p className="eyebrow mb-3">{teamName} — Injuries</p>
      {injuries?.length ? (
        <ul className="space-y-1.5">
          {injuries.map((inj: any, i) => (
            <li key={i} className="flex items-center gap-3 text-[12px] py-1.5 px-2 rounded bg-bg-base/40">
              <span className="text-fg font-semibold flex-1 truncate">{inj.player?.name ?? inj.player_name ?? 'Unknown'}</span>
              <span className="text-loss text-[11px]">{inj.type ?? inj.reason ?? 'Injury'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-success text-sm">✓ No reported injuries</span>
      )}
    </section>
  )
}
