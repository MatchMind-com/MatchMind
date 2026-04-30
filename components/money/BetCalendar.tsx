'use client'

/**
 * BetCalendar — month grid of bets, dot-coded by result.
 *
 * Cells:
 *   - Day number (top-left)
 *   - Up to 3 colored dots (green=win, red=loss, gray=pending) + "+N" overflow
 *   - Day total P/L (bottom-right) when there are settled bets
 *   - Today gets a brand-orange ring
 *   - Days outside the active month are muted
 *
 * Interactions:
 *   - Click a day with bets → calls onSelectDate(YYYY-MM-DD)
 *   - Hover (desktop) → tooltip lists each bet (selection · odds · result)
 *   - Prev / Today / Next month controls
 *
 * Mobile: cells shrink, dots remain visible, P/L drops to a single +/- glyph,
 * tooltip is suppressed in favour of the click-to-filter behaviour.
 *
 * No new dependencies — pure CSS grid + tokens already in /app/globals.css.
 */

import { useMemo, useState } from 'react'
import type { Currency } from './MoneyClient'

export interface CalendarBet {
  id: string
  date: string                       // YYYY-MM-DD (match_date or kick_off, normalised)
  result: 'win' | 'loss' | 'void' | 'pending'
  profit_loss: number | null
  selection: string | null
  bet_type: string | null
  match_name: string | null
  odds: number | null
}

interface Props {
  bets: CalendarBet[]
  currency: Currency
  selectedDate: string | null        // when set, that day gets the brand fill
  onSelectDate: (date: string | null) => void
}

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']  // Mon-first

// ── Helpers ─────────────────────────────────────────────────────────────────

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

/** Mon-first index of a Date's weekday, 0..6 */
function monIndex(d: Date): number {
  const js = d.getDay()  // 0 = Sun
  return (js + 6) % 7
}

function buildGrid(year: number, month: number): Date[] {
  // 6 rows × 7 cols starting from the Monday on/before the 1st.
  const first = startOfMonth(year, month)
  const offset = monIndex(first)
  const start = new Date(year, month, 1 - offset)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }
  return days
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BetCalendar({ bets, currency, selectedDate, onSelectDate }: Props) {
  const today = useMemo(() => new Date(), [])
  const todayKey = ymd(today)

  // Cursor month — defaults to current month
  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }))

  // Group bets by date for O(1) lookup per cell
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarBet[]>()
    for (const b of bets) {
      if (!b.date) continue
      const list = m.get(b.date)
      if (list) list.push(b)
      else m.set(b.date, [b])
    }
    return m
  }, [bets])

  const grid = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor])

  const monthLabel = useMemo(() => {
    return new Date(cursor.year, cursor.month, 1).toLocaleString('en-GB', {
      month: 'long',
      year: 'numeric',
    })
  }, [cursor])

  // Aggregate P/L across the active month (settled only)
  const monthTotals = useMemo(() => {
    let pl = 0
    let count = 0
    for (const d of grid) {
      if (d.getMonth() !== cursor.month) continue
      const list = byDate.get(ymd(d))
      if (!list) continue
      for (const b of list) {
        count++
        if (b.result === 'win' || b.result === 'loss') pl += b.profit_loss ?? 0
      }
    }
    return { pl: Math.round(pl * 100) / 100, count }
  }, [grid, byDate, cursor])

  function prev() {
    setCursor((c) => {
      const d = new Date(c.year, c.month - 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }
  function next() {
    setCursor((c) => {
      const d = new Date(c.year, c.month + 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }
  function goToday() {
    setCursor({ year: today.getFullYear(), month: today.getMonth() })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="eyebrow">Activity · {monthLabel}</p>
          <p className="text-fg-muted text-[11px] mt-0.5 font-stat">
            {monthTotals.count} bet{monthTotals.count === 1 ? '' : 's'}
            {monthTotals.count > 0 && (
              <>
                {' · '}
                <span
                  className={
                    monthTotals.pl >= 0 ? 'text-success' : 'text-loss'
                  }
                >
                  {monthTotals.pl >= 0 ? '+' : ''}
                  {monthTotals.pl.toFixed(2)}u
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous month"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-bg-base border border-border-subtle hover:border-border-strong text-fg-secondary hover:text-fg transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-3 h-8 inline-flex items-center rounded-lg bg-bg-base border border-border-subtle hover:border-border-strong text-fg text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next month"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-bg-base border border-border-subtle hover:border-border-strong text-fg-secondary hover:text-fg transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* DOW row */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW_LABELS.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="text-fg-muted text-[10px] font-bold uppercase tracking-wider text-center py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === cursor.month
          const key = ymd(d)
          const list = byDate.get(key) ?? []
          const isToday = key === todayKey
          const isSelected = selectedDate === key

          // Sort bets within day so dot order is stable: wins, losses, pending, void
          const sorted = [...list].sort((a, b) => weight(a.result) - weight(b.result))
          const dotsToShow = sorted.slice(0, 3)
          const overflow = sorted.length - dotsToShow.length

          let dayPL = 0
          let settledCount = 0
          for (const b of list) {
            if (b.result === 'win' || b.result === 'loss') {
              dayPL += b.profit_loss ?? 0
              settledCount++
            }
          }
          dayPL = Math.round(dayPL * 100) / 100

          const clickable = list.length > 0
          const baseCell =
            'relative aspect-square sm:aspect-[5/4] flex flex-col rounded-lg p-1.5 sm:p-2 transition-colors text-left border w-full'

          const stateClass = isSelected
            ? 'bg-brand/15 border-brand text-fg'
            : isToday
              ? 'bg-bg-elevated border-brand/60 text-fg ring-1 ring-brand/40'
              : inMonth
                ? clickable
                  ? 'bg-bg-base border-border-subtle hover:border-border-strong hover:bg-bg-elevated text-fg'
                  : 'bg-bg-base border-border-subtle text-fg-secondary'
                : 'bg-transparent border-transparent text-fg-muted/60'

          return (
            <div key={i} className="relative group">
              <button
                type="button"
                disabled={!clickable && !isSelected}
                onClick={() => {
                  if (!clickable && !isSelected) return
                  onSelectDate(isSelected ? null : key)
                }}
                className={`${baseCell} ${stateClass} disabled:cursor-default`}
                aria-label={`${key}${list.length ? `, ${list.length} bet${list.length === 1 ? '' : 's'}` : ''}`}
              >
                <span
                  className={`font-stat text-[11px] sm:text-xs leading-none ${
                    isToday ? 'font-bold' : 'font-semibold'
                  }`}
                >
                  {d.getDate()}
                </span>

                {/* Dots */}
                {dotsToShow.length > 0 && (
                  <div className="flex items-center gap-0.5 mt-1">
                    {dotsToShow.map((b) => (
                      <span
                        key={b.id}
                        className={`w-1.5 h-1.5 rounded-full ${dotClass(b.result)}`}
                        aria-hidden
                      />
                    ))}
                    {overflow > 0 && (
                      <span className="text-fg-muted font-stat text-[9px] ml-0.5">
                        +{overflow}
                      </span>
                    )}
                  </div>
                )}

                {/* Day P/L */}
                {settledCount > 0 && (
                  <span
                    className={`mt-auto self-end font-stat text-[10px] sm:text-[11px] font-semibold leading-none ${
                      dayPL >= 0 ? 'text-success' : 'text-loss'
                    }`}
                  >
                    <span className="hidden sm:inline">
                      {dayPL >= 0 ? '+' : ''}
                      {dayPL.toFixed(1)}u
                    </span>
                    <span className="sm:hidden">{dayPL >= 0 ? '+' : '−'}</span>
                  </span>
                )}
              </button>

              {/* Hover tooltip — desktop only */}
              {list.length > 0 && (
                <DayTooltip date={key} bets={sorted} currency={currency} />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-3 flex-wrap text-[10px] font-bold uppercase tracking-wider text-fg-muted">
        <LegendDot color="bg-success" label="Won" />
        <LegendDot color="bg-loss" label="Lost" />
        <LegendDot color="bg-fg-muted" label="Pending" />
        {selectedDate && (
          <button
            type="button"
            onClick={() => onSelectDate(null)}
            className="ml-auto text-brand hover:underline normal-case tracking-normal text-[11px] font-semibold"
          >
            Clear day filter
          </button>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function DayTooltip({
  date,
  bets,
  currency,
}: {
  date: string
  bets: CalendarBet[]
  currency: Currency
}) {
  void currency  // reserved for future per-bet currency formatting
  return (
    <div
      className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 w-[220px] pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      aria-hidden
    >
      <div className="bg-bg-elevated border border-border-strong rounded-lg shadow-xl p-3">
        <p className="eyebrow mb-2">{date}</p>
        <ul className="space-y-1.5">
          {bets.slice(0, 6).map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-fg truncate">{b.selection ?? b.bet_type ?? '—'}</span>
              <span className="font-stat text-fg-secondary shrink-0">
                @{b.odds != null ? b.odds.toFixed(2) : '—'}
              </span>
              <span
                className={`font-stat shrink-0 ${
                  b.result === 'win'
                    ? 'text-success'
                    : b.result === 'loss'
                      ? 'text-loss'
                      : 'text-fg-muted'
                }`}
              >
                {b.result === 'pending' ? '…' : b.result === 'void' ? '○' : b.result === 'win' ? '✓' : '✗'}
              </span>
            </li>
          ))}
          {bets.length > 6 && (
            <li className="text-fg-muted text-[10px] text-center pt-1">
              +{bets.length - 6} more
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  )
}

// ── Pure helpers ────────────────────────────────────────────────────────────

function dotClass(r: CalendarBet['result']): string {
  if (r === 'win') return 'bg-success'
  if (r === 'loss') return 'bg-loss'
  if (r === 'void') return 'bg-fg-muted/60'
  return 'bg-fg-muted'  // pending
}

function weight(r: CalendarBet['result']): number {
  if (r === 'win') return 0
  if (r === 'loss') return 1
  if (r === 'pending') return 2
  return 3  // void
}
