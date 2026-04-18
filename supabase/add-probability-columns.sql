-- Add missing AI probability columns to prediction_records
-- These are referenced by app/dashboard/predictions and were removed from the
-- public /predictions/[slug] query on 2026-04-18 because the columns didn't exist.
-- Run this to re-enable the 3-way probability bar + key_factors list on slug pages.

ALTER TABLE prediction_records
  ADD COLUMN IF NOT EXISTS home_win_pct integer CHECK (home_win_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS draw_pct     integer CHECK (draw_pct     BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS away_win_pct integer CHECK (away_win_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS key_factors  text[];
