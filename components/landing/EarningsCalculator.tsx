'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function EarningsCalculator() {
  const [price, setPrice] = useState(9.99)
  const [subs, setSubs] = useState(50)

  const cut = price * 0.8
  const monthly = cut * subs
  const annual = monthly * 12

  const presets = [4.99, 9.99, 14.99, 19.99]

  return (
    <div className="bg-[#12121F] border border-amber-500/25 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xl">💰</span>
        <div>
          <p className="text-white font-bold text-sm">Tipster Earnings Calculator</p>
          <p className="text-white/40 text-xs">See what you could earn per month</p>
        </div>
      </div>

      {/* Price selector */}
      <div className="mb-5">
        <p className="text-white/50 text-xs uppercase tracking-wide font-semibold mb-2">Monthly subscription price</p>
        <div className="flex gap-2 flex-wrap">
          {presets.map(p => (
            <button
              key={p}
              onClick={() => setPrice(p)}
              className={`text-sm font-bold px-3 py-1.5 rounded-lg border transition-all ${
                price === p
                  ? 'bg-amber-500 border-amber-400 text-black'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              £{p.toFixed(2)}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriber slider */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/50 text-xs uppercase tracking-wide font-semibold">Subscribers</p>
          <span className="text-white font-black text-sm">{subs}</span>
        </div>
        <input
          type="range"
          min={5} max={500} step={5}
          value={subs}
          onChange={e => setSubs(Number(e.target.value))}
          className="w-full accent-amber-500 cursor-pointer"
        />
        <div className="flex justify-between text-white/20 text-[10px] mt-1">
          <span>5</span><span>100</span><span>250</span><span>500</span>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center justify-between bg-white/[0.04] rounded-xl px-4 py-3">
          <div>
            <p className="text-white/50 text-xs">Monthly earnings</p>
            <p className="text-white/25 text-[10px] mt-0.5">{subs} subs × £{cut.toFixed(2)}</p>
          </div>
          <p className="text-amber-400 font-black text-xl">£{monthly.toFixed(0)}</p>
        </div>
        <div className="flex items-center justify-between bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
          <div>
            <p className="text-white/70 text-xs font-semibold">Annual earnings</p>
            <p className="text-white/30 text-[10px] mt-0.5">12 months × £{monthly.toFixed(0)}</p>
          </div>
          <p className="text-amber-300 font-black text-2xl">£{annual.toFixed(0)}</p>
        </div>
      </div>

      <Link href="/signup" className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/25">
        Start Earning as a Tipster →
      </Link>

      <p className="text-white/20 text-[10px] text-center mt-3">
        You keep 80% · 20% platform fee · Cancel anytime
      </p>
    </div>
  )
}
