'use client'

import { useState } from 'react'
import { PRIMARY_AFFILIATE } from '@/lib/affiliates'
import type { PickPrediction } from './PickCard'

/**
 * AccumulatorCard — restyled wrapper around the tiered acca logic from
 * /dashboard/predictions. Same algorithm (collect every +EV market, prefer
 * league diversity, cap at 3 legs) — new editorial chrome.
 *
 * Three tiers: Safe / Balanced / Big Win. Each is rendered as one card.
 */

export type TieredBet = {
  pred: PickPrediction
  market: 'Home Win' | 'Away Win' | 'Over 2.5' | 'BTTS'
  odds: number
  ev: number
}

export type Tier = {
  key: 'safe' | 'balanced' | 'bigwin'
  label: string
  subtitle: string
  range: string
  /** Used as the warm accent — Safe: success, Balanced: brand, Big Win: loss */
  accent: 'success' | 'brand' | 'loss'
  filter: (odds: number) => boolean
}

export const TIERS: Tier[] = [
  {
    key: 'safe',
    label: 'Safe',
    subtitle: 'Low odds, high hit rate',
    range: '1.40–1.80',
    accent: 'success',
    filter: (o) => o >= 1.4 && o < 1.8,
  },
  {
    key: 'balanced',
    label: 'Balanced',
    subtitle: 'Balanced risk / reward',
    range: '1.80–2.50',
    accent: 'brand',
    filter: (o) => o >= 1.8 && o < 2.5,
  },
  {
    key: 'bigwin',
    label: 'Big Win',
    subtitle: 'Bigger payout, lower hit rate',
    range: '2.50–4.00',
    accent: 'loss',
    filter: (o) => o >= 2.5 && o <= 4.0,
  },
]

export function collectAllBets(predictions: PickPrediction[]): TieredBet[] {
  const MARKETS: { label: TieredBet['market']; oddsKey: 'home' | 'away' | 'over25' | 'btts' }[] = [
    { label: 'Home Win', oddsKey: 'home' },
    { label: 'Away Win', oddsKey: 'away' },
    { label: 'Over 2.5', oddsKey: 'over25' },
    { label: 'BTTS', oddsKey: 'btts' },
  ]
  const out: TieredBet[] = []
  for (const p of predictions) {
    if (!p.bookmaker) continue
    // We need EV per market; PickPrediction's optional `ev` isn't typed here,
    // so use a duck-typed lookup off the underlying object.
    const ev = (p as unknown as { ev?: Record<string, number | null> }).ev
    if (!ev) continue
    for (const m of MARKETS) {
      const evKey =
        m.oddsKey === 'over25' ? 'over25' : m.oddsKey === 'btts' ? 'btts' : m.oddsKey
      const evVal = ev[evKey]
      const odds = p.bookmaker[m.oddsKey]
      if (evVal != null && evVal > 0 && evVal <= 25 && odds != null && odds <= 4.0) {
        out.push({ pred: p, market: m.label, odds, ev: evVal })
      }
    }
  }
  return out
}

export function buildTierAcca(allBets: TieredBet[], tier: Tier): TieredBet[] {
  const tierBets = allBets.filter((b) => tier.filter(b.odds)).sort((a, b) => b.ev - a.ev)
  const picked: TieredBet[] = []
  const usedLeagues = new Set<string>()
  const usedFixtures = new Set<number>()
  // Pass 1: unique leagues
  for (const b of tierBets) {
    if (picked.length >= 3) break
    if (usedLeagues.has(b.pred.league) || usedFixtures.has(b.pred.id)) continue
    picked.push(b)
    usedLeagues.add(b.pred.league)
    usedFixtures.add(b.pred.id)
  }
  // Pass 2: relax league constraint
  for (const b of tierBets) {
    if (picked.length >= 3) break
    if (usedFixtures.has(b.pred.id)) continue
    picked.push(b)
    usedFixtures.add(b.pred.id)
  }
  return picked
}

interface Props {
  tier: Tier
  legs: TieredBet[]
}

function accentClasses(accent: Tier['accent']) {
  switch (accent) {
    case 'success':
      return {
        text: 'text-success',
        bg: 'bg-success/10',
        border: 'border-success/25',
      }
    case 'brand':
      return {
        text: 'text-brand',
        bg: 'bg-brand/10',
        border: 'border-brand/25',
      }
    case 'loss':
      return {
        text: 'text-loss',
        bg: 'bg-loss/10',
        border: 'border-loss/25',
      }
  }
}

export default function AccumulatorCard({ tier, legs }: Props) {
  const [copied, setCopied] = useState(false)
  const a = accentClasses(tier.accent)

  const combinedOdds = legs.length > 0 ? legs.reduce((acc, l) => acc * l.odds, 1) : 0
  const combinedEV = legs.length > 0 ? Math.round(legs.reduce((acc, l) => acc + l.ev, 0)) : 0

  function copyText() {
    const lines = legs
      .map(
        (l, i) =>
          `${i + 1}. ${l.pred.home_team} vs ${l.pred.away_team} — ${l.market} @ ${l.odds.toFixed(2)}`
      )
      .join('\n')
    const text = `${lines}\n\n${tier.label} Acca · Combined @ ${combinedOdds.toFixed(
      2
    )} · +${combinedEV}% EV\nBuilt by MatchMind`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Empty state for this tier — calm, useful, never red
  if (legs.length === 0) {
    return (
      <article className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
        <div className={`px-5 py-3 border-b border-border-subtle flex items-center justify-between ${a.bg}`}>
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="eyebrow">ACCUMULATOR</span>
            <span className={`text-sm font-bold ${a.text}`}>{tier.label}</span>
            <span className="text-fg-muted text-xs truncate">{tier.subtitle}</span>
          </div>
          <span className="font-stat text-fg-muted text-[10px] uppercase tracking-wider whitespace-nowrap">
            odds {tier.range}
          </span>
        </div>
        <div className="p-6 text-center">
          <p className="text-fg-secondary text-sm">
            No +EV accumulators in this odds range today.
          </p>
          <p className="text-fg-muted text-xs mt-1">
            Try the {tier.key === 'safe' ? 'Balanced' : 'Safe'} tier — different odds, different opportunities.
          </p>
        </div>
      </article>
    )
  }

  return (
    <article className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
      {/* Header strip */}
      <div className={`px-5 py-3 border-b border-border-subtle flex items-center justify-between flex-wrap gap-2 ${a.bg}`}>
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="eyebrow">ACCUMULATOR</span>
          <span className={`text-sm font-bold ${a.text}`}>{tier.label}</span>
          <span className="text-fg-muted text-xs truncate hidden sm:inline">{tier.subtitle}</span>
        </div>
        <div className="flex items-baseline gap-3 shrink-0">
          <span className={`font-stat text-xl font-black ${a.text}`}>
            @ {combinedOdds.toFixed(2)}
          </span>
          <span className="font-stat text-[11px] font-bold text-value bg-value/10 border border-value/30 px-2 py-0.5 rounded-full">
            +{combinedEV}% EV
          </span>
        </div>
      </div>

      <div className="p-5">
        <p className="text-fg-muted text-xs mb-4">
          {legs.length} leg{legs.length === 1 ? '' : 's'} · all positive EV ·{' '}
          {new Set(legs.map((l) => l.pred.league)).size}{' '}
          {new Set(legs.map((l) => l.pred.league)).size === 1 ? 'league' : 'different leagues'}
        </p>

        {/* Legs */}
        <div className="space-y-2 mb-5">
          {legs.map((l, i) => (
            <div
              key={`${l.pred.id}-${l.market}`}
              className="flex items-center gap-3 bg-bg-elevated border border-border-subtle rounded-xl px-3 py-2.5"
            >
              <div
                className={`w-6 h-6 rounded-md ${a.bg} ${a.text} font-stat font-black text-xs flex items-center justify-center shrink-0 border ${a.border}`}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-fg text-sm font-semibold truncate">
                  {l.pred.home_team} vs {l.pred.away_team}
                </p>
                <p className="text-fg-muted text-[11px] truncate">
                  {l.pred.leagueFlag ? `${l.pred.leagueFlag} ` : ''}
                  {l.pred.league}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-fg text-sm font-bold">
                  {l.market}{' '}
                  <span className="font-stat text-brand">@ {l.odds.toFixed(2)}</span>
                </p>
                <p className={`font-stat ${a.text} text-[10px] font-bold`}>+{l.ev}% EV</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer — return calc + actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 text-sm">
            <span className="text-fg-muted">£10 → </span>
            <span className="font-stat text-fg font-bold">
              £{(10 * combinedOdds).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyText}
              className="text-xs font-semibold py-2 px-3 rounded-lg border border-border-subtle bg-bg-elevated hover:bg-bg-base text-fg transition-all duration-200"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <a
              href={PRIMARY_AFFILIATE.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold py-2 px-3 rounded-lg bg-brand hover:bg-brand-hover text-bg-base transition-all duration-200 inline-flex items-center gap-1.5"
            >
              Place on {PRIMARY_AFFILIATE.short}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}
