-- CLV (Closing Line Value) Tracking Migration
-- Run this in Supabase SQL Editor after track-record.sql

ALTER TABLE prediction_records
  ADD COLUMN IF NOT EXISTS closing_odds  numeric(5,2),   -- Pinnacle decimal odds at kickoff
  ADD COLUMN IF NOT EXISTS clv_percent   numeric(6,2);   -- ((our_odds / closing_odds) - 1) * 100

-- Index so we can query "predictions where CLV was positive"
CREATE INDEX IF NOT EXISTS idx_prediction_records_clv ON prediction_records(clv_percent);

-- Example CLV interpretation:
--   clv_percent =  +5.2  → we got 5.2% better odds than Pinnacle closed at = EDGE PROVEN
--   clv_percent =  -2.1  → market knew something we didn't
--   clv_percent = NULL   → Pinnacle odds unavailable for this market/fixture
