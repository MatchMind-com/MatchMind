export interface Profile {
  id: string
  email: string
  full_name?: string
  created_at: string
  updated_at: string
  total_bets: number
  winning_bets: number
  total_profit: number
  current_bankroll: number
  subscription_tier: 'free' | 'pro' | 'elite'
}

export interface BetSlip {
  id: string
  user_id: string
  match_name: string
  league?: string
  bet_type: string
  selection: string
  odds: number
  stake: number
  potential_return?: number
  result: 'win' | 'loss' | 'void' | 'pending'
  profit_loss: number
  match_date?: string
  created_at: string
  notes?: string
}

export interface AISession {
  id: string
  user_id: string
  messages: Message[]
  created_at: string
  updated_at: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export const BET_TYPES = [
  'Match Result (1X2)',
  'Over / Under',
  'Both Teams to Score',
  'Asian Handicap',
  'Double Chance',
  'Draw No Bet',
  'Correct Score',
  'First Goalscorer',
  'Anytime Goalscorer',
  'Half-Time Result',
  'Accumulator',
  'Each Way',
  'Other',
]

export const LEAGUES = [
  'Premier League',
  'La Liga',
  'Bundesliga',
  'Serie A',
  'Ligue 1',
  'Champions League',
  'Europa League',
  'Conference League',
  'Championship',
  'MLS',
  'Turkish Süper Lig',
  'Eredivisie',
  'Primeira Liga',
  'Other',
]

export type BetType = string
