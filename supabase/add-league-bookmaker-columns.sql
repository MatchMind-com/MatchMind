-- Add missing columns to bet_slips
ALTER TABLE bet_slips ADD COLUMN IF NOT EXISTS league TEXT;
ALTER TABLE bet_slips ADD COLUMN IF NOT EXISTS bookmaker TEXT;
