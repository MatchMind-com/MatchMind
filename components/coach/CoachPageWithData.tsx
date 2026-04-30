'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import MemoriesDrawer from '@/components/coach/MemoriesDrawer'
import CoachHeader from '@/components/coach/CoachHeader'
import QuickPrompts from '@/components/coach/QuickPrompts'
import CoachNewsPanel from '@/components/coach/CoachNewsPanel'
import { BetRecInline } from '@/components/coach/BetRecSidebar'
import type { BetRecommendation } from '@/lib/parse-bet-rec'

const NEWS_OPEN_STORAGE_KEY = 'mm_coach_news_open'

interface Message {
  role: 'user' | 'assistant'
  content: string
  memoriesUsed?: number
  betRecommendation?: BetRecommendation | null
  betAddState?: 'idle' | 'adding' | 'added' | 'error'
  betDismissed?: boolean
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l14-9-7 18-2-7-5-2z" />
    </svg>
  )
}

function MicIcon({ recording }: { recording: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ${recording ? 'text-loss' : 'text-fg-muted'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  )
}

function SpeakerIcon({ playing }: { playing: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 ${playing ? 'text-brand' : 'text-fg-muted'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072M8.464 8.464A5 5 0 006 12M18 6a9 9 0 010 12"
      />
    </svg>
  )
}

function BotIcon() {
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

// Detect Web Speech API support
const hasSpeechRecognition =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

/**
 * Wipe MediaSession metadata + action handlers so macOS / iOS / Android don't
 * surface a "now playing" badge or floating music icon when we play TTS clips.
 * Defensive — only runs in browsers that expose the API.
 */
function suppressMediaSession() {
  if (typeof navigator === 'undefined') return
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = null
    const actions = ['play', 'pause', 'stop', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack'] as const
    for (const a of actions) {
      navigator.mediaSession.setActionHandler?.(a, null)
    }
    if ('playbackState' in navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'none'
    }
  } catch {
    // No-op — the badge isn't critical, don't crash the page
  }
}

interface MessageRowProps {
  message: Message
  index: number
  playingIndex: number | null
  onSpeak: () => void
  onAddBet: () => void
  onDismissBet: () => void
  onOpenMemories: () => void
}

function MessageRow({
  message,
  index,
  playingIndex,
  onSpeak,
  onAddBet,
  onDismissBet,
  onOpenMemories,
}: MessageRowProps) {
  const isUser = message.role === 'user'
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-brand text-bg-base rounded-2xl rounded-tr-sm px-4 py-3 max-w-[75%] text-[15px] leading-relaxed font-medium">
          {message.content}
        </div>
      </div>
    )
  }

  const showBet = !!message.betRecommendation && !message.betDismissed

  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-brand/10 border border-brand/30 text-brand flex items-center justify-center mt-0.5">
        <BotIcon />
      </div>
      <div className="flex-1 min-w-0 max-w-[85%]">
        <div className="bg-bg-surface border border-border-subtle text-fg rounded-2xl rounded-tl-sm px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>

        {showBet && message.betRecommendation && (
          <BetRecInline
            rec={message.betRecommendation}
            addState={message.betAddState ?? 'idle'}
            onAdd={onAddBet}
            onDismiss={onDismissBet}
          />
        )}

        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onSpeak}
            title={playingIndex === index ? 'Stop playback' : 'Read aloud'}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
              playingIndex === index
                ? 'text-brand'
                : 'text-fg-muted hover:text-fg-secondary'
            }`}
          >
            <SpeakerIcon playing={playingIndex === index} />
            {playingIndex === index ? 'Playing…' : 'Read aloud'}
          </button>
          {!!message.memoriesUsed && message.memoriesUsed > 0 && (
            <button
              onClick={onOpenMemories}
              title={`Used ${message.memoriesUsed} memor${
                message.memoriesUsed === 1 ? 'y' : 'ies'
              } from past chats — click to view`}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-brand/80 hover:text-brand hover:bg-brand/10 border border-brand/30 transition-all"
            >
              <span>💭</span>
              remembered {message.memoriesUsed}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CoachPageWithData({
  user,
  profile,
}: {
  user: any
  profile: any
}) {
  // Props kept for signature compatibility with the server entry; not yet
  // surfaced in the UI but available for future personalisation hooks.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _user = user
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _profile = profile

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
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

  // News drawer — defaults closed; preference persisted via localStorage
  const [newsOpen, setNewsOpen] = useState(false)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(NEWS_OPEN_STORAGE_KEY)
      if (saved === '1') setNewsOpen(true)
    } catch {
      // localStorage may be blocked (private mode / SSR); silent fallback
    }
  }, [])
  const toggleNews = useCallback(() => {
    setNewsOpen(prev => {
      const next = !prev
      try {
        window.localStorage.setItem(NEWS_OPEN_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }, [])
  const closeNews = useCallback(() => {
    setNewsOpen(false)
    try {
      window.localStorage.setItem(NEWS_OPEN_STORAGE_KEY, '0')
    } catch {
      // ignore
    }
  }, [])

  // Toast for "Added to your tracker" feedback
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Suppress macOS now-playing badge whenever the page is mounted
  useEffect(() => {
    suppressMediaSession()
  }, [])

  const addBetFromRec = useCallback(async (index: number, rec: BetRecommendation) => {
    setMessages(prev => prev.map((m, i) => (i === index ? { ...m, betAddState: 'adding' } : m)))
    try {
      const res = await fetch('/api/bet-slips/from-rec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rec),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json().catch(() => ({}))
      if (!json?.success) throw new Error('Insert failed')
      setMessages(prev => prev.map((m, i) => (i === index ? { ...m, betAddState: 'added' } : m)))
      setToast('Added to your tracker')
    } catch {
      setMessages(prev => prev.map((m, i) => (i === index ? { ...m, betAddState: 'error' } : m)))
      setToast('Could not add bet — try the manual form')
    }
  }, [])

  const dismissBet = useCallback((index: number) => {
    setMessages(prev => prev.map((m, i) => (i === index ? { ...m, betDismissed: true } : m)))
  }, [])

  const speakMessage = useCallback(
    async (text: string, index: number) => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (playingIndex === index) {
        setPlayingIndex(null)
        suppressMediaSession()
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
        audio.preload = 'none'
        audio.controls = false
        audioRef.current = audio

        // Suppress before AND after starting playback — some browsers reset
        // the metadata on the first play() call
        suppressMediaSession()

        audio.onplay = () => suppressMediaSession()
        audio.onended = () => {
          setPlayingIndex(null)
          URL.revokeObjectURL(url)
          suppressMediaSession()
        }
        audio.onerror = () => {
          setPlayingIndex(null)
          URL.revokeObjectURL(url)
          suppressMediaSession()
        }
        await audio.play()
        suppressMediaSession()
      } catch {
        setPlayingIndex(null)
        suppressMediaSession()
      }
    },
    [playingIndex]
  )

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
          // leagueId no longer driven by the (now removed) sidebar — server
          // route falls back to its own default when omitted
        }),
      })
      const data = await res.json()
      if (data.reply) {
        const memoriesUsed: number = data?.context?.memoriesUsed ?? 0
        const betRecommendation: BetRecommendation | null = data?.betRecommendation ?? null
        setMessages(prev => {
          const next: Message[] = [
            ...prev,
            {
              role: 'assistant',
              content: data.reply,
              memoriesUsed,
              betRecommendation,
              betAddState: 'idle',
              betDismissed: false,
            },
          ]
          if (voiceMode) {
            setTimeout(() => speakMessage(data.reply, next.length - 1), 200)
          }
          return next
        })
        setMemoriesRefreshKey(k => k + 1)
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I ran into an error. Please try again.' },
      ])
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

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
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
    if (voiceMode && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingIndex(null)
      suppressMediaSession()
    }
    setVoiceMode(v => !v)
  }

  const isEmptyConversation = messages.length === 0

  return (
    <div className="flex flex-col h-full w-full bg-bg-base">
      <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-6 lg:py-10 min-h-0">
        {/* Header */}
        <CoachHeader
          voiceMode={voiceMode}
          onToggleVoice={toggleVoiceMode}
          onOpenMemories={() => setMemoriesOpen(true)}
          onToggleNews={toggleNews}
          newsOpen={newsOpen}
        />

        {/* Browser warning */}
        {unsupportedBrowser && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-value/10 border border-value/30 text-value text-xs flex items-center justify-between">
            <span>Voice input requires Chrome or Edge. Switch browser to use the mic.</span>
            <button
              onClick={() => setUnsupportedBrowser(false)}
              className="ml-3 hover:text-fg"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick prompts row — only when conversation has started */}
        {!isEmptyConversation && (
          <div className="mt-5">
            <QuickPrompts
              onPrompt={msg => sendMessage(msg)}
              disabled={loading}
              variant="row"
            />
          </div>
        )}

        {/* Messages or empty state */}
        <div className="flex-1 min-h-0 mt-6 flex flex-col">
          {isEmptyConversation ? (
            <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
              <div className="text-center mb-6">
                <p className="eyebrow mb-3">Start a conversation</p>
                <h2 className="text-2xl md:text-3xl font-extrabold text-fg tracking-tight leading-tight">
                  Ask anything about football, your bets, or today&rsquo;s matches.
                </h2>
                <p className="mt-3 text-fg-secondary text-sm">
                  Pick a prompt below, or just type below ↓
                </p>
              </div>
              <QuickPrompts
                onPrompt={msg => sendMessage(msg)}
                disabled={loading}
                variant="grid"
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-5 pb-2">
              {messages.map((m, i) => (
                <MessageRow
                  key={i}
                  message={m}
                  index={i}
                  playingIndex={playingIndex}
                  onSpeak={() => speakMessage(m.content, i)}
                  onAddBet={() => m.betRecommendation && addBetFromRec(i, m.betRecommendation)}
                  onDismissBet={() => dismissBet(i)}
                  onOpenMemories={() => setMemoriesOpen(true)}
                />
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-brand">
                    <BotIcon />
                  </div>
                  <div className="bg-bg-surface border border-border-subtle px-4 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input — pinned to bottom of the centered column */}
        <div className="mt-6 pt-4 border-t border-border-subtle">
          <form
            onSubmit={e => {
              e.preventDefault()
              sendMessage()
            }}
            className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-2xl px-2 py-2 focus-within:border-brand transition-colors"
          >
            <button
              type="button"
              onClick={toggleRecording}
              title={recording ? 'Stop recording' : 'Speak your question'}
              className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
                recording
                  ? 'bg-loss/15 text-loss animate-pulse'
                  : 'text-fg-muted hover:text-fg hover:bg-bg-elevated'
              }`}
            >
              <MicIcon recording={recording} />
              {recording && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-loss animate-ping" />
              )}
            </button>

            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={
                recording
                  ? 'Listening…'
                  : "Ask anything about football, your bets, or today's matches…"
              }
              className="flex-1 bg-transparent border-0 px-2 py-2.5 text-[15px] text-fg placeholder-fg-muted focus:outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 w-10 h-10 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-30 disabled:hover:bg-brand text-bg-base flex items-center justify-center transition-colors"
              title="Send"
            >
              <SendIcon />
            </button>
          </form>
          {voiceMode && (
            <p className="mt-2 text-[11px] text-brand/80 text-center font-medium">
              Voice mode — replies will be read aloud automatically
            </p>
          )}
        </div>
      </div>

      {/* Memories drawer */}
      <MemoriesDrawer
        open={memoriesOpen}
        onClose={() => setMemoriesOpen(false)}
        refreshKey={memoriesRefreshKey}
      />

      {/* News slide-in panel */}
      <CoachNewsPanel open={newsOpen} onClose={closeNews} />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-success/15 border border-success/40 text-success text-sm font-semibold shadow-lg backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  )
}
