'use client'

import { useState, useEffect } from 'react'

const STEP_COUNT = 4

const TOP_LEAGUES = [
  { id: 'premier_league', label: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'la_liga', label: 'La Liga', flag: '🇪🇸' },
  { id: 'serie_a', label: 'Serie A', flag: '🇮🇹' },
  { id: 'bundesliga', label: 'Bundesliga', flag: '🇩🇪' },
  { id: 'ligue_1', label: 'Ligue 1', flag: '🇫🇷' },
  { id: 'champions_league', label: 'Champions League', flag: '🏆' },
  { id: 'europa_league', label: 'Europa League', flag: '🥈' },
  { id: 'eredivisie', label: 'Eredivisie', flag: '🇳🇱' },
]

const BET_TYPES = [
  '1X2 (Match Result)',
  'Over/Under Goals',
  'Both Teams Score',
  'Accumulators',
  'Asian Handicap',
  'Correct Score',
]

interface OnboardingData {
  favourite_team: string
  lucky_charm_team: string
  favourite_leagues: string[]
  betting_experience: string
  monthly_pl_estimate: string
  preferred_bet_types: string[]
}

interface Props {
  isOpen: boolean
  onComplete: () => void
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`transition-all duration-300 ${
            i < current
              ? 'w-6 h-2 bg-violet-500'
              : i === current
              ? 'w-6 h-2 bg-violet-400'
              : 'w-2 h-2 bg-white/15'
          }`}
        />
      ))}
    </div>
  )
}

function MultiSelect({
  options,
  selected,
  onChange,
  max,
}: {
  options: { id: string; label: string; flag?: string }[]
  selected: string[]
  onChange: (v: string[]) => void
  max?: number
}) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id))
    } else if (!max || selected.length < max) {
      onChange([...selected, id])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const isSelected = selected.includes(opt.id)
        const isDisabled = !isSelected && !!max && selected.length >= max
        return (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            disabled={isDisabled}
            className={`flex items-center gap-1.5 px-3 py-2 border text-sm font-medium transition-all ${
              isSelected
                ? 'bg-violet-600/30 border-violet-500/60 text-white'
                : isDisabled
                ? 'bg-white/3 border-white/8 text-white/20 cursor-not-allowed'
                : 'bg-white/5 border-white/12 text-white/70 hover:border-violet-500/40 hover:text-white'
            }`}
          >
            {opt.flag && <span>{opt.flag}</span>}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default function OnboardingModal({ isOpen, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    favourite_team: '',
    lucky_charm_team: '',
    favourite_leagues: [],
    betting_experience: '',
    monthly_pl_estimate: '',
    preferred_bet_types: [],
  })

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  function update<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  async function handleFinish() {
    setSaving(true)
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch (e) {
      console.error('Onboarding save failed:', e)
    } finally {
      setSaving(false)
      onComplete()
    }
  }

  function canAdvance(): boolean {
    if (step === 0) return true // welcome, no required fields
    if (step === 1) return data.favourite_leagues.length > 0
    if (step === 2) return !!data.betting_experience
    if (step === 3) return !!data.monthly_pl_estimate
    return true
  }

  const steps = [
    // Step 0: Welcome
    <div key="welcome" className="flex flex-col items-center text-center py-4">
      <div className="w-20 h-20 bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-4xl mb-5 shadow-xl shadow-violet-500/30">
        🏆
      </div>
      <h2 className="text-2xl font-black text-white mb-3">Welcome to MatchMind</h2>
      <p className="text-white/50 text-sm max-w-xs leading-relaxed">
        Let's personalise your experience. It only takes 60 seconds — your answers shape the predictions and advice you get.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-3 w-full">
        {[
          { icon: '🔮', label: 'Predictions tuned to your leagues' },
          { icon: '🤖', label: 'AI Coach knows your style' },
          { icon: '🔥', label: 'Value bets for your markets' },
        ].map(item => (
          <div key={item.icon} className="bg-white/5 border border-white/8 p-3 text-center">
            <p className="text-2xl mb-1">{item.icon}</p>
            <p className="text-white/50 text-[11px] leading-tight">{item.label}</p>
          </div>
        ))}
      </div>
    </div>,

    // Step 1: Leagues + Teams
    <div key="teams" className="space-y-5">
      <div>
        <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-2">
          Which leagues do you follow? <span className="text-violet-400">(pick up to 4)</span>
        </label>
        <MultiSelect
          options={TOP_LEAGUES}
          selected={data.favourite_leagues}
          onChange={v => update('favourite_leagues', v)}
          max={4}
        />
      </div>

      <div>
        <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-2">
          Your favourite team <span className="text-white/30">(optional)</span>
        </label>
        <input
          value={data.favourite_team}
          onChange={e => update('favourite_team', e.target.value)}
          placeholder="e.g. Manchester City, Real Madrid..."
          className="w-full bg-white/5 border border-white/12 px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/60 transition-colors"
        />
      </div>

      <div>
        <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-2">
          Your lucky charm team <span className="text-white/30">(team you always back)</span>
        </label>
        <input
          value={data.lucky_charm_team}
          onChange={e => update('lucky_charm_team', e.target.value)}
          placeholder="e.g. Brentford always pays off for me..."
          className="w-full bg-white/5 border border-white/12 px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/60 transition-colors"
        />
      </div>
    </div>,

    // Step 2: Experience
    <div key="experience" className="space-y-4">
      <div>
        <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-3">
          How experienced are you with betting?
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'beginner', label: 'Beginner', desc: 'Just getting started', icon: '🌱' },
            { id: 'casual', label: 'Casual', desc: 'A few bets a week', icon: '⚽' },
            { id: 'serious', label: 'Serious', desc: 'Tracking bets & ROI', icon: '📊' },
            { id: 'professional', label: 'Professional', desc: 'Full bankroll management', icon: '🎯' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => update('betting_experience', opt.id)}
              className={`p-4 border text-left transition-all ${
                data.betting_experience === opt.id
                  ? 'bg-violet-600/20 border-violet-500/60'
                  : 'bg-white/5 border-white/8 hover:border-violet-500/30'
              }`}
            >
              <p className="text-xl mb-1">{opt.icon}</p>
              <p className="text-white font-semibold text-sm">{opt.label}</p>
              <p className="text-white/40 text-xs mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-3">
          Preferred bet types <span className="text-white/30">(optional)</span>
        </label>
        <MultiSelect
          options={BET_TYPES.map(b => ({ id: b, label: b }))}
          selected={data.preferred_bet_types}
          onChange={v => update('preferred_bet_types', v)}
        />
      </div>
    </div>,

    // Step 3: P&L
    <div key="pl" className="space-y-4">
      <div>
        <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-3">
          How would you describe your monthly betting P&L?
        </label>
        <p className="text-white/30 text-xs mb-4">Be honest — this helps the AI give you more useful advice, not judge you.</p>
        <div className="space-y-3">
          {[
            { id: 'losing', label: "I'm usually down at the end of the month", icon: '📉', color: 'border-red-500/30' },
            { id: 'breakeven', label: "I roughly break even — sometimes up, sometimes down", icon: '↔️', color: 'border-amber-500/30' },
            { id: 'slight_profit', label: "I make a slight profit most months", icon: '📈', color: 'border-emerald-500/30' },
            { id: 'consistent_profit', label: "I'm consistently profitable", icon: '💰', color: 'border-emerald-400/50' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => update('monthly_pl_estimate', opt.id)}
              className={`w-full flex items-center gap-4 p-4 border text-left transition-all ${
                data.monthly_pl_estimate === opt.id
                  ? `bg-violet-600/15 border-violet-500/60`
                  : `bg-white/5 border-white/8 hover:border-white/20`
              }`}
            >
              <span className="text-2xl shrink-0">{opt.icon}</span>
              <span className="text-white/80 text-sm">{opt.label}</span>
              {data.monthly_pl_estimate === opt.id && (
                <span className="ml-auto text-violet-400 text-lg shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
  ]

  const stepTitles = [
    "Let's get you set up",
    "Your football world",
    "Your betting style",
    "Your P&L history",
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)' }}
    >
      <div className="relative w-full max-w-lg bg-[#0D0D1A] border border-white/10 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wide">{stepTitles[step]}</p>
            <p className="text-white/30 text-xs">Step {step + 1} of {STEP_COUNT}</p>
          </div>
          <ProgressDots current={step + 1} total={STEP_COUNT} />
        </div>

        {/* Content */}
        <div className="px-6 py-5 min-h-[340px]">
          {steps[step]}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-4 py-2.5 text-sm font-semibold text-white/50 hover:text-white bg-white/5 hover:bg-white/8 transition-all border border-white/8"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          {step < STEP_COUNT - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/20"
            >
              {step === 0 ? "Let's go →" : 'Continue →'}
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!canAdvance() || saving}
              className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
            >
              {saving ? 'Saving...' : '🚀 Finish Setup'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
