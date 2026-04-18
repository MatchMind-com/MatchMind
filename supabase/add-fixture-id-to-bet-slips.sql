-- Add fixture_id to bet_slips so results can be auto-verified
-- Run in Supabase SQL Editor

ALTER TABLE public.bet_slips ADD COLUMN IF NOT EXISTS fixture_id INTEGER;

-- Index for fast lookups by fixture
CREATE INDEX IF NOT EXISTS idx_bet_slips_fixture_id ON public.bet_slips(fixture_id);
CREATE INDEX IF NOT EXISTS idx_bet_slips_result ON public.bet_slips(result);
CREATE INDEX IF NOT EXISTS idx_bet_slips_match_date ON public.bet_slips(match_date);
