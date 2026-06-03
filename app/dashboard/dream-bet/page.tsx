'use client'

import { useEffect, useMemo, useState } from 'react'

type RiskLevel = 'conservative' | 'balanced' | 'aggressive'

interface Goal {
  id: string
  starting_bankroll: number
  current_bankroll: number
  target: number
  end_date: string
  risk_level: RiskLevel
  created_at: string
  updated_at: string
}

interface Plan {
  daysRemaining: number
  requiredDailyGrowthPct: number
  recommendedStake: number
  kellyFraction: number
  qualifyingBetsHint: string
  onTrack: boolean
  progressPct: number
  motivational: string
}

const RISK_DESCRIPTIONS: Record<RiskLevel, string> = {
  conservative: 'Quarter-Kelly. Slow and steady. Lowest variance.',
  balanced: 'Half-Kelly. Standard pro staking. Balanced growth.',
  aggressive: 'Three-quarter Kelly. Higher variance, faster growth.',
}

function fmtMoney(n: number) {
  return `£${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function DreamBetPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  // Form state
  const [startingBankroll, setStartingBankroll] = useState('100')
  const [currentBankroll, setCurrentBankroll] = useState('')
  const [target, setTarget] = useState('500')
  const [endDate, setEndDate] = useState(todayPlus(90))
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('balanced')

  useEffect(() => {
    fetch('/api/dream-bet')
      .then((r) => r.json())
      .then((data) => {
        if (data?.goal) {
          setGoal(data.goal)
          setPlan(data.plan)
          setStartingBankroll(String(data.goal.starting_bankroll))
          setCurrentBankroll(String(data.goal.current_bankroll))
          setTarget(String(data.goal.target))
          setEndDate(data.goal.end_date)
          setRiskLevel(data.goal.risk_level)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/dream-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starting_bankroll: parseFloat(startingBankroll),
          current_bankroll: currentBankroll
            ? parseFloat(currentBankroll)
            : parseFloat(startingBankroll),
          target: parseFloat(target),
          end_date: endDate,
          risk_level: riskLevel,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? 'Save failed')
      setGoal(data.goal)
      setPlan(data.plan)
      setEditing(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Trajectory bars (last N "buckets" between start date and end date,
  // showing target trajectory vs current bankroll)
  const trajectory = useMemo(() => {
    if (!goal) return [] as { label: string; targetVal: number; actual: number | null }[]
    const start = new Date(goal.created_at)
    const end = new Date(goal.end_date)
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000))
    const today = new Date()
    const elapsed = Math.max(0, Math.min(totalDays, Math.ceil((today.getTime() - start.getTime()) / 86_400_000)))
    const buckets = 10
    const out: { label: string; targetVal: number; actual: number | null }[] = []
    for (let i = 1; i <= buckets; i++) {
      const fraction = i / buckets
      const dayOffset = Math.round(fraction * totalDays)
      const targetVal =
        goal.starting_bankroll + (goal.target - goal.starting_bankroll) * fraction
      const elapsedFraction = elapsed / totalDays
      const isPast = fraction <= elapsedFraction
      const actual = isPast
        ? // simple linear interp from start to current for completed buckets
          goal.starting_bankroll +
          (goal.current_bankroll - goal.starting_bankroll) * (fraction / Math.max(elapsedFraction, 0.0001))
        : null
      out.push({
        label: `D+${dayOffset}`,
        targetVal,
        actual,
      })
    }
    return out
  }, [goal])

  const maxTrajectoryVal = useMemo(() => {
    if (!goal) return 0
    return Math.max(goal.target, goal.current_bankroll, goal.starting_bankroll) * 1.05
  }, [goal])

  if (loading) {
    return (
      <div className="p-6 lg:p-8 min-h-screen bg-[#09090C]">
        <div className="max-w-5xl mx-auto">
          <div className="h-32 bg-white/[0.03] border border-white/[0.06] animate-pulse" />
        </div>
      </div>
    )
  }

  const showForm = !goal || editing

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-[#09090C]">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <p className="text-orange-400 text-[11px] font-bold uppercase tracking-widest mb-1.5">
            The Dream Bet
          </p>
          <h1 className="text-white text-2xl lg:text-3xl font-black">Set a goal. Trust the math.</h1>
          <p className="text-white/40 text-sm mt-1.5">
            Define a target. We compute the daily plan using the Kelly Criterion.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3">
            {error}
          </div>
        )}

        {/* Goal Setup Form */}
        {showForm && (
          <div className="bg-[#0E0E12] border border-white/[0.08] p-6">
            <h2 className="text-white font-black text-lg mb-4">
              {goal ? 'Update your goal' : 'Define your dream bet'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/50 text-xs font-bold mb-1.5 uppercase tracking-wide">
                  Starting bankroll (£)
                </label>
                <input
                  type="number"
                  min="1"
                  value={startingBankroll}
                  onChange={(e) => setStartingBankroll(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 px-3 py-2.5 text-white text-sm focus:border-orange-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-white/50 text-xs font-bold mb-1.5 uppercase tracking-wide">
                  Target (£)
                </label>
                <input
                  type="number"
                  min="1"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 px-3 py-2.5 text-white text-sm focus:border-orange-500/50 focus:outline-none"
                />
              </div>
              {goal && (
                <div>
                  <label className="block text-white/50 text-xs font-bold mb-1.5 uppercase tracking-wide">
                    Current bankroll (£)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={currentBankroll}
                    onChange={(e) => setCurrentBankroll(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 px-3 py-2.5 text-white text-sm focus:border-orange-500/50 focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-white/50 text-xs font-bold mb-1.5 uppercase tracking-wide">
                  End date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 px-3 py-2.5 text-white text-sm focus:border-orange-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-white/50 text-xs font-bold mb-2 uppercase tracking-wide">
                Risk level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['conservative', 'balanced', 'aggressive'] as RiskLevel[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRiskLevel(r)}
                    className={`py-2.5 text-xs font-bold capitalize transition-all border ${
                      riskLevel === r
                        ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                        : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white/80'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-2">{RISK_DESCRIPTIONS[riskLevel]}</p>
            </div>

            <div className="flex gap-2 mt-5">
              {goal && (
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white/70 font-bold py-2.5 text-sm transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-black py-2.5 text-sm transition-all"
              >
                {saving ? 'Saving...' : goal ? 'Update Goal' : 'Set Goal'}
              </button>
            </div>
          </div>
        )}

        {/* Daily Plan */}
        {goal && plan && !editing && (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Current" value={fmtMoney(goal.current_bankroll)} accent="text-white" />
              <StatCard label="Target" value={fmtMoney(goal.target)} accent="text-orange-400" />
              <StatCard label="Days left" value={String(plan.daysRemaining)} accent="text-orange-400" />
              <StatCard
                label="Status"
                value={plan.onTrack ? 'On track' : 'Behind pace'}
                accent={plan.onTrack ? 'text-emerald-400' : 'text-amber-400'}
              />
            </div>

            {/* Progress bar */}
            <div className="bg-[#0E0E12] border border-white/[0.08] p-5">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-white font-bold text-sm">Progress to target</h3>
                <span className="text-white/60 text-xs font-bold">{plan.progressPct}%</span>
              </div>
              <div className="bg-white/[0.05] h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-emerald-500 transition-all"
                  style={{ width: `${plan.progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-white/40 text-[11px]">
                <span>{fmtMoney(goal.starting_bankroll)}</span>
                <span>{fmtMoney(goal.target)}</span>
              </div>
            </div>

            {/* Today's plan */}
            <div className="bg-[#0E0E12] border border-orange-500/20 p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-white font-black text-base">Today&apos;s plan</h3>
                <span className="text-orange-400 text-[10px] font-bold uppercase tracking-widest">
                  {goal.risk_level}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <PlanRow label="Recommended stake" value={fmtMoney(plan.recommendedStake)} />
                <PlanRow
                  label="Required daily growth"
                  value={`${plan.requiredDailyGrowthPct.toFixed(2)}%`}
                />
                <PlanRow
                  label="Kelly fraction"
                  value={`${(plan.kellyFraction * 100).toFixed(0)}%`}
                />
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-white/50 text-[11px] font-bold uppercase tracking-wide mb-1">
                  Bets that qualify today
                </p>
                <p className="text-white text-sm">{plan.qualifyingBetsHint}</p>
              </div>
              <div className="mt-3 bg-white/[0.03] border border-white/[0.06] p-3">
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">
                  AI coach
                </p>
                <p className="text-white/85 text-sm italic">&ldquo;{plan.motivational}&rdquo;</p>
              </div>
            </div>

            {/* Trajectory chart */}
            <div className="bg-[#0E0E12] border border-white/[0.08] p-5">
              <h3 className="text-white font-bold text-sm mb-4">Bankroll trajectory</h3>
              <div className="flex items-end justify-between gap-1.5 h-40">
                {trajectory.map((b, i) => {
                  const targetH = (b.targetVal / maxTrajectoryVal) * 100
                  const actualH = b.actual != null ? (b.actual / maxTrajectoryVal) * 100 : 0
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div className="w-full flex items-end gap-0.5 h-full">
                        <div
                          className="flex-1 bg-orange-500/20  border-t border-orange-500/40"
                          style={{ height: `${targetH}%` }}
                          title={`Target ${fmtMoney(b.targetVal)}`}
                        />
                        {b.actual != null && (
                          <div
                            className="flex-1 bg-emerald-500/40  border-t border-emerald-400"
                            style={{ height: `${actualH}%` }}
                            title={`Actual ${fmtMoney(b.actual)}`}
                          />
                        )}
                      </div>
                      <span className="text-white/30 text-[9px]">{b.label}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-orange-500/20 border border-orange-500/40" />
                  <span className="text-white/50">Target</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-500/40 border border-emerald-400" />
                  <span className="text-white/50">Actual</span>
                </span>
              </div>
            </div>

            {/* Edit button */}
            <div>
              <button
                onClick={() => setEditing(true)}
                className="bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white/70 font-bold px-4 py-2 text-sm transition-all"
              >
                Edit goal
              </button>
            </div>
          </>
        )}

        <p className="text-white/25 text-[10px] text-center pt-4">
          18+ | Gamble responsibly | begambleaware.org
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0E0E12] border border-white/[0.08] p-4">
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-black text-lg ${accent}`}>{value}</p>
    </div>
  )
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] p-3">
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white font-black text-base">{value}</p>
    </div>
  )
}
