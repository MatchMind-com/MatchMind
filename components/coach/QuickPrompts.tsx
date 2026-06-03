'use client'

/**
 * 6 conversational starter chips. Layout adapts to context:
 *  - `variant="row"` — horizontal scroll row, used under the input or above the chat
 *  - `variant="grid"` — 2/3-column grid for the empty conversation state
 *
 * Submitting a chip immediately sends the message via `onPrompt`.
 */

export const QUICK_PROMPTS: Array<{ label: string; msg: string }> = [
  { label: 'Best bets today', msg: "What are the best value bets for today's fixtures?" },
  { label: 'Analyse my bets', msg: 'Analyse my recent betting history and identify my weaknesses.' },
  { label: 'Galatasaray injuries', msg: 'What are the latest Galatasaray injuries and how do they affect their next match?' },
  { label: 'Size a £20 bet on Arsenal', msg: 'Help me size a £20 bet on Arsenal — what odds and market should I take?' },
  { label: "What's my goal pace?", msg: "How am I tracking against my bankroll goal? Am I on pace?" },
  { label: 'Saudi Pro League weekend', msg: "What's worth watching in the Saudi Pro League this weekend?" },
]

interface QuickPromptsProps {
  onPrompt: (msg: string) => void
  disabled?: boolean
  variant?: 'row' | 'grid'
}

export default function QuickPrompts({ onPrompt, disabled, variant = 'row' }: QuickPromptsProps) {
  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p.label}
            onClick={() => onPrompt(p.msg)}
            disabled={disabled}
            className="text-left px-4 py-3 border border-border-subtle bg-bg-surface hover:border-brand hover:bg-bg-elevated text-sm text-fg-secondary hover:text-fg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-fg font-semibold">{p.label}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {QUICK_PROMPTS.map(p => (
        <button
          key={p.label}
          onClick={() => onPrompt(p.msg)}
          disabled={disabled}
          className="shrink-0 border border-border-subtle px-4 py-1.5 text-sm text-fg-secondary hover:border-brand hover:text-brand transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
