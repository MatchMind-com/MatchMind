'use client'

/**
 * Editorial header for the Coach page. Eyebrow + headline + subhead, plus
 * the Memory and Voice toggle pills aligned right. Pure presentational —
 * the parent owns all state.
 */

interface CoachHeaderProps {
  voiceMode: boolean
  onToggleVoice: () => void
  onOpenMemories: () => void
  onToggleNews: () => void
  newsOpen: boolean
}

function MemoryIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  )
}

function VoiceWaveIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072"
      />
    </svg>
  )
}

export default function CoachHeader({
  voiceMode,
  onToggleVoice,
  onOpenMemories,
  onToggleNews,
  newsOpen,
}: CoachHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-6 pb-6 border-b border-border-subtle">
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-2">MatchMind Coach</p>
        <h1 className="headline-lg text-fg leading-[1.05]">
          What&rsquo;s your edge today?
        </h1>
        <p className="mt-2 text-fg-secondary text-sm md:text-[15px] leading-relaxed max-w-xl">
          Powered by 25-league data, your bankroll, and your goals.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleNews}
          title={newsOpen ? 'Close news panel' : 'Open football news'}
          aria-pressed={newsOpen}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-all ${
            newsOpen
              ? 'bg-brand/10 border-brand text-brand'
              : 'border-border-subtle text-fg-secondary hover:border-brand hover:text-brand'
          }`}
        >
          <span aria-hidden>📰</span>
          <span className="hidden sm:inline">News</span>
        </button>

        <button
          onClick={onOpenMemories}
          title="Open Coach memory"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border-subtle text-fg-secondary hover:border-brand hover:text-brand transition-all"
        >
          <MemoryIcon />
          <span className="hidden sm:inline">Memory</span>
        </button>

        <button
          onClick={onToggleVoice}
          title={voiceMode ? 'Voice mode ON — click to turn off' : 'Turn on voice mode'}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-all ${
            voiceMode
              ? 'bg-brand/10 border-brand text-brand'
              : 'border-border-subtle text-fg-secondary hover:border-brand hover:text-brand'
          }`}
        >
          <VoiceWaveIcon />
          <span className="hidden sm:inline">Voice {voiceMode ? 'on' : 'off'}</span>
        </button>
      </div>
    </header>
  )
}
