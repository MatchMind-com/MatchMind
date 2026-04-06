-- Add new columns to profiles table for Settings + Referral features
-- Run this in the Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS daily_alert_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS weekly_report_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS loss_limit NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS take_a_break_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referral_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- Auto-generate referral codes for existing users (uses first 8 chars of user id)
UPDATE profiles
SET referral_code = UPPER(SUBSTRING(id::TEXT, 1, 8))
WHERE referral_code IS NULL;

-- Index for referral code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
