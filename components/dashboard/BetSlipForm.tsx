'use client'

import { useState } from 'react'
import { PlusCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BetSlip, BetType } from '@/lib/types'

const BET_TYPES: BetType[] = [
  'Match Result',
  'Over/Under',
  'Both Teams Score',
  'Handicap',
  'Correct Score',
  'Accumulator',
]

interface BetSlipFormProps {
  userId: string
  onBetAdded: (bet: BetSlip) => void
}

const EMPTY_FORM = {
  match_date: new Date().toISOString().split('T')[0],
  home_team: '',
  away_team: '',
  bet_type: 'Match Result' as BetType,
  odds: '',
  stake: '',
  result: 'win' as 'win' | 'loss' | 'void',
  notes: '',
}

export default function BetSlipForm({ userId, onBetAdded }: BetSlipFormProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
    setSuccess(false)
  }

  const calculateProfitLoss = () => {
    const odds = parseFloat(form.odds)
    const stake = parseFloat(form.stake)
    if (isNaN(odds) || isNaN(stake)) return 0

    if (form.result === 'win') {
      return parseFloat(((odds - 1) * stake).toFixed(2))
    } else if (form.result === 'loss') {
      return -stake
    }
    return 0 // void
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!form.home_team.trim() || !form.away_team.trim()) {
      setError('Please enter both team names.')
      setLoading(false)
      return
    }

    const odds = parseFloat(form.odds)
    const stake = parseFloat(form.stake)

    if (isNaN(odds) || odds <= 1) {
      setError('Odds must be greater than 1.')
      setLoading(false)
      return
    }

    if (isNaN(stake) || stake <= 0) {
      setError('Stake must be a positive number.')
      setLoading(false)
      return
    }

    const profit_loss = calculateProfitLoss()

    const { data, error: insertError } = await supabase
      .from('bet_slips')
      .insert({
        user_id: userId,
        match_date: form.match_date,
        home_team: form.home_team.trim(),
        away_team: form.away_team.trim(),
        bet_type: form.bet_type,
        odds,
        stake,
        result: form.result,
        profit_loss,
        notes: form.notes.trim() || null,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
    } else if (data) {
      onBetAdded(data as BetSlip)
      setForm(EMPTY_FORM)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }

    setLoading(false)
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-[#00C896]/20 rounded-lg">
          <PlusCircle size={20} className="text-[#00C896]" />
        </div>
        <h2 className="text-lg font-semibold text-white">Add Bet Slip</h2>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Match Date */}
        <div>
          <label className="label">Match Date</label>
          <input
            type="date"
            name="match_date"
            value={form.match_date}
            onChange={handleChange}
            className="input-field"
            required
          />
        </div>

        {/* Home Team */}
        <div>
          <label className="label">Home Team</label>
          <input
            type="text"
            name="home_team"
            value={form.home_team}
            onChange={handleChange}
            placeholder="e.g. Arsenal"
            className="input-field"
            required
          />
        </div>

        {/* Away Team */}
        <div>
          <label className="label">Away Team</label>
          <input
            type="text"
            name="away_team"
            value={form.away_team}
            onChange={handleChange}
            placeholder="e.g. Chelsea"
            className="input-field"
            required
          />
        </div>

        {/* Bet Type */}
        <div>
          <label className="label">Bet Type</label>
          <select
            name="bet_type"
            value={form.bet_type}
            onChange={handleChange}
            className="input-field"
          >
            {BET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Odds */}
        <div>
          <label className="label">Odds (Decimal)</label>
          <input
            type="number"
            name="odds"
            value={form.odds}
            onChange={handleChange}
            placeholder="e.g. 2.50"
            step="0.01"
            min="1.01"
            className="input-field"
            required
          />
        </div>

        {/* Stake */}
        <div>
          <label className="label">Stake ($)</label>
          <input
            type="number"
            name="stake"
            value={form.stake}
            onChange={handleChange}
            placeholder="e.g. 50"
            step="0.01"
            min="0.01"
            className="input-field"
            required
          />
        </div>

        {/* Result */}
        <div>
          <label className="label">Result</label>
          <select
            name="result"
            value={form.result}
            onChange={handleChange}
            className="input-field"
          >
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="void">Void / Push</option>
          </select>
        </div>

        {/* P&L Preview */}
        <div>
          <label className="label">Est. Profit / Loss</label>
          <div
            className={`input-field flex items-center font-semibold ${
              calculateProfitLoss() >= 0 ? 'text-[#00C896]' : 'text-[#FF4757]'
            }`}
          >
            {form.odds && form.stake
              ? `${calculateProfitLoss() >= 0 ? '+' : ''}$${calculateProfitLoss().toFixed(2)}`
              : '—'}
          </div>
        </div>

        {/* Notes */}
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="label">Notes (optional)</label>
          <input
            type="text"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="e.g. Home team injury concerns"
            className="input-field"
          />
        </div>

        {/* Submit - full width */}
        <div className="sm:col-span-2 lg:col-span-3">
          {error && (
            <div className="mb-3 bg-[#FF4757]/10 border border-[#FF4757]/30 rounded-lg px-4 py-3">
              <p className="text-[#FF4757] text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-3 bg-[#00C896]/10 border border-[#00C896]/30 rounded-lg px-4 py-3">
              <p className="text-[#00C896] text-sm">Bet slip saved successfully!</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <PlusCircle size={16} />
                Save Bet
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
