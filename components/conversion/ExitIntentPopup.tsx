'use client'
import { useEffect, useState, useRef } from 'react'

const STORAGE_KEY = 'matchmind_exit_popup_last_shown'
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface ExitIntentPopupProps {
  subscriptionTier: 'free' | 'pro' | 'elite'
}

export default function ExitIntentPopup({ subscriptionTier }: ExitIntentPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60) // 24h countdown in seconds
  const hasShownRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only for free users
    if (subscriptionTier !== 'free') return

    // Check cooldown
    const lastShown = localStorage.getItem(STORAGE_KEY)
    if (lastShown && Date.now() - parseInt(lastShown) < COOLDOWN_MS) return

    // Small delay before activating to let page settle
    const activationTimer = setTimeout(() => {
      const handleMouseLeave = (e: MouseEvent) => {
        if (e.clientY <= 10 && !hasShownRef.current) {
          hasShownRef.current = true
          setIsVisible(true)
          localStorage.setItem(STORAGE_KEY, Date.now().toString())
          document.removeEventListener('mouseleave', handleMouseLeave)
        }
      }
      document.addEventListener('mouseleave', handleMouseLeave)
      return () => document.removeEventListener('mouseleave', handleMouseLeave)
    }, 3000)

    return () => clearTimeout(activationTimer)
  }, [subscriptionTier])

  // Countdown timer
  useEffect(() => {
    if (!isVisible) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isVisible])

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0')
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return { h, m, s }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText('MATCHMIND20')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const handleClose = () => setIsVisible(false)

  if (!isVisible) return null

  const { h, m, s } = formatTime(timeLeft)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="relative w-full max-w-md bg-[#0F0F1A] border overflow-hidden shadow-2xl"
        style={{ borderColor: 'rgba(99,102,241,0.4)' }}
      >
        {/* Purple glow top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600" />

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all z-10 text-sm"
        >
          ✕
        </button>

        <div className="px-7 pt-7 pb-6 text-center">
          {/* Emoji */}
          <div className="text-5xl mb-4">⚡</div>

          <div className="inline-flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 px-3 py-1 mb-4">
            <div className="w-1.5 h-1.5 bg-red-400 animate-pulse" />
            <span className="text-red-400 text-xs font-bold uppercase tracking-wide">Limited Time Offer</span>
          </div>

          <h2 className="text-2xl font-black text-white mb-2 leading-tight">
            Wait — get your first month<br />
            <span className="text-violet-400">for just £7.99</span>
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Save 20% on Pro. Use code at checkout.<br />Offer expires in:
          </p>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[{ val: h, label: 'HRS' }, { val: m, label: 'MIN' }, { val: s, label: 'SEC' }].map(({ val, label }, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-slate-500 font-bold text-lg mb-4">:</span>}
                <div className="text-center">
                  <div className="w-14 h-14 bg-[#1A1A2E] border border-white/10 flex items-center justify-center">
                    <span className="text-2xl font-black text-white font-mono">{val}</span>
                  </div>
                  <span className="text-slate-600 text-[10px] font-bold mt-1 block">{label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Coupon code */}
          <div
            className="flex items-center justify-between bg-[#1A1A2E] border border-dashed border-violet-500/40 px-4 py-3 mb-5 cursor-pointer group"
            onClick={handleCopyCode}
          >
            <div className="text-left">
              <div className="text-xs text-slate-500 mb-0.5">Your discount code</div>
              <div className="text-xl font-black text-violet-400 tracking-widest font-mono">MATCHMIND20</div>
            </div>
            <button className="bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-400 text-xs font-bold px-3 py-2 transition-all">
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>

          {/* CTA */}
          <a
            href="/api/stripe/create-checkout?plan=pro&coupon=MATCHMIND20"
            className="block w-full text-center bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 transition-all shadow-lg shadow-violet-500/25 mb-3"
          >
            Claim 20% Off → Start Free Trial
          </a>

          <button
            onClick={handleClose}
            className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
          >
            No thanks, I'd rather pay full price
          </button>
        </div>
      </div>
    </div>
  )
}
