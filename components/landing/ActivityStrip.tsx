'use client'

import { useState, useEffect } from 'react'

const MESSAGES = [
  { city: 'Manchester', action: 'just signed up', ago: '2 min ago' },
  { city: 'London', action: 'found a +19% EV bet', ago: '8 min ago' },
  { city: 'Birmingham', action: 'just signed up', ago: '11 min ago' },
  { city: 'Glasgow', action: 'just signed up', ago: '18 min ago' },
  { city: 'Liverpool', action: 'found a value bet', ago: '24 min ago' },
  { city: 'Leeds', action: 'just signed up', ago: '31 min ago' },
  { city: 'Edinburgh', action: 'found a +14% EV bet', ago: '37 min ago' },
  { city: 'Bristol', action: 'just signed up', ago: '45 min ago' },
]

export default function ActivityStrip() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % MESSAGES.length)
        setVisible(true)
      }, 400)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const msg = MESSAGES[idx]

  return (
    <div
      className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/10 px-4 py-2 text-xs transition-opacity duration-400"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <span className="w-1.5 h-1.5 bg-emerald-400 shrink-0" />
      <span className="text-white/50">
        Someone from <span className="text-white font-semibold">{msg.city}</span> {msg.action}
      </span>
      <span className="text-white/25">{msg.ago}</span>
    </div>
  )
}
