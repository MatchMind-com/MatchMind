'use client'

/**
 * LeagueFilterBar — horizontal chip row of league filters for /dashboard/picks.
 *
 * - Active chip: brand-orange background, cream text, no border ring
 * - Inactive: muted text, transparent background, hover lifts to fg-secondary
 * - "All" is always first; clicking it clears the filter
 * - Mobile: scrolls horizontally with edge-bleed (no scrollbar)
 */

export interface LeagueChip {
  /** Stable key — usually the league name itself, since the API returns names not ids. */
  key: string
  /** Visible label (e.g. "Premier League", "UCL"). */
  label: string
  /** Optional flag emoji prefix. */
  flag?: string
  /** How many picks fall under this league in the current tab — drives the count chip. */
  count?: number
}

interface Props {
  leagues: LeagueChip[]
  /** Currently selected league keys. Empty = "All". */
  selected: string[]
  /** Toggles a single league. The page handles routing via URL params. */
  onToggle: (leagueKey: string) => void
  /** Clears all selected leagues. */
  onClear: () => void
}

export default function LeagueFilterBar({ leagues, selected, onToggle, onClear }: Props) {
  const isAllActive = selected.length === 0

  return (
    <div className="-mx-5 lg:mx-0 px-5 lg:px-0 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-2 min-w-max pb-1">
        {/* "All" chip — always first */}
        <button
          type="button"
          onClick={onClear}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-150 ${
            isAllActive
              ? 'bg-brand text-bg-base'
              : 'text-fg-muted hover:text-fg-secondary bg-transparent border border-border-subtle'
          }`}
        >
          All
        </button>

        {leagues.map((l) => {
          const active = selected.includes(l.key)
          return (
            <button
              key={l.key}
              type="button"
              onClick={() => onToggle(l.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-150 inline-flex items-center gap-1.5 ${
                active
                  ? 'bg-brand text-bg-base'
                  : 'text-fg-muted hover:text-fg-secondary bg-transparent border border-border-subtle'
              }`}
              aria-pressed={active}
            >
              {l.flag && <span className="text-[12px] leading-none">{l.flag}</span>}
              <span>{l.label}</span>
              {typeof l.count === 'number' && l.count > 0 && (
                <span
                  className={`font-stat text-[10px] px-1 rounded ${
                    active ? 'bg-bg-base/20 text-bg-base' : 'text-fg-muted'
                  }`}
                >
                  {l.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
