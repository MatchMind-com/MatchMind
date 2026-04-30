'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Currency } from './MoneyClient'

/**
 * BankrollTab — editorial bankroll dashboard.
 *
 * Two-column desktop layout:
 *  - Left  (60%): huge headline number, P&L, 30-day SVG trajectory, last 5 snapshots
 *  - Right (40%): Settings card (starting bankroll, currency, loss limit, reset)
 *                 + Quick deposit form
 *
 * All charts are inline SVG — no charting library — so we keep the bundle thin
 * and the look 100% on-brand. After any mutation we call onSnapshotsChange()
 * which is owned by MoneyClient and re-fetches /api/bankroll.
 */

interface Snapshot {
  id: string
  balance: number | string
  note: string | null
  recorded_at: string
}

interface Props {
  userId: string
  snapshots: Snapshot[]
  snapshotsLoaded: boolean
  startingBankroll: number
  currentBankroll: number
  lossLimit?: number | null
  currency: Currency
  onCurrencyChange: (c: Currency) => void
  onSnapshotsChange: () => void
}

function fmt(n: number, currency: string): string {
  return `${currency}${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function fmtShort(n: number, currency: string): string {
  return `${currency}${Math.round(n).toLocaleString()}`
}

// Compute delta vs the closest snapshot ≥ N days ago
function deltaSince(snapshots: Snapshot[], days: number, currentBankroll: number): number | null {
  if (snapshots.length === 0) return null
  const cutoff = Date.now() - days * 86_400_000
  // Walk backwards — find newest snapshot at or before the cutoff
  let baseline: number | null = null
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const t = new Date(snapshots[i].recorded_at).getTime()
    if (t <= cutoff) {
      baseline = Number(snapshots[i].balance)
      break
    }
  }
  // If every snapshot is newer than `days` ago, fall back to the very first one
  if (baseline == null) baseline = Number(snapshots[0].balance)
  return currentBankroll - baseline
}

export default function BankrollTab({
  snapshots,
  snapshotsLoaded,
  startingBankroll,
  currentBankroll,
  lossLimit,
  currency,
  onCurrencyChange,
  onSnapshotsChange,
}: Props) {
  // ── Settings inline-edit state ──────────────────────────────────────
  const [startingDraft, setStartingDraft] = useState<string>(String(startingBankroll || ''))
  const [savingStarting, setSavingStarting] = useState(false)
  const [lossLimitDraft, setLossLimitDraft] = useState<string>(
    lossLimit != null ? String(lossLimit) : ''
  )
  const [savingLossLimit, setSavingLossLimit] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositing, setDepositing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Live exposure (in-play stake / available / potential) ──────────
  // Fetches /api/bankroll directly so the same in-play breakdown that
  // BankrollHero shows on the Home page is mirrored here. Polling on a
  // 90s cadence picks up auto-settle writes from /api/bet-slips/my-live
  // without the user having to refresh.
  const [exposure, setExposure] = useState<{
    in_play_stake: number
    in_play_potential: number
    available: number
    counts: { pending: number; won: number; lost: number }
  } | null>(null)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/bankroll', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        setExposure({
          in_play_stake: Number(json.in_play_stake ?? 0),
          in_play_potential: Number(json.in_play_potential ?? 0),
          available: Number(json.available ?? 0),
          counts: json.counts ?? { pending: 0, won: 0, lost: 0 },
        })
      } catch {
        // best-effort — leave exposure null
      }
    }
    void load()
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    const poll = setInterval(() => void load(), 90_000)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      clearInterval(poll)
    }
  }, [])

  // ── Derived P&L deltas ──────────────────────────────────────────────
  const sevenDay = useMemo(() => deltaSince(snapshots, 7, currentBankroll), [snapshots, currentBankroll])
  const thirtyDay = useMemo(() => deltaSince(snapshots, 30, currentBankroll), [snapshots, currentBankroll])
  const allTime = currentBankroll - startingBankroll

  // Last 30 days of snapshots for the chart
  const chartSnapshots = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000
    return snapshots.filter((s) => new Date(s.recorded_at).getTime() >= cutoff)
  }, [snapshots])

  // Last 5 snapshots, newest first
  const recent = useMemo(() => [...snapshots].slice(-5).reverse(), [snapshots])

  // ── Mutations ───────────────────────────────────────────────────────
  async function saveStartingBankroll() {
    const amount = parseFloat(startingDraft)
    if (!Number.isFinite(amount) || amount <= 0) return
    setSavingStarting(true)
    setError(null)
    try {
      const res = await fetch('/api/bankroll/starting', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      if (!res.ok) throw new Error('Failed to update starting bankroll')
      onSnapshotsChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSavingStarting(false)
    }
  }

  async function saveLossLimit() {
    const v = lossLimitDraft.trim()
    const value = v === '' ? null : Number(v)
    if (value != null && (!Number.isFinite(value) || value < 0)) return
    setSavingLossLimit(true)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loss_limit: value }),
      })
      if (!res.ok) throw new Error('Failed to update loss limit')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSavingLossLimit(false)
    }
  }

  async function quickDeposit() {
    const add = parseFloat(depositAmount)
    if (!Number.isFinite(add) || add <= 0) return
    const newBalance = currentBankroll + add
    setDepositing(true)
    setError(null)
    try {
      const res = await fetch('/api/bankroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: newBalance, note: `Deposit ${currency}${add.toFixed(2)}` }),
      })
      if (!res.ok) throw new Error('Failed to record deposit')
      setDepositAmount('')
      onSnapshotsChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deposit failed')
    } finally {
      setDepositing(false)
    }
  }

  async function resetBankroll() {
    const confirmText = window.prompt(
      'This will permanently delete all your bankroll snapshots and reset your starting bankroll.\n\nType RESET to confirm.'
    )
    if (confirmText !== 'RESET') return
    setResetting(true)
    setError(null)
    try {
      const res = await fetch('/api/bankroll/reset', { method: 'POST' })
      if (!res.ok) throw new Error('Reset failed')
      onSnapshotsChange()
      setStartingDraft('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
      {/* ───── Left column — headline + chart ───── */}
      <div className="lg:col-span-3 space-y-4 lg:space-y-6">
        {/* HEADLINE NUMBER */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5 lg:p-7">
          <p className="eyebrow mb-3">CURRENT BANKROLL</p>
          <p className="font-stat text-fg text-5xl md:text-6xl leading-none tracking-tight">
            {currency}
            {currentBankroll.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>

          {/* P&L deltas */}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <DeltaLine label="7d" value={sevenDay} currency={currency} />
            <DeltaLine label="30d" value={thirtyDay} currency={currency} />
            <DeltaLine label="all-time" value={allTime} currency={currency} />
          </div>

          {/* Live exposure — same 3-cell strip as BankrollHero on the Home
              page. Only shown when the user actually has pending bets so
              the card stays clean for users who haven't started yet. */}
          {exposure && exposure.in_play_stake > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-3 p-3 rounded-xl bg-bg-base/50 border border-border-subtle">
              <div>
                <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">In play</p>
                <p className="font-stat text-loss text-base font-bold tabular-nums leading-tight">
                  {currency}{exposure.in_play_stake.toFixed(2)}
                </p>
                <p className="text-fg-muted text-[10px] mt-0.5">
                  {exposure.counts.pending} bet{exposure.counts.pending === 1 ? '' : 's'}
                </p>
              </div>
              <div>
                <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">Available</p>
                <p className="font-stat text-fg text-base font-bold tabular-nums leading-tight">
                  {currency}{exposure.available.toFixed(2)}
                </p>
                <p className="text-fg-muted text-[10px] mt-0.5">free to stake</p>
              </div>
              <div>
                <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">If all win</p>
                <p className="font-stat text-success text-base font-bold tabular-nums leading-tight">
                  {currency}{(exposure.available + exposure.in_play_potential).toFixed(2)}
                </p>
                <p className="text-fg-muted text-[10px] mt-0.5">
                  +{currency}{(exposure.in_play_potential - exposure.in_play_stake).toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* TRAJECTORY CHART */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="eyebrow">30-DAY TRAJECTORY</h3>
            <span className="text-fg-muted text-[11px] font-stat">
              {chartSnapshots.length} {chartSnapshots.length === 1 ? 'point' : 'points'}
            </span>
          </div>
          <TrajectoryChart
            snapshots={chartSnapshots}
            currency={currency}
            loaded={snapshotsLoaded}
          />
        </div>

        {/* RECENT SNAPSHOTS — tiny mono table */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="eyebrow mb-4">LAST 5 SNAPSHOTS</h3>
          {recent.length === 0 ? (
            <p className="text-fg-muted text-sm py-3">
              No snapshots yet. Record a deposit to start tracking.
            </p>
          ) : (
            <div className="font-stat text-sm">
              {recent.map((s, i) => {
                const balance = Number(s.balance)
                const prev = recent[i + 1]
                const diff = prev ? balance - Number(prev.balance) : null
                const date = new Date(s.recorded_at)
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-3 items-baseline py-2 border-b border-border-subtle last:border-b-0"
                  >
                    <span className="text-fg-secondary text-[12px]">
                      {date.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                    <span
                      className={`text-[12px] tabular-nums ${
                        diff == null
                          ? 'text-fg-muted'
                          : diff >= 0
                            ? 'text-success'
                            : 'text-loss'
                      }`}
                    >
                      {diff == null
                        ? '—'
                        : `${diff >= 0 ? '+' : ''}${currency}${Math.abs(diff).toFixed(2)}`}
                    </span>
                    <span className="text-fg font-semibold tabular-nums">
                      {fmt(balance, currency)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ───── Right column — settings + quick deposit ───── */}
      <div className="lg:col-span-2 space-y-4 lg:space-y-6">
        {error && (
          <div className="bg-loss/10 border border-loss/30 text-loss text-xs rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* SETTINGS */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5 space-y-5">
          <h3 className="eyebrow">SETTINGS</h3>

          {/* Starting bankroll */}
          <div>
            <label className="block text-fg-secondary text-[11px] font-semibold uppercase tracking-wider mb-1.5">
              Starting bankroll
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-bg-base border border-border-subtle rounded-lg focus-within:border-brand transition-colors">
                <span className="pl-3 text-fg-muted font-stat">{currency}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={startingDraft}
                  onChange={(e) => setStartingDraft(e.target.value)}
                  className="flex-1 bg-transparent px-2 py-2 text-fg font-stat focus:outline-none"
                  placeholder="0.00"
                />
              </div>
              <button
                type="button"
                onClick={saveStartingBankroll}
                disabled={savingStarting || !startingDraft}
                className="px-3 py-2 bg-brand hover:opacity-90 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-opacity disabled:opacity-40"
              >
                {savingStarting ? '...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-fg-secondary text-[11px] font-semibold uppercase tracking-wider mb-1.5">
              Currency
            </label>
            <div className="flex gap-2">
              {(['£', '$', '€'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCurrencyChange(c)}
                  className={`flex-1 py-2 rounded-lg text-base font-stat font-bold transition-colors border ${
                    currency === c
                      ? 'bg-brand text-white border-brand'
                      : 'bg-bg-base text-fg-secondary border-border-subtle hover:border-border-strong'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="text-fg-muted text-[11px] mt-1.5">
              Display only — internal amounts remain in your home currency.
            </p>
          </div>

          {/* Loss limit */}
          <div>
            <label className="block text-fg-secondary text-[11px] font-semibold uppercase tracking-wider mb-1.5">
              Loss limit
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-bg-base border border-border-subtle rounded-lg focus-within:border-brand transition-colors">
                <span className="pl-3 text-fg-muted font-stat">{currency}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={lossLimitDraft}
                  onChange={(e) => setLossLimitDraft(e.target.value)}
                  className="flex-1 bg-transparent px-2 py-2 text-fg font-stat focus:outline-none"
                  placeholder="leave empty to disable"
                />
              </div>
              <button
                type="button"
                onClick={saveLossLimit}
                disabled={savingLossLimit}
                className="px-3 py-2 bg-bg-elevated hover:bg-border-subtle text-fg text-xs font-bold uppercase tracking-wider rounded-lg border border-border-subtle transition-colors disabled:opacity-40"
              >
                {savingLossLimit ? '...' : 'Save'}
              </button>
            </div>
            <p className="text-fg-muted text-[11px] mt-1.5">
              You'll see a warning when your bankroll drops to this level.
            </p>
          </div>

          {/* Reset */}
          <div className="pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={resetBankroll}
              disabled={resetting}
              className="w-full py-2.5 bg-loss/10 hover:bg-loss/20 text-loss text-xs font-bold uppercase tracking-wider rounded-lg border border-loss/25 transition-colors disabled:opacity-40"
            >
              {resetting ? 'Resetting…' : 'Reset bankroll'}
            </button>
            <p className="text-fg-muted text-[11px] mt-2">
              Permanently deletes all snapshots and your starting bankroll.
            </p>
          </div>
        </div>

        {/* QUICK DEPOSIT */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="eyebrow mb-4">QUICK DEPOSIT</h3>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center bg-bg-base border border-border-subtle rounded-lg focus-within:border-brand transition-colors">
              <span className="pl-3 text-fg-muted font-stat">{currency}</span>
              <input
                type="number"
                inputMode="decimal"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void quickDeposit()
                }}
                className="flex-1 bg-transparent px-2 py-2 text-fg font-stat focus:outline-none"
                placeholder="0.00"
              />
            </div>
            <button
              type="button"
              onClick={quickDeposit}
              disabled={depositing || !depositAmount}
              className="px-4 py-2 bg-brand hover:opacity-90 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-opacity disabled:opacity-40"
            >
              {depositing ? '…' : '+ Add'}
            </button>
          </div>
          <p className="text-fg-muted text-[11px] mt-2">
            Records a snapshot at <span className="font-stat">{fmtShort(currentBankroll, currency)}</span>{' '}
            + amount.
          </p>
        </div>
      </div>
    </section>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function DeltaLine({
  label,
  value,
  currency,
}: {
  label: string
  value: number | null
  currency: string
}) {
  if (value == null) {
    return (
      <span className="text-fg-muted">
        <span className="text-[10px] uppercase tracking-wider mr-1">{label}</span>
        <span className="font-stat">—</span>
      </span>
    )
  }
  const positive = value >= 0
  return (
    <span className={positive ? 'text-success' : 'text-loss'}>
      <span className="text-[10px] uppercase tracking-wider mr-1 text-fg-muted">{label}</span>
      <span className="font-stat font-semibold">
        {positive ? '▲ ' : '▼ '}
        {positive ? '+' : '−'}
        {currency}
        {Math.abs(value).toFixed(2)}
      </span>
    </span>
  )
}

function TrajectoryChart({
  snapshots,
  currency,
  loaded,
}: {
  snapshots: Snapshot[]
  currency: string
  loaded: boolean
}) {
  const W = 600
  const H = 240
  const padX = 40
  const padY = 24

  if (!loaded) {
    return (
      <div className="h-[240px] flex items-center justify-center">
        <div className="w-full h-full bg-bg-base rounded-lg animate-pulse" />
      </div>
    )
  }
  if (snapshots.length < 2) {
    return (
      <div className="h-[240px] flex items-center justify-center">
        <p className="text-fg-muted text-sm text-center px-6">
          Record more snapshots to see your 30-day trajectory.
          <br />
          <span className="text-[11px]">Snapshots auto-track from settled bets.</span>
        </p>
      </div>
    )
  }

  const values = snapshots.map((s) => Number(s.balance))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const yPad = range * 0.15
  const yMin = min - yPad
  const yMax = max + yPad
  const yRange = yMax - yMin

  const xs = snapshots.map((_, i) =>
    snapshots.length === 1
      ? padX + (W - 2 * padX) / 2
      : padX + (i / (snapshots.length - 1)) * (W - 2 * padX)
  )
  const ys = values.map((v) => padY + (1 - (v - yMin) / yRange) * (H - 2 * padY))

  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ')
  const areaPath = `${linePath} L ${xs[xs.length - 1]} ${H - padY} L ${xs[0]} ${H - padY} Z`

  const gridLines = 5
  const gridYs = Array.from({ length: gridLines }, (_, i) => padY + (i / (gridLines - 1)) * (H - 2 * padY))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[240px]"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Bankroll trajectory chart, ${snapshots.length} data points`}
    >
      <defs>
        <linearGradient id="trajGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F97316" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {gridYs.map((y, i) => {
        const value = yMax - (i / (gridLines - 1)) * yRange
        return (
          <g key={i}>
            <line
              x1={padX}
              x2={W - padX / 2}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="text-border-subtle"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <text
              x={padX - 6}
              y={y + 3}
              textAnchor="end"
              className="text-fg-muted"
              fill="currentColor"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
            >
              {currency}
              {Math.round(value).toLocaleString()}
            </text>
          </g>
        )
      })}

      {/* Area + line */}
      <path d={areaPath} fill="url(#trajGrad)" />
      <path d={linePath} fill="none" stroke="#F97316" strokeWidth="2" strokeLinejoin="round" />

      {/* End-point dot */}
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="4" fill="#F97316" />
    </svg>
  )
}
