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

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 transition-colors flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-white/10'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )
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
    <div className="p-5 lg:p-7 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-1 font-medium">Account</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account and responsible gambling preferences</p>
      </div>

      {/* Account */}
      <section className="bg-[#0E1628] border border-white/[0.07] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Account</h2>
        </div>
        <div className="divide-y divide-white/[0.05]">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">Email</div>
              <div className="text-sm text-slate-500">{email}</div>
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">Plan</div>
              <div className="text-sm text-slate-500 capitalize">{profile?.subscription_tier || 'Free'}</div>
            </div>
            <a href="/dashboard/billing" className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-semibold">
              Manage →
            </a>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-[#0E1628] border border-white/[0.07] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Notifications</h2>
        </div>
        <div className="divide-y divide-white/[0.05]">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">Daily value bet alerts</div>
              <div className="text-xs text-slate-500 mt-0.5">Get today's best AI picks by email each morning</div>
            </div>
            <Toggle checked={dailyAlert} onChange={async () => {
              const next = !dailyAlert
              setDailyAlert(next)
              await save('daily_alert_opt_in', next)
            }} />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">Weekly performance report</div>
              <div className="text-xs text-slate-500 mt-0.5">Summary of your bets, P&L and AI accuracy</div>
            </div>
            <Toggle checked={weeklyReport} onChange={async () => {
              const next = !weeklyReport
              setWeeklyReport(next)
              await save('weekly_report_opt_in', next)
            }} />
          </div>
        </div>
      </section>

      {/* Responsible Gambling */}
      <section className="bg-[#0E1628] border border-amber-500/20 overflow-hidden">
        <div className="px-5 py-4 border-b border-amber-500/15 flex items-center gap-2"
          style={{ background: 'linear-gradient(90deg, rgba(245,158,11,0.05) 0%, transparent 100%)' }}>
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Responsible Gambling</h2>
        </div>

        <div className="px-5 py-4 space-y-5">
          <p className="text-xs text-slate-500">
            These tools help you stay in control. MatchMind is an analytics tool — always gamble responsibly.
          </p>

          {onBreak && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 text-sm text-amber-300">
              You&apos;re on a break until <strong>{breakUntil}</strong>. Betting features are paused.
            </div>
          )}

          {/* Loss Limit */}
          <div>
            <div className="text-sm font-semibold text-white mb-0.5">Monthly loss limit</div>
            <p className="text-xs text-slate-500 mb-3">We&apos;ll warn you when your tracked losses approach this amount</p>
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={lossLimit}
                  onChange={(e) => setLossLimit(e.target.value)}
                  placeholder="No limit set"
                  className="bg-white/[0.04] border border-white/[0.07] pl-7 pr-4 py-2.5 text-sm text-white w-36 focus:outline-none focus:border-blue-500/40 transition-colors placeholder:text-slate-600"
                />
              </div>
              <button
                onClick={() => save('loss_limit', lossLimit ? parseFloat(lossLimit) : null)}
                disabled={saving === 'loss_limit'}
                className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-sm text-white font-semibold transition-colors disabled:opacity-50"
              >
                {saving === 'loss_limit' ? 'Saving…' : saved === 'loss_limit' ? '✓ Saved' : 'Save'}
              </button>
            </div>
          </div>

          {/* Take a Break */}
          <div>
            <div className="text-sm font-semibold text-white mb-0.5">Take a break</div>
            <p className="text-xs text-slate-500 mb-3">Temporarily pause your access to betting features</p>
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
                  className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-sm text-amber-300 font-semibold transition-colors disabled:opacity-50"
                >
                  {saving === 'break' ? 'Setting…' : label}
                </button>
              ))}
            </div>
          </div>

          {/* External Resources */}
          <div className="pt-4 border-t border-white/[0.05]">
            <div className="text-xs text-slate-500 mb-3">Need help? Free, confidential support:</div>
            <div className="flex flex-wrap gap-2">
              <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-xs text-slate-300 transition-colors font-medium">
                <span className="w-2 h-2 bg-emerald-400 flex-shrink-0" />
                GamCare — 0808 8020 133
              </a>
              <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-xs text-slate-300 transition-colors font-medium">
                <span className="w-2 h-2 bg-blue-400 flex-shrink-0" />
                BeGambleAware
              </a>
              <a href="https://www.gamstop.co.uk" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-xs text-slate-300 transition-colors font-medium">
                <span className="w-2 h-2 bg-red-400 flex-shrink-0" />
                GamStop — Self-Exclusion
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Your Data (GDPR) */}
      <section className="bg-[#0E1628] border border-white/[0.07] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Your Data (GDPR)</h2>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white">Export your data</div>
            <div className="text-xs text-slate-500 mt-0.5">Download a JSON bundle of everything we have on you</div>
          </div>
          <a
            href="/api/account/export"
            className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-sm text-slate-300 font-semibold transition-colors"
          >
            Download
          </a>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-[#0E1628] border border-red-500/20 overflow-hidden">
        <div className="px-5 py-4 border-b border-red-500/15">
          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-widest">Danger Zone</h2>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white">Delete account</div>
            <div className="text-xs text-slate-500 mt-0.5">Permanently deletes your account and all data</div>
          </div>
          <button
            onClick={async () => {
              const confirmed = window.prompt('This will permanently delete your account and all data. Type DELETE to confirm:')
              if (confirmed !== 'DELETE') return
              const res = await fetch('/api/account/delete', { method: 'POST' })
              if (res.ok) {
                alert('Account deleted.')
                window.location.href = '/'
              } else {
                alert('Could not delete account. Please email support@matchmindcom.com.')
              }
            }}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-sm text-red-400 font-semibold transition-colors"
          >
            Delete Account
          </button>
        </div>
      </section>
    </div>
  )
}
