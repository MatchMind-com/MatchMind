import Link from 'next/link'

export default function PublicFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto border-t border-white/5 bg-[#0B0B14]/80 py-8 px-4">
      <div className="max-w-5xl mx-auto text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-widest">
          <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded">18+</span>
          <span className="text-white/50">Gambling involves risk — only bet what you can afford to lose</span>
        </div>
        <p className="text-white/40 text-xs max-w-2xl mx-auto leading-relaxed">
          MatchMind provides AI-generated predictions for educational and entertainment purposes only.
          Nothing on this site is financial advice. Past performance does not guarantee future results.
          If gambling is affecting you or someone you know, help is available.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
          <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors underline">BeGambleAware.org</a>
          <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors underline">GamCare</a>
          <a href="https://www.gamstop.co.uk" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors underline">GAMSTOP</a>
          <Link href="/predictions" className="text-white/40 hover:text-white/70 transition-colors">Predictions</Link>
          <Link href="/track-record" className="text-white/40 hover:text-white/70 transition-colors">Track Record</Link>
          <Link href="/login" className="text-white/40 hover:text-white/70 transition-colors">Sign In</Link>
          <Link href="/signup" className="text-white/40 hover:text-white/70 transition-colors">Sign Up</Link>
        </div>
        <p className="text-white/25 text-[10px]">
          © {year} MatchMind · matchmindcom.com
        </p>
      </div>
    </footer>
  )
}
