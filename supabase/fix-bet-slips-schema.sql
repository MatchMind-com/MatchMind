-- Fix bet_slips table to match the current app schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to run multiple times — all statements use IF NOT EXISTS or IF EXISTS

-- 1. Add missing columns
ALTER TABLE public.bet_slips ADD COLUMN IF NOT EXISTS match_name     TEXT;
ALTER TABLE public.bet_slips ADD COLUMN IF NOT EXISTS league         TEXT;
ALTER TABLE public.bet_slips ADD COLUMN IF NOT EXISTS bookmaker      TEXT;
ALTER TABLE public.bet_slips ADD COLUMN IF NOT EXISTS selection      TEXT;
ALTER TABLE public.bet_slips ADD COLUMN IF NOT EXISTS potential_return NUMERIC(10, 2);

-- 2. Make match_date nullable (form allows submitting without a date)
ALTER TABLE public.bet_slips ALTER COLUMN match_date DROP NOT NULL;

-- 3. Drop the old result check constraint (didn't include 'pending')
ALTER TABLE public.bet_slips DROP CONSTRAINT IF EXISTS bet_slips_result_check;
-- Add new constraint that includes 'pending'
ALTER TABLE public.bet_slips ADD CONSTRAINT bet_slips_result_check
  CHECK (result IN ('win', 'loss', 'void', 'pending'));

-- 4. Drop the old bet_type constraint (was too restrictive)
ALTER TABLE public.bet_slips DROP CONSTRAINT IF EXISTS bet_slips_bet_type_check;
-- Bet type is now free-form text — no constraint needed

-- 5. Make home_team / away_team nullable (app now uses match_name instead)
ALTER TABLE public.bet_slips ALTER COLUMN home_team DROP NOT NULL;
ALTER TABLE public.bet_slips ALTER COLUMN away_team DROP NOT NULL;

-- Done. The bet slip form should now save correctly.
