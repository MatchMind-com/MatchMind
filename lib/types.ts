export interface Profile {
  id: string
  user_id: string
  email: string
  username?: string
  referral_code?: string
  referred_by?: string | null
  referral_count?: number
  subscription_tier: 'free' | 'pro' | 'elite'
  subscription_status?: string | null
  subscription_current_period_end?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  starting_bankroll?: number
  loss_limit?: number | null
  daily_alert_opt_in?: boolean
  weekly_report_opt_in?: boolean
  take_a_break_until?: string | null
  created_at: string
  updated_at: string
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
  bookmaker?: string
  potential_return?: number
  result: 'win' | 'loss' | 'void' | 'pending'
  profit_loss: number
  match_date?: string
  created_at: string
  notes?: string
  fixture_id?: number | null
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
