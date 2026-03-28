-- ============================================================
-- FootballBetAI - Supabase Database Schema
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- 2. BET_SLIPS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bet_slips (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  match_date DATE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  bet_type TEXT NOT NULL CHECK (bet_type IN (
    'Match Result', 'Over/Under', 'Both Teams Score',
    'Handicap', 'Correct Score', 'Accumulator'
  )),
  odds NUMERIC(10, 2) NOT NULL CHECK (odds > 1),
  stake NUMERIC(10, 2) NOT NULL CHECK (stake > 0),
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'void')),
  profit_loss NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- 3. AI_SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- 4. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bet_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES policies
-- ============================================================
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- BET_SLIPS policies
-- ============================================================
CREATE POLICY "Users can view own bets"
  ON public.bet_slips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bets"
  ON public.bet_slips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bets"
  ON public.bet_slips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bets"
  ON public.bet_slips FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- AI_SESSIONS policies
-- ============================================================
CREATE POLICY "Users can view own AI sessions"
  ON public.ai_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI sessions"
  ON public.ai_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATIONS policies
-- ============================================================
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES (for performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bet_slips_user_id ON public.bet_slips(user_id);
CREATE INDEX IF NOT EXISTS idx_bet_slips_match_date ON public.bet_slips(match_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_id ON public.ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- ============================================================
-- Done! Your database is ready.
-- ============================================================
