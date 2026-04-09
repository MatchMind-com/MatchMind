'use client'
import { useState } from 'react'

interface Settings {
  daily_alert_opt_in: boolean
  weekly_report_opt_in: boolean
  loss_limit: number | null
  take_a_break_until: string | null
  subscription_tier: string
}

interface Props {
  userId: string
  initialSettings: Settings
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-violet-600' : 'bg-white/10'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

export default function SettingsClient({ userId, initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [lossLimitInput, setLossLimitInput] = useState(String(initialSettings.loss_limit ?? ''))
  const [breakDays, setBreakDays] = useState('7')

  const onBreak = settings.take_a_break_until && new Date(settings.take_a_break_until) > new Date()

  async function patch(key: string, value: unknown) {
    setSaving(key)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
    setSettings(s => ({ ...s, [key]: value }))
    setSaving(null)
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  async function setLossLimit() {
    const n = parseFloat(lossLimitInput)
    if (isNaN(n) || n <= 0) return
    await patch('loss_limit', n)
  }

  async function clearLossLimit() {
    setLossLimitInput('')
    await patch('loss_limit', null)
  }

  async function takeABreak() {
    const days = parseInt(breakDays)
    if (isNaN(days) || days <= 0) return
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    await patch('take_a_break_until', until)
  }

  async function endBreak() {
    await patch('take_a_break_until', null)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xl">⚙️</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-white/40 text-sm">Notifications, responsible gambling & account preferences</p>
        </div>
      </div>

      {/* Notifications */}
      <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-5">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <span className="text-lg">🔔</span> Notifications
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white text-sm font-medium">Daily Value Bet Alerts</p>
              <p className="text-white/40 text-xs mt-0.5">Get today's AI value bets emailed at 9 AM every day</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {saved === 'daily_alert_opt_in' && <span className="text-emerald-400 text-xs">Saved ✓</span>}
              <Toggle checked={settings.daily_alert_opt_in} onChange={v => patch('daily_alert_opt_in', v)} />
            </div>
          </div>
          <div className="h-px bg-white/5" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white text-sm font-medium">Weekly Performance Report</p>
              <p className="text-white/40 text-xs mt-0.5">A summary of your betting week, every Monday at 8 AM</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {saved === 'weekly_report_opt_in' && <span className="text-emerald-400 text-xs">Saved ✓</span>}
              <Toggle checked={settings.weekly_report_opt_in} onChange={v => patch('weekly_report_opt_in', v)} />
            </div>
          </div>
        </div>
      </section>

      {/* Responsible Gambling */}
      <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-5">
        <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
          <span className="text-lg">🛡️</span> Responsible Gambling
        </h2>
        <p className="text-white/30 text-xs mb-5">Tools to help you stay in control of your betting.</p>

        {/* Loss Limit */}
        <div className="mb-5">
          <p className="text-white text-sm font-medium mb-1">Weekly Loss Limit</p>
          <p className="text-white/40 text-xs mb-3">Set a weekly P&L floor. MatchMind will warn you when you approach or exceed this limit.</p>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">£</span>
              <input
                type="number"
                value={lossLimitInput}
                onChange={e => setLossLimitInput(e.target.value)}
                placeholder="e.g. 50"
                min="1"
                className="w-28 pl-7 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <button
              onClick={setLossLimit}
              disabled={saving === 'loss_limit'}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              {saving === 'loss_limit' ? 'Saving…' : saved === 'loss_limit' ? '✓ Saved' : 'Set Limit'}
            </button>
            {settings.loss_limit && (
              <button
                onClick={clearLossLimit}
                className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
              >
                Remove
              </button>
            )}
          </div>
          {settings.loss_limit && (
            <p className="text-amber-400/70 text-xs mt-2">⚠️ Current limit: £{settings.loss_limit}/week</p>
          )}
        </div>

        <div className="h-px bg-white/5 mb-5" />

        {/* Take a Break */}
        <div>
          <p className="text-white text-sm font-medium mb-1">Take a Break</p>
          <p className="text-white/40 text-xs mb-3">Pause all alerts and hide the add-bet form for a set period. Your data stays safe.</p>
          {onBreak ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <p className="text-amber-300 text-sm font-semibold mb-1">🌙 Break active</p>
              <p className="text-white/40 text-xs">
                Your break runs until {new Date(settings.take_a_break_until!).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.
              </p>
              <button
                onClick={endBreak}
                className="mt-3 text-xs text-white/40 hover:text-white underline transition-colors"
              >
                End break early
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <select
                value={breakDays}
                onChange={e => setBreakDays(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">1 week</option>
                <option value="14">2 weeks</option>
                <option value="30">1 month</option>
              </select>
              <button
                onClick={takeABreak}
                disabled={saving === 'take_a_break_until'}
                className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving === 'take_a_break_until' ? 'Saving…' : '🌙 Take a Break'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* External help */}
      <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          <span className="text-lg">❤️</span> Need Support?
        </h2>
        <p className="text-white/40 text-sm mb-4">
          If you&apos;re concerned about your gambling, free support is available 24/7.
        </p>
        <div className="space-y-2">
          {[
            { name: 'GamCare', url: 'https://www.gamcare.org.uk', desc: 'Free helpline: 0808 8020 133' },
            { name: 'BeGambleAware', url: 'https://www.begambleaware.org', desc: 'gambleaware.org — free & confidential' },
            { name: 'Gamblers Anonymous', url: 'https://www.gamblersanonymous.org.uk', desc: 'Self-help group support' },
          ].map(r => (
            <a
              key={r.name}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-white/3 hover:bg-white/6 border border-white/8 rounded-xl transition-colors group"
            >
              <div>
                <p className="text-white text-sm font-medium group-hover:text-violet-300 transition-colors">{r.name}</p>
                <p className="text-white/30 text-xs">{r.desc}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20 group-hover:text-violet-400 transition-colors shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
