'use client'
import { useState, useEffect } from 'react'

interface ReportData {
  grade: string
  headline: string
  summary: string
  strengths: string[]
  improvements: string[]
  best_bet: string
  worst_bet: string
  tip_for_next_week: string
  stats: { bets: number; wins: number; losses: number; win_rate: string; pnl: number; roi: string }
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'text-emerald-400', 'A': 'text-emerald-400',
  'B+': 'text-blue-400', 'B': 'text-blue-400',
  'C+': 'text-amber-400', 'C': 'text-amber-400',
  'D': 'text-orange-400', 'F': 'text-red-400',
}
const GRADE_BG: Record<string, string> = {
  'A+': 'bg-emerald-500/10 border-emerald-500/20',
  'A': 'bg-emerald-500/10 border-emerald-500/20',
  'B+': 'bg-blue-500/10 border-blue-500/20',
  'B': 'bg-blue-500/10 border-blue-500/20',
  'C+': 'bg-amber-500/10 border-amber-500/20',
  'C': 'bg-amber-500/10 border-amber-500/20',
  'D': 'bg-orange-500/10 border-orange-500/20',
  'F': 'bg-red-500/10 border-red-500/20',
}

export default function WeeklyReportCard() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchReport() }, [])

  async function fetchReport() {
    setLoading(true)
    try {
      const res = await fetch('/api/weekly-report')
      const data = await res.json()
      if (data.report?.report_data) setReport(data.report.report_data)
    } catch {}
    setLoading(false)
  }

  async function generateReport() {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/weekly-report', { method: 'POST' })
      const data = await res.json()
      if (data.report) {
        setReport(data.report)
        setExpanded(true)
      } else if (data.error) {
        setError(data.error)
      }
    } catch {
      setError('Failed to generate report.')
    }
    setGenerating(false)
  }

  if (loading) {
    return (
      <div className="bg-[#12121F] border border-white/10 rounded-2xl p-5 animate-pulse">
        <div className="h-3 bg-white/10 rounded w-1/3 mb-3" />
        <div className="h-6 bg-white/10 rounded w-2/3 mb-2" />
        <div className="h-3 bg-white/10 rounded w-full" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="bg-[#12121F] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📊</span>
          <div>
            <h3 className="text-white font-semibold text-sm">Weekly Report Card</h3>
            <p className="text-white/40 text-xs">AI-powered review of your betting week</p>
          </div>
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <button
          onClick={generateReport}
          disabled={generating}
          className="w-full bg-violet-600/15 hover:bg-violet-600/25 border border-violet-500/25 text-violet-300 text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⟳</span> Generating report...
            </span>
          ) : '✨ Generate This Week\'s Report'}
        </button>
      </div>
    )
  }

  const gradeBg = GRADE_BG[report.grade] || 'bg-white/5 border-white/10'
  const gradeColor = GRADE_COLOR[report.grade] || 'text-white'

  return (
    <div className="bg-[#12121F] border border-white/10 rounded-2xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div>
              <p className="text-white/40 text-xs mb-0.5">Weekly Report Card</p>
              <h3 className="text-white font-semibold text-sm leading-tight">{report.headline}</h3>
            </div>
          </div>
          <div className={`${gradeBg} border rounded-xl px-3 py-1.5 text-center`}>
            <div className={`text-3xl font-black leading-none ${gradeColor}`}>{report.grade}</div>
          </div>
        </div>

        <p className="text-white/50 text-xs leading-relaxed mb-4">{report.summary}</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/5 rounded-xl p-2.5 text-center">
            <div className="text-white font-bold text-sm">{report.stats.bets}</div>
            <div className="text-white/40 text-xs">Bets</div>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 text-center">
            <div className="text-white font-bold text-sm">{report.stats.win_rate}</div>
            <div className="text-white/40 text-xs">Win Rate</div>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 text-center">
            <div className={`font-bold text-sm ${Number(report.stats.pnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {Number(report.stats.pnl) >= 0 ? '+' : ''}£{Number(report.stats.pnl).toFixed(0)}
            </div>
            <div className="text-white/40 text-xs">P&L</div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-center text-violet-400/70 hover:text-violet-400 text-xs transition-colors"
        >
          {expanded ? '↑ Collapse' : '↓ See full report'}
        </button>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4">
          <div>
            <h4 className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">✅ Strengths</h4>
            <ul className="space-y-1.5">
              {report.strengths.map((s, i) => (
                <li key={i} className="text-white/55 text-xs">• {s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">⚠️ Areas to Improve</h4>
            <ul className="space-y-1.5">
              {report.improvements.map((s, i) => (
                <li key={i} className="text-white/55 text-xs">• {s}</li>
              ))}
            </ul>
          </div>
          {report.best_bet && (
            <div>
              <h4 className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">🏆 Best Call</h4>
              <p className="text-white/55 text-xs">{report.best_bet}</p>
            </div>
          )}
          {report.worst_bet && (
            <div>
              <h4 className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">📉 Toughest Lesson</h4>
              <p className="text-white/55 text-xs">{report.worst_bet}</p>
            </div>
          )}
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
            <h4 className="text-violet-400 text-xs font-semibold uppercase tracking-wider mb-1">💡 Tip for Next Week</h4>
            <p className="text-white/65 text-xs">{report.tip_for_next_week}</p>
          </div>
          <button
            onClick={generateReport}
            disabled={generating}
            className="w-full text-white/25 hover:text-white/50 text-xs transition-colors"
          >
            {generating ? '⟳ Regenerating...' : '↻ Regenerate report'}
          </button>
        </div>
      )}
    </div>
  )
}
