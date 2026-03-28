-- Add starting_bankroll to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS starting_bankroll DECIMAL(10,2) DEFAULT 0;

-- Bankroll snapshots table
CREATE TABLE IF NOT EXISTS bankroll_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) NOT NULL,
  note TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bankroll_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own snapshots" ON bankroll_snapshots;
CREATE POLICY "Users manage own snapshots" ON bankroll_snapshots
  FOR ALL USING (auth.uid() = user_id);

-- Weekly reports table
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  report_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own reports" ON weekly_reports;
CREATE POLICY "Users manage own reports" ON weekly_reports
  FOR ALL USING (auth.uid() = user_id);
