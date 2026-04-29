'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import LiveFootballData from '@/components/football/LiveFootballData'
import NewsPanel from '@/components/coach/NewsPanel'
import MemoriesDrawer from '@/components/coach/MemoriesDrawer'
import type { BetRecommendation } from '@/lib/parse-bet-rec'

interface Message {
  role: 'user' | 'assistant'
  content: string
  memoriesUsed?: number
  betRecommendation?: BetRecommendation | null
  betAddState?: 'idle' | 'adding' | 'added' | 'error'
}

const QUICK_PROMPTS = [
  { label: 'Best bets today', msg: "What are the best value bets for today's fixtures?" },
  { label: 'Analyse my bets', msg: 'Analyse my recent betting history and identify my weaknesses.' },
  { label: 'In-form teams', msg: 'Which teams are in the best form right now and worth backing?' },
  { label: 'Clean sheet tips', msg: 'Which teams have the best defensive record for clean sheet bets?' },
  { label: 'BTTS picks', msg: 'Which upcoming matches are best for both teams to score?' },
  { label: 'Value odds', msg: 'Where can I find value in the odds for upcoming matches?' },
]

function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}

function MicIcon({ recording }: { recording: boolean }) {
  return (
    <svg className={`w-4 h-4 ${recording ? 'text-red-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  )
}

function SpeakerIcon({ playing }: { playing: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 ${playing ? 'text-blue-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072M8.464 8.464A5 5 0 006 12M18 6a9 9 0 010 12" />
    </svg>
  )
}

// Detect Web Speech API support
const hasSpeechRecognition = typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

export default function CoachPageWithData({ user, profile }: { user: any; profile: any }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Welcome to MatchMind Coach! I'm loaded with today's live fixtures, standings, and your betting history. Ask me anything — from today's best bets to analysing your form. What do you want to know?"
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [league, setLeague] = useState('39')
  const [tab, setTab] = useState<'chat' | 'news'>('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Voice state
  const [voiceMode, setVoiceMode] = useState(false)
  const [recording, setRecording] = useState(false)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [unsupportedBrowser, setUnsupportedBrowser] = useState(false)
  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Memories drawer
  const [memoriesOpen, setMemoriesOpen] = useState(false)
  const [memoriesRefreshKey, setMemoriesRefreshKey] = useState(0)

  // Toast for "Added to your tracker" feedback
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  // POSTs the AI's bet recommendation to /api/bet-slips/from-rec, which inserts
  // a row into bet_slips and returns { success, id }. Defensive — survives a
  // partially malformed rec because the server route does its own validation.
  const addBetFromRec = useCallback(async (index: number, rec: BetRecommendation) => {
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, betAddState: 'adding' } : m))
    try {
      const res = await fetch('/api/bet-slips/from-rec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rec),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json().catch(() => ({}))
      if (!json?.success) throw new Error('Insert failed')
      setMessages(prev => prev.map((m, i) => i === index ? { ...m, betAddState: 'added' } : m))
      setToast('Added to your tracker')
    } catch {
      setMessages(prev => prev.map((m, i) => i === index ? { ...m, betAddState: 'error' } : m))
      setToast('Could not add bet — try the manual form')
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // TTS playback
  const speakMessage = useCallback(async (text: string, index: number) => {
    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (playingIndex === index) {
      setPlayingIndex(null)
      return
    }

    setPlayingIndex(index)
    try {
      const res = await fetch('/api/voice-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('TTS failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setPlayingIndex(null)
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        setPlayingIndex(null)
        URL.revokeObjectURL(url)
      }
      await audio.play()
    } catch {
      setPlayingIndex(null)
    }
  }, [playingIndex])

  async function sendMessage(text?: string) {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/coach-with-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-8),
          leagueId: league,
        }),
      })
      const data = await res.json()
      if (data.reply) {
        const memoriesUsed: number = data?.context?.memoriesUsed ?? 0
        const betRecommendation: BetRecommendation | null = data?.betRecommendation ?? null
        setMessages(prev => {
          const next = [
            ...prev,
            {
              role: 'assistant' as const,
              content: data.reply,
              memoriesUsed,
              betRecommendation,
              betAddState: 'idle' as const,
            },
          ]
          // Auto-play if voice mode is active
          if (voiceMode) {
            setTimeout(() => speakMessage(data.reply, next.length - 1), 200)
          }
          return next
        })
        // New exchange persisted server-side — refresh drawer (only matters when open)
        setMemoriesRefreshKey(k => k + 1)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I ran into an error. Please try again.' }])
    }
    setLoading(false)
  }

  function toggleRecording() {
    if (!hasSpeechRecognition) {
      setUnsupportedBrowser(true)
      return
    }

    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-GB'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
      setRecording(false)
    }
    recognition.onerror = () => setRecording(false)
    recognition.onend = () => setRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  function toggleVoiceMode() {
    if (!hasSpeechRecognition && !voiceMode) {
      setUnsupportedBrowser(true)
      return
    }
    // Stop any playing audio when turning off
    if (voiceMode && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingIndex(null)
    }
    setVoiceMode(v => !v)
  }

  return (
    <div className="flex h-full gap-4 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Left: Football data sidebar */}
      <div className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 gap-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Live Football Data</p>
        <LiveFootballData onLeagueChange={setLeague} />
      </div>

      {/* Center: Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0E1628] rounded-2xl border border-white/[0.07] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-white">MatchMind Coach</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Live data connected
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Memory toggle */}
            <button
              onClick={() => setMemoriesOpen(true)}
              title="Open Coach memory"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white/[0.04] border-white/[0.07] text-slate-400 hover:text-orange-300 hover:border-orange-500/30 transition-all"
            >
              <span className="text-sm leading-none">🧠</span>
              Memory
            </button>

            {/* Voice toggle */}
            <button
              onClick={toggleVoiceMode}
              title={voiceMode ? 'Voice mode ON — click to turn off' : 'Turn on voice mode'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                voiceMode
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : 'bg-white/[0.04] border-white/[0.07] text-slate-500 hover:text-slate-300'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072" />
              </svg>
              Voice {voiceMode ? 'ON' : 'OFF'}
            </button>

            {/* Mobile tabs */}
            <div className="flex lg:hidden gap-1">
              <button onClick={() => setTab('chat')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tab === 'chat' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500'}`}>Chat</button>
              <button onClick={() => setTab('news')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tab === 'news' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500'}`}>News</button>
            </div>
          </div>
        </div>

        {/* Browser warning */}
        {unsupportedBrowser && (
          <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
            <span>Voice input requires Chrome or Edge. Switch browser to use the mic.</span>
            <button onClick={() => setUnsupportedBrowser(false)} className="ml-3 text-amber-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Quick prompts */}
        <div className="flex gap-2 px-4 py-2.5 overflow-x-auto border-b border-white/[0.05]" style={{ scrollbarWidth: 'none' }}>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => sendMessage(p.msg)}
              disabled={loading}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-blue-500/15 text-xs text-slate-400 hover:text-white border border-white/[0.07] hover:border-blue-500/30 transition-all font-medium"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 border ${
                m.role === 'assistant'
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  : 'bg-white/10 border-white/10 text-slate-400'
              }`}>
                {m.role === 'assistant' ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-1 max-w-[80%]">
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'assistant'
                    ? 'bg-white/[0.04] border border-white/[0.06] text-slate-200 rounded-tl-sm'
                    : 'bg-blue-600 text-white rounded-tr-sm'
                }`}>
                  {m.content}
                </div>

                {/* Bet recommendation button — only shows when the AI emitted a
                    structured [BET_REC] payload that the server parsed cleanly. */}
                {m.role === 'assistant' && m.betRecommendation && (
                  <BetRecCard
                    rec={m.betRecommendation}
                    state={m.betAddState ?? 'idle'}
                    onAdd={() => addBetFromRec(i, m.betRecommendation!)}
                  />
                )}

                {/* Assistant message footer: speaker + memory badge */}
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 self-start">
                    <button
                      onClick={() => speakMessage(m.content, i)}
                      title={playingIndex === i ? 'Stop playback' : 'Read aloud'}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] transition-all hover:bg-white/[0.06] ${
                        playingIndex === i ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      <SpeakerIcon playing={playingIndex === i} />
                      {playingIndex === i ? 'Playing…' : 'Read aloud'}
                    </button>
                    {!!m.memoriesUsed && m.memoriesUsed > 0 && (
                      <button
                        onClick={() => setMemoriesOpen(true)}
                        title={`Used ${m.memoriesUsed} memor${m.memoriesUsed === 1 ? 'y' : 'ies'} from past chats — click to view`}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-orange-300/70 hover:text-orange-300 hover:bg-orange-500/10 border border-orange-500/15 transition-all"
                      >
                        <span>💭</span>
                        remembered {m.memoriesUsed}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] px-4 py-3 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/[0.07]">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2">
            {/* Mic button */}
            <button
              type="button"
              onClick={toggleRecording}
              title={recording ? 'Stop recording' : 'Speak your question'}
              className={`px-3 py-3 rounded-xl border transition-all relative ${
                recording
                  ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse'
                  : 'bg-white/[0.04] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:border-white/20'
              }`}
            >
              <MicIcon recording={recording} />
              {recording && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              )}
            </button>

            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={recording ? 'Listening…' : 'Ask about today\'s matches, team form, value bets...'}
              className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-colors"
            >
              <SendIcon />
            </button>
          </form>
          {voiceMode && (
            <p className="mt-2 text-[10px] text-blue-400/60 text-center">
              Voice mode active — AI responses will be read aloud automatically
            </p>
          )}
        </div>
      </div>

      {/* Right: News panel (desktop) */}
      <div className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Football News</p>
        <NewsPanel />
      </div>

      {/* Memories drawer (slides in from right, overlays everything) */}
      <MemoriesDrawer
        open={memoriesOpen}
        onClose={() => setMemoriesOpen(false)}
        refreshKey={memoriesRefreshKey}
      />

      {/* Toast — bottom-centre, auto-dismisses after ~3s */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-sm font-medium shadow-lg backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  )
}

/**
 * Renders the AI's structured bet recommendation as a clickable button
 * that adds the bet to the user's tracker. Defensive — gracefully handles
 * partially malformed recs (e.g. missing kickoff or league).
 */
function BetRecCard({
  rec,
  state,
  onAdd,
}: {
  rec: BetRecommendation
  state: 'idle' | 'adding' | 'added' | 'error'
  onAdd: () => void
}) {
  const matchLabel = rec.home && rec.away
    ? `${rec.home} vs ${rec.away}`
    : (rec.selection || 'AI Pick')
  const marketLabel = [rec.market, rec.selection].filter(Boolean).join(' · ') || 'Bet'
  const oddsLabel = rec.odds ? `@ ${rec.odds.toFixed(2)}` : ''
  const stakeLabel = rec.stake ? `£${rec.stake.toFixed(2)}` : null

  const disabled = state === 'adding' || state === 'added'
  const label =
    state === 'adding' ? 'Adding…' :
    state === 'added' ? 'Added to tracker ✓' :
    state === 'error' ? 'Try again' :
    'Add to my bets'

  return (
    <button
      onClick={onAdd}
      disabled={disabled}
      className={`mt-1 self-start text-left rounded-xl border px-3.5 py-2.5 text-xs transition-all
        ${state === 'added'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200 cursor-default'
          : state === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-200 hover:bg-rose-500/15'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-200 hover:bg-blue-500/20 hover:border-blue-400/50'}
      `}
    >
      <div className="flex items-center gap-1.5 font-semibold mb-0.5">
        <span className="text-sm leading-none">{state === 'added' ? '✓' : '✚'}</span>
        <span>{label}</span>
      </div>
      <div className="text-[11px] opacity-80 leading-tight">
        <span className="font-medium">{matchLabel}</span>
        {rec.league && <span className="opacity-60"> · {rec.league}</span>}
      </div>
      <div className="text-[11px] opacity-90 mt-0.5">
        {marketLabel} {oddsLabel}{stakeLabel ? ` · ${stakeLabel}` : ''}
      </div>
    </button>
  )
}
