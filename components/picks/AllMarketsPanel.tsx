'use client'

import { useEffect, useMemo, useState } from 'react'

/**
 * AllMarketsPanel — comprehensive markets panel for a single fixture.
 *
 * Mounts inside a PickCard / LiveMatchCard when the user toggles "All Markets".
 * Lazy-loads /api/fixtures/[id]/all-markets on first render, then renders
 * one collapsible section per category with AI verdicts (bet/lean/skip/avoid)
 * and EV per selection. "Add to bets" is available on bet/lean rows.
 */

type Verdict = 'bet' | 'lean' | 'skip' | 'avoid'
type Category =
  | 'main'
  | 'goals'
  | 'btts'
  | 'corners'
  | 'cards'
  | 'halftime'
  | 'handicap'
  | 'specials'

interface Selection {
  label: string
  odds: number
  impliedProb: number
  aiVerdict: Verdict
  aiReason: string
  aiProb: number
  ev: number
}

interface Market {
  category: Category
  name: string
  line: string | null
  selections: Selection[]
}

interface AllMarketsResponse {
  fixture: {
    id: number
    home: string
    away: string
    league: string
    kickoff: string
    status: string
  }
  markets: Market[]
  generatedAt: string
  diagnostics?: {
    bookmakers_count: number
    odds_available: boolean
    ai_evaluated: boolean
    note?: string
  }
}

interface Props {
  fixtureId: number
  homeTeam: string
  awayTeam: string
  league: string
  kickoff: string
  /** Optional callback so parents can react to add-to-bets success. */
  onAdded?: () => void
}

const CATEGORY_LABEL: Record<Category, string> = {
  main: 'Match Result & Combos',
  goals: 'Total Goals',
  btts: 'Both Teams to Score',
  corners: 'Corners',
  cards: 'Cards',
  halftime: 'Half Time Markets',
  handicap: 'Handicap',
  specials: 'Specials',
}

const CATEGORY_ORDER: Category[] = [
  'main',
  'goals',
  'btts',
  'corners',
  'cards',
  'halftime',
  'handicap',
  'specials',
]

function verdictDot(v: Verdict): { bg: string; ring: string; text: string; label: string } {
  switch (v) {
    case 'bet':
      return {
        bg: 'bg-success',
        ring: 'ring-2 ring-success/40',
        text: 'text-success',
        label: 'BET',
      }
    case 'lean':
      return {
        bg: 'bg-value',
        ring: 'ring-2 ring-value/40',
        text: 'text-value',
        label: 'LEAN',
      }
    case 'avoid':
      return {
        bg: 'bg-loss',
        ring: 'ring-2 ring-loss/40',
        text: 'text-loss',
        label: 'AVOID',
      }
    default:
      return {
        bg: 'bg-fg-muted/40',
        ring: '',
        text: 'text-fg-muted',
        label: 'SKIP',
      }
  }
}

function deriveBetType(label: string, marketName: string): string {
  const l = label.toLowerCase()
  const m = marketName.toLowerCase()
  if (m.includes('corner')) return 'Corners'
  if (m.includes('card')) return 'Cards'
  if (m.includes('handicap')) return 'Asian Handicap'
  if (m.includes('half time') || m.includes('halftime')) return 'Half Time'
  if (m.includes('double chance')) return 'Double Chance'
  if (m.includes('btts') || m.includes('both teams')) return 'BTTS'
  if (l.includes('over') || l.includes('under')) return 'Over/Under'
  return 'Match Result (1X2)'
}

interface RowProps {
  sel: Selection
  marketName: string
  fixtureId: number
  homeTeam: string
  awayTeam: string
  league: string
  kickoff: string
  onAdded?: () => void
}

function SelectionRow({
  sel,
  marketName,
  fixtureId,
  homeTeam,
  awayTeam,
  league,
  kickoff,
  onAdded,
}: RowProps) {
  const dot = verdictDot(sel.aiVerdict)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState(false)
  // Every selection is addable — the user picks what they want. The AI
  // verdict only changes the visual emphasis of the button (brand-colored
  // for bet/lean, muted for skip/avoid). Power users override AI all the time.
  const isRecommended = sel.aiVerdict === 'bet' || sel.aiVerdict === 'lean'
  const evClass =
    sel.ev > 0 ? 'text-success' : sel.ev < 0 ? 'text-loss' : 'text-fg-muted'

  async function add() {
    if (adding || added) return
    setAdding(true)
    setError(false)
    try {
      const res = await fetch('/api/bet-slips/from-rec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          home: homeTeam,
          away: awayTeam,
          market: deriveBetType(sel.label, marketName),
          selection: `${marketName}: ${sel.label}`,
          odds: sel.odds,
          stake: 10,
          league,
          kickoff,
          // For non-AI-recommended bets we mark the reason so the user
          // knows in History this was their own override, not an AI pick.
          reasoning: isRecommended
            ? (sel.aiReason || `${marketName} — ${sel.label}`)
            : `Manual pick (AI verdict: ${sel.aiVerdict.toUpperCase()}) — ${marketName}: ${sel.label}`,
          fixtureId,
        }),
      })
      if (!res.ok) throw new Error('insert failed')
      setAdded(true)
      onAdded?.()
    } catch {
      setError(true)
    } finally {
      setAdding(false)
    }
  }

  // Recommended → solid brand-on-hover button, prominent.
  // Other  → muted ghost button with subtle hover so it's still clickable
  //           but doesn't compete for attention with the AI's actual pick.
  const buttonStateCls = added
    ? 'bg-success/10 text-success border-success/30 cursor-default'
    : error
    ? 'bg-loss/10 text-loss border-loss/30'
    : isRecommended
    ? 'bg-bg-elevated hover:bg-brand hover:text-bg-base text-fg border-border-subtle hover:border-brand'
    : 'bg-transparent hover:bg-bg-elevated text-fg-muted hover:text-fg border-border-subtle/50 hover:border-border-subtle opacity-60 hover:opacity-100'

  return (
    <div className="flex items-center gap-3 py-2 px-3 hover:bg-bg-base/50 transition-colors group">
      {/* Verdict dot */}
      <span
        className={`relative flex h-2.5 w-2.5 ${dot.bg} ${dot.ring} shrink-0`}
        title={dot.label}
        aria-label={`AI verdict: ${dot.label}`}
      />

      {/* Label */}
      <span className="text-fg text-[13px] font-semibold flex-1 min-w-0 truncate">
        {sel.label}
      </span>

      {/* Odds */}
      <span className="font-stat text-fg text-[13px] font-bold tabular-nums shrink-0 w-14 text-right">
        @ {sel.odds.toFixed(2)}
      </span>

      {/* EV */}
      <span
        className={`font-stat text-[11px] font-bold tabular-nums shrink-0 w-14 text-right ${evClass}`}
      >
        {sel.ev > 0 ? '+' : ''}
        {sel.ev}%
      </span>

      {/* Reason — desktop only, tooltip on mobile */}
      <span
        className="hidden md:inline text-fg-secondary text-[11px] flex-1 min-w-0 truncate italic"
        title={sel.aiReason}
      >
        {sel.aiReason}
      </span>

      {/* Add button — every row is addable. */}
      <button
        type="button"
        onClick={add}
        disabled={adding || added}
        className={`shrink-0 text-[10px] font-bold uppercase tracking-wider py-1 px-2 rounded border transition-all ${buttonStateCls}`}
        aria-label={added ? 'Added' : `Add ${sel.label} to bets`}
        title={
          added
            ? 'Added to your bets'
            : isRecommended
            ? `Add ${sel.label} to your bets (AI ${dot.label})`
            : `Add ${sel.label} to your bets — your call, AI rates this ${dot.label}`
        }
      >
        {added ? '✓' : error ? '!' : adding ? '…' : '+'}
      </button>
    </div>
  )
}

interface CategoryGroupProps {
  category: Category
  markets: Market[]
  defaultOpen: boolean
  fixtureId: number
  homeTeam: string
  awayTeam: string
  league: string
  kickoff: string
  onAdded?: () => void
}

function CategoryGroup({
  category,
  markets,
  defaultOpen,
  fixtureId,
  homeTeam,
  awayTeam,
  league,
  kickoff,
  onAdded,
}: CategoryGroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  const totalSelections = useMemo(
    () => markets.reduce((sum, m) => sum + m.selections.length, 0),
    [markets]
  )
  const betCount = useMemo(
    () =>
      markets.reduce(
        (sum, m) => sum + m.selections.filter((s) => s.aiVerdict === 'bet').length,
        0
      ),
    [markets]
  )

  return (
    <section className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 py-2 px-3 bg-bg-elevated hover:bg-bg-base transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span
            className={`text-fg-muted text-xs leading-none transition-transform ${
              open ? 'rotate-90' : ''
            }`}
          >
            ▶
          </span>
          <span className="eyebrow truncate">{CATEGORY_LABEL[category]}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {betCount > 0 && (
            <span className="font-stat text-[10px] font-bold text-success bg-success/10 border border-success/30 px-1.5 py-0.5">
              {betCount} BET
            </span>
          )}
          <span className="font-stat text-fg-muted text-[10px] tabular-nums">
            {totalSelections}
          </span>
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          {markets.map((m) => (
            <div key={`${m.name}-${m.line ?? ''}`} className="bg-bg-base/40 border border-border-subtle p-2">
              {markets.length > 1 && (
                <p className="eyebrow px-2 mb-1.5">{m.name}</p>
              )}
              <div className="space-y-0.5">
                {m.selections.map((sel) => (
                  <SelectionRow
                    key={sel.label}
                    sel={sel}
                    marketName={m.name}
                    fixtureId={fixtureId}
                    homeTeam={homeTeam}
                    awayTeam={awayTeam}
                    league={league}
                    kickoff={kickoff}
                    onAdded={onAdded}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function AllMarketsPanel({
  fixtureId,
  homeTeam,
  awayTeam,
  league,
  kickoff,
  onAdded,
}: Props) {
  const [data, setData] = useState<AllMarketsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    // Hard 12s client-side timeout so the panel never spins forever even
    // if a bad upstream gateway holds the connection open.
    const aborter = new AbortController()
    const timeoutId = setTimeout(() => aborter.abort(), 12_000)

    fetch(`/api/fixtures/${fixtureId}/all-markets`, {
      cache: refreshTick > 0 ? 'no-store' : 'default',
      signal: aborter.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setData(json as AllMarketsResponse)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        const msg = e?.name === 'AbortError'
          ? 'Took too long to load markets — tap Retry to try again.'
          : (e?.message || 'Failed to load markets')
        setError(msg)
        setLoading(false)
      })
      .finally(() => clearTimeout(timeoutId))
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      aborter.abort()
    }
  }, [fixtureId, refreshTick])

  const grouped = useMemo(() => {
    if (!data) return [] as Array<{ category: Category; markets: Market[] }>
    const map = new Map<Category, Market[]>()
    for (const m of data.markets) {
      if (!map.has(m.category)) map.set(m.category, [])
      map.get(m.category)!.push(m)
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      markets: map.get(c) ?? [],
    }))
  }, [data])

  const totalBets = useMemo(() => {
    if (!data) return 0
    return data.markets.reduce(
      (sum, m) => sum + m.selections.filter((s) => s.aiVerdict === 'bet').length,
      0
    )
  }, [data])

  return (
    <div className="bg-bg-surface border border-border-subtle p-3 md:p-4 mt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="min-w-0">
          <p className="eyebrow">All Markets</p>
          {data && (
            <p className="text-fg-muted text-[11px] mt-0.5">
              <span className="font-stat">{data.markets.length}</span> markets ·{' '}
              <span className="font-stat text-success font-bold">{totalBets}</span> AI bets ·{' '}
              <span className="text-fg-secondary">tap “+” on any row to add to your bets</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setRefreshTick((t) => t + 1)}
          disabled={loading}
          className="text-fg-muted hover:text-brand text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
          aria-label="Refresh markets"
        >
          <span className={`text-sm leading-none ${loading ? 'animate-spin' : ''}`}>↻</span>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-bg-elevated h-12 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error — only for true network/HTTP failures (the API now returns
          a shaped payload with a `note` for any "no markets" case). */}
      {error && !loading && (
        <div className="bg-loss/5 border border-loss/20 p-3 text-center my-2">
          <p className="text-loss text-sm font-semibold">Couldn’t load markets</p>
          <p className="text-fg-muted text-[11px] mt-1">{error}</p>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="mt-2 text-[11px] font-bold uppercase tracking-wider py-1 px-3 rounded border border-loss/40 text-loss hover:bg-loss/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty (or AI-failed) — shaped payload returned a diagnostic note. */}
      {!loading && !error && data && data.markets.length === 0 && (
        <div className="bg-bg-elevated border border-border-subtle p-4 text-center my-2">
          <p className="text-fg text-sm font-semibold mb-1">No markets to show</p>
          <p className="text-fg-muted text-[12px] leading-relaxed">
            {data.diagnostics?.note ??
              'No markets available from bookmakers for this fixture yet.'}
          </p>
          {data.fixture?.status && data.fixture.status !== 'NS' && (
            <p className="text-fg-muted text-[10px] mt-2 font-stat uppercase tracking-wider">
              Status: {data.fixture.status}
            </p>
          )}
        </div>
      )}

      {/* Soft notice — markets did load, but the AI evaluator didn't return
          (rare, but the user deserves to know rather than see all-skip). */}
      {!loading && !error && data && data.markets.length > 0 && data.diagnostics?.ai_evaluated === false && (
        <div className="bg-value/5 border border-value/20 px-3 py-2 mb-2 text-[11px] text-value text-center">
          {data.diagnostics?.note ?? 'AI verdicts unavailable — showing odds only.'}
        </div>
      )}

      {/* Legend */}
      {data && data.markets.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-[10px] text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 bg-success" /> BET
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 bg-value" /> LEAN
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 bg-fg-muted/40" /> SKIP
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 bg-loss" /> AVOID
          </span>
        </div>
      )}

      {/* Groups */}
      {data && grouped.map((g, idx) => (
        <CategoryGroup
          key={g.category}
          category={g.category}
          markets={g.markets}
          defaultOpen={idx < 2}
          fixtureId={fixtureId}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          league={league}
          kickoff={kickoff}
          onAdded={onAdded}
        />
      ))}

      {data && (
        <p className="text-fg-muted text-[10px] text-center mt-3">
          Generated {new Date(data.generatedAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })} · cached 1h · GPT-4o-mini
        </p>
      )}
    </div>
  )
}
