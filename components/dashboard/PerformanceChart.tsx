'use client'
import { useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { BetSlip } from '@/lib/types'

const DEMO_PNL = [
  { name: 'Bet 1', cumulative: -10 },
  { name: 'Bet 2', cumulative: 8.5 },
  { name: 'Bet 3', cumulative: 4.2 },
  { name: 'Bet 4', cumulative: 18.7 },
  { name: 'Bet 5', cumulative: 12.3 },
  { name: 'Bet 6', cumulative: 29.1 },
  { name: 'Bet 7', cumulative: 22.4 },
  { name: 'Bet 8', cumulative: 38.9 },
  { name: 'Bet 9', cumulative: 34.5 },
  { name: 'Bet 10', cumulative: 47.2 },
]

const Tip = ({ active, payload, label }: any) => {
  if (!active||!payload?.length) return null
  const v = payload[0].value; const pos = v >= 0
  return (
    <div className="bg-[#1C1C2E] border border-white/10 rounded-xl p-3 text-sm shadow-xl">
      <div className="text-slate-400 mb-1">{label}</div>
      <div className={`font-bold ${pos?'text-emerald-400':'text-red-400'}`}>{pos?'+':''}{typeof v==='number'?v.toFixed(2):v}</div>
    </div>
  )
}

export default function PerformanceChart({ bets }: { bets: BetSlip[] }) {
  const [view, setView] = useState<'pnl'|'roi_league'|'roi_type'>('pnl')
  const settled = bets.filter(b => b.result!=='pending'&&b.result!=='void')
  const pnlData = settled.sort((a,b) => new Date(a.created_at).getTime()-new Date(b.created_at).getTime())
    .reduce<{name:string;cumulative:number}[]>((acc,bet,i) => {
      const prev = acc[i-1]?.cumulative ?? 0
      acc.push({ name:`Bet ${i+1}`, cumulative: parseFloat((prev+Number(bet.profit_loss)).toFixed(2)) })
      return acc
    }, [])

  function buildBreakdown(key: 'league'|'bet_type') {
    const map: Record<string,{stake:number;profit:number;count:number}> = {}
    settled.forEach(b => {
      const k = (b[key]||'Other') as string
      if (!map[k]) map[k]={stake:0,profit:0,count:0}
      map[k].stake+=Number(b.stake); map[k].profit+=Number(b.profit_loss); map[k].count++
    })
    return Object.entries(map).map(([name,{stake,profit,count}]) => ({
      name: name.length>14 ? name.substring(0,14)+'…' : name,
      roi: stake>0 ? parseFloat(((profit/stake)*100).toFixed(1)) : 0, count
    })).sort((a,b)=>b.count-a.count).slice(0,8)
  }

  const leagueData = buildBreakdown('league')
  const typeData = buildBreakdown('bet_type')
  const isEmpty = settled.length === 0

  return (
    <div className="bg-[#13131F] border border-white/5 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          </div>
          <div>
            <h2 className="text-white font-semibold">Performance Analytics</h2>
            <p className="text-slate-500 text-xs">{isEmpty ? 'Sample preview — add your first bets' : `${settled.length} settled bets`}</p>
          </div>
        </div>
        {!isEmpty && (
          <div className="flex bg-[#0B0B14] p-1 rounded-xl gap-1">
            {([['pnl','P&L Over Time'],['roi_league','By League'],['roi_type','By Bet Type']] as const).map(([k,l]) => (
              <button key={k} onClick={() => setView(k)} className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium ${view===k?'bg-violet-600 text-white':'text-slate-400 hover:text-white'}`}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="relative">
          {/* Ghost demo chart */}
          <div className="h-60 pointer-events-none select-none opacity-30 blur-[1px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={DEMO_PNL} margin={{top:5,right:10,left:-20,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08"/>
                <XAxis dataKey="name" tick={{fill:'#475569',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#475569',fontSize:11}} axisLine={false} tickLine={false}/>
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4"/>
                <Line type="monotone" dataKey="cumulative" stroke="#7C3AED" strokeWidth={2.5} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2">
            <div className="bg-[#0B0B14]/90 border border-white/10 rounded-2xl px-6 py-4 backdrop-blur-sm">
              <p className="text-white font-semibold text-sm">📈 Your P&L chart will appear here</p>
              <p className="text-slate-500 text-xs mt-1">Add a bet and mark it won/lost to see your real performance</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            {view==='pnl' ? (
              <LineChart data={pnlData} margin={{top:5,right:10,left:-20,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08"/>
                <XAxis dataKey="name" tick={{fill:'#475569',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#475569',fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/>
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4"/>
                <Line type="monotone" dataKey="cumulative" stroke="#7C3AED" strokeWidth={2.5} dot={false} activeDot={{r:5,fill:'#7C3AED',stroke:'#0B0B14',strokeWidth:2}}/>
              </LineChart>
            ) : (
              <BarChart data={view==='roi_league'?leagueData:typeData} margin={{top:5,right:10,left:-20,bottom:20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false}/>
                <XAxis dataKey="name" tick={{fill:'#475569',fontSize:10}} angle={-25} textAnchor="end" axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#475569',fontSize:11}} axisLine={false} tickLine={false} unit="%"/>
                <Tooltip content={<Tip/>}/>
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4"/>
                <Bar dataKey="roi" radius={[6,6,0,0]}>
                  {(view==='roi_league'?leagueData:typeData).map((e,i) => <Cell key={i} fill={e.roi>=0?'#10B981':'#EF4444'} opacity={0.8}/>)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
