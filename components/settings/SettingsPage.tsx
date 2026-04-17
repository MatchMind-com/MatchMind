'use client'
import { useState } from 'react'

interface SettingsProps {
  profile: {
    daily_alert_opt_in: boolean
    weekly_report_opt_in: boolean
    loss_limit: number | null
    take_a_break_until: string | null
    subscription_tier: string
  } | null
  email: string
}

export default function SettingsPage({ profile, email }: SettingsProps) {
  const [dailyAlert, setDailyAlert] = useState(profile?.daily_alert_opt_in ?? false)
  const [weeklyReport, setWeeklyReport] = useState(profile?.weekly_report_opt_in ?? true)
  const [lossLimit, setLossLimit] = useState(profile?.loss_limit?.toString() ?? '')
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const onBreak = profile?.take_a_break_until
    ? new Date(profile.take_a_break_until) > new Date()
    : false
  const breakUntil = profile?.take_a_break_until
    ? new Date(profile.take_a_break_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  async function save(field: string, value: any) {
    setSaving(field)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    setSaving(null)
    setSaved(field)
    setTimeout(() => setSaved(null), 2000)
  }

  async function takeABreak(days: number) {
    const until = new Date()
    until.setDate(until.getDate() + days)
    setSaving('break')
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ take_a_break_until: until.toISOString() }),
    })
    setSaving(null)
    window.location.reload()
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-gray-400 text-sm">Manage your account and responsible gambling preferences</p>
      </div>

      {/* Account */}
      <section className="bg-[#12121F] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Account</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Email</div>
              <div className="text-sm text-gray-400">{email}</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Plan</div>
              <div className="text-sm text-gray-400 capitalize">{profile?.subscription_tier || 'Free'}</div>
            </div>
            <a
              href="/dashboard/billing"
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              Manage →
            </a>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-[#12121F] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Daily value bet alerts</div>
              <div className="text-xs text-gray-500">Get today's best AI picks by email each morning</div>
            </div>
            <button
              onClick={async () => {
                const next = !dailyAlert
                setDailyAlert(next)
                await save('daily_alert_opt_in', next)
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${dailyAlert ? 'bg-violet-600' : 'bg-white/10'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${dailyAlert ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Weekly performance report</div>
              <div className="text-xs text-gray-500">Summary of your bets, P&L and AI accuracy</div>
            </div>
            <button
              onClick={async () => {
                const next = !weeklyReport
                setWeeklyReport(next)
                await save('weekly_report_opt_in', next)
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${weeklyReport ? 'bg-violet-600' : 'bg-white/10'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${weeklyReport ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Responsible Gambling */}
      <section className="bg-[#12121F] border border-amber-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Responsible Gambling</h2>
          <span className="text-amber-400">⚠️</span>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          These tools help you stay in control. MatchMind is an analytics tool — always gamble responsibly.
        </p>

        {onBreak && (
          <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300">
            🛑 You're on a break until <strong>{breakUntil}</strong>. Betting features are paused.
          </div>
        )}

        {/* Loss Limit */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-white mb-1">Monthly loss limit</label>
          <p className="text-xs text-gray-500 mb-2">We'll warn you when your tracked losses approach this amount</p>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
              <input
                type="number"
                min="0"
                step="10"
                value={lossLimit}
                onChange={(e) => setLossLimit(e.target.value)}
                placeholder="No limit set"
                className="bg-white/5 border border-white/10 rounded-lg pl-7 pr-4 py-2 text-sm text-white w-36 focus:outline-none focus:border-violet-500"
              />
            </div>
            <button
              onClick={() => save('loss_limit', lossLimit ? parseFloat(lossLimit) : null)}
              disabled={saving === 'loss_limit'}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
            >
              {saving === 'loss_limit' ? 'Saving...' : saved === 'loss_limit' ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* Take a Break */}
        <div className="mb-5">
          <div className="text-sm font-medium text-white mb-1">Take a break</div>
          <p className="text-xs text-gray-500 mb-3">Temporarily pause your access to betting features</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: '24 hours', days: 1 },
              { label: '1 week', days: 7 },
              { label: '1 month', days: 30 },
            ].map(({ label, days }) => (
              <button
                key={days}
                onClick={() => takeABreak(days)}
                disabled={saving === 'break'}
                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-sm text-amber-300 transition-colors disabled:opacity-50"
              >
                {saving === 'break' ? 'Setting...' : label}
              </button>
            ))}
          </div>
        </div>

        {/* External Resources */}
        <div className="pt-4 border-t border-white/5">
          <div className="text-xs text-gray-500 mb-3">Need help? Free, confidential support:</div>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://www.gamcare.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors"
            >
              🟢 GamCare — 0808 8020 133
            </a>
            <a
              href="https://www.begambleaware.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors"
            >
              🔵 BeGambleAware
            </a>
            <a
              href="https://www.gamstop.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors"
            >
              🔴 GamStop — Self-Exclusion
            </a>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-[#12121F] border border-red-500/20 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-4">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">Delete account</div>
            <div className="text-xs text-gray-500">Permanently delete your account and all data</div>
          </div>
          <a
            href="mailto:support@matchmindcom.com?subject=Delete my account&body=Please delete my account: {email}"
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors"
          >
            Request Deletion
          </a>
        </div>
      </section>
    </div>
  )
}
