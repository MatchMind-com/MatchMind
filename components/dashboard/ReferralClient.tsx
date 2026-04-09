'use client'
import { useState } from 'react'

const APP_URL = 'https://matchmindcom.company'

interface Props {
  referralCode: string
  referralCount: number
  subscriptionTier: string
}

const MILESTONES = [
  { count: 1, reward: '1 month Pro free', icon: '🎁' },
  { count: 3, reward: '3 months Pro free', icon: '🚀' },
  { count: 10, reward: 'Lifetime Pro access', icon: '👑' },
]

export default function ReferralClient({ referralCode, referralCount, subscriptionTier }: Props) {
  const [copied, setCopied] = useState(false)
  const [copiedMsg, setCopiedMsg] = useState(false)
  const referralUrl = `${APP_URL}/signup?ref=${referralCode}`

  async function copyLink() {
    await navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyMessage() {
    const msg = `I've been using MatchMind — an AI betting coach that helps me track bets, find value, and get AI analysis on my performance. Really useful if you're serious about improving. Try it free: ${referralUrl}`
    await navigator.clipboard.writeText(msg)
    setCopiedMsg(true)
    setTimeout(() => setCopiedMsg(false), 2000)
  }

  const nextMilestone = MILESTONES.find(m => m.count > referralCount) ?? MILESTONES[MILESTONES.length - 1]
  const progressPct = Math.min((referralCount / nextMilestone.count) * 100, 100)

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl">🎁</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Refer a Friend</h1>
          <p className="text-white/40 text-sm">Invite friends, earn Pro rewards together</p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { icon: '🔗', step: '1', title: 'Share your link', desc: 'Send your unique invite link to friends' },
          { icon: '✅', step: '2', title: 'They sign up', desc: 'Friend creates a free MatchMind account' },
          { icon: '🎁', step: '3', title: 'You both win', desc: 'You get Pro time, they get 7 days Pro free' },
        ].map(s => (
          <div key={s.step} className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 text-center">
            <p className="text-2xl mb-2">{s.icon}</p>
            <p className="text-white text-xs font-bold mb-1">{s.title}</p>
            <p className="text-white/30 text-[10px]">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white font-semibold">Your Progress</p>
            <p className="text-white/40 text-xs">{referralCount} friend{referralCount !== 1 ? 's' : ''} referred</p>
          </div>
          <div className="text-right">
            <p className="text-amber-400 font-bold text-sm">{nextMilestone.icon} Next: {nextMilestone.reward}</p>
            <p className="text-white/30 text-xs">{nextMilestone.count - referralCount} more to go</p>
          </div>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Milestones */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {MILESTONES.map(m => (
            <div
              key={m.count}
              className={`text-center p-3 rounded-xl border ${referralCount >= m.count ? 'bg-amber-500/10 border-amber-500/25' : 'bg-white/[0.02] border-white/5'}`}
            >
              <p className="text-base mb-0.5">{m.icon}</p>
              <p className={`text-xs font-bold ${referralCount >= m.count ? 'text-amber-400' : 'text-white/30'}`}>{m.count} referral{m.count > 1 ? 's' : ''}</p>
              <p className={`text-[10px] ${referralCount >= m.count ? 'text-amber-300/70' : 'text-white/20'}`}>{m.reward}</p>
              {referralCount >= m.count && <p className="text-emerald-400 text-[10px] mt-0.5 font-bold">✓ Earned</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Referral link */}
      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-4">
        <p className="text-white text-sm font-semibold mb-3">Your Referral Link</p>
        <div className="flex items-center gap-2 bg-[#0B0B14] border border-white/10 rounded-xl p-3 mb-3">
          <p className="text-violet-300 text-sm font-mono flex-1 truncate">{referralUrl}</p>
          <button
            onClick={copyLink}
            className="shrink-0 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <button
          onClick={copyMessage}
          className="w-full bg-white/5 hover:bg-white/8 border border-white/10 text-white/60 hover:text-white text-sm py-2.5 rounded-xl transition-colors"
        >
          {copiedMsg ? '✓ Message Copied!' : '📋 Copy Ready-to-Send Message'}
        </button>
      </div>

      {/* Share buttons */}
      <div className="grid grid-cols-2 gap-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Check out MatchMind — AI betting coach, free to start: ${referralUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/25 text-[#25D366] font-semibold text-sm py-3 rounded-xl transition-colors"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.116.551 4.107 1.516 5.836L.053 23.41a.5.5 0 0 0 .537.637l5.712-1.499A11.951 11.951 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.89 0-3.663-.528-5.17-1.44l-.371-.222-3.839 1.006 1.023-3.74-.24-.384A9.952 9.952 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
          WhatsApp
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Loving MatchMind for tracking my bets + getting AI value picks. Free to start 👇`)}&url=${encodeURIComponent(referralUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-black/30 hover:bg-black/50 border border-white/15 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          𝕏 / Twitter
        </a>
      </div>

      <p className="text-white/20 text-xs text-center mt-5">
        Pro rewards are applied manually within 48 hours of each referred signup. Your referral code: <span className="font-mono text-violet-400">{referralCode}</span>
      </p>
    </div>
  )
}
