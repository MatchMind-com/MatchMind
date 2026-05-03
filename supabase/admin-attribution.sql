-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  MatchMind admin dashboard — Supabase migration                    ║
-- ║  Run this in Supabase SQL Editor (paste, click Run, wait 5 sec).   ║
-- ║  Safe to re-run: every statement is idempotent (IF NOT EXISTS / ON ║
-- ║  CONFLICT DO NOTHING).                                              ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- ── 1. Attribution columns on profiles ────────────────────────────────
-- These fill in when a new user signs up. Without them you can't tell
-- a TikTok signup from a Reddit signup.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_source        TEXT,    -- 'tiktok' | 'instagram' | 'reddit' | ...
  ADD COLUMN IF NOT EXISTS utm_source           TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium           TEXT,    -- 'paid' | 'organic' | 'social' | ...
  ADD COLUMN IF NOT EXISTS utm_campaign         TEXT,
  ADD COLUMN IF NOT EXISTS utm_content          TEXT,    -- per-video tag, e.g. 'v23'
  ADD COLUMN IF NOT EXISTS utm_term             TEXT,
  ADD COLUMN IF NOT EXISTS landing_page         TEXT,
  ADD COLUMN IF NOT EXISTS signup_ref           TEXT,
  ADD COLUMN IF NOT EXISTS country              TEXT,    -- ISO code, e.g. 'TR', 'US'
  ADD COLUMN IF NOT EXISTS device_class         TEXT,    -- 'mobile' | 'tablet' | 'desktop'
  ADD COLUMN IF NOT EXISTS total_seconds_active INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_active_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_active_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_count        INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_signup_source ON profiles(signup_source);
CREATE INDEX IF NOT EXISTS idx_profiles_utm_campaign  ON profiles(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_profiles_utm_content   ON profiles(utm_content);
CREATE INDEX IF NOT EXISTS idx_profiles_country       ON profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active   ON profiles(last_active_at DESC);

-- ── 2. Admin allowlist ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  email     TEXT PRIMARY KEY,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by  TEXT,
  notes     TEXT
);

INSERT INTO admin_users (email, notes) VALUES
  ('sertoglualp@gmail.com', 'Founder — Alp')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- No SELECT policy on purpose: only service_role can read this list.

-- ── 3. Heartbeat RPC ──────────────────────────────────────────────────
-- The browser pings this every ~30 seconds while a user has the tab open.
-- It updates last_active_at, accumulates time, and counts a new session
-- if the gap from the previous heartbeat was longer than 30 minutes.
CREATE OR REPLACE FUNCTION public.record_heartbeat(
  p_user_id UUID,
  p_seconds INTEGER DEFAULT 30
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last TIMESTAMPTZ;
  v_gap  INTERVAL;
BEGIN
  IF p_seconds <= 0 OR p_seconds > 60 THEN p_seconds := 30; END IF;

  SELECT last_active_at INTO v_last FROM profiles WHERE id = p_user_id;
  v_gap := COALESCE(NOW() - v_last, INTERVAL '1 hour');

  UPDATE profiles SET
    first_active_at      = COALESCE(first_active_at, NOW()),
    last_active_at       = NOW(),
    total_seconds_active = total_seconds_active + p_seconds,
    session_count        = session_count + (CASE WHEN v_gap > INTERVAL '30 minutes' THEN 1 ELSE 0 END)
  WHERE id = p_user_id;
END $$;

GRANT EXECUTE ON FUNCTION public.record_heartbeat(UUID, INTEGER) TO authenticated;

-- ── 4. The admin view ─────────────────────────────────────────────────
-- One row per signed-up user, joining everything /admin needs.
-- bet_count is computed from bet_slips (existing table). If your
-- bet_slips table uses a different column name for the FK, edit the
-- LEFT JOIN below.
CREATE OR REPLACE VIEW admin_signup_view AS
SELECT
  u.id,
  u.email,
  u.created_at                    AS signed_up_at,
  u.last_sign_in_at,
  -- attribution
  p.signup_source,
  p.utm_source,
  p.utm_medium,
  p.utm_campaign,
  p.utm_content,
  p.landing_page,
  p.signup_ref,
  p.country,
  p.device_class,
  -- engagement (heartbeat)
  p.total_seconds_active,
  p.session_count,
  p.first_active_at,
  p.last_active_at,
  -- referral
  p.referral_code,
  p.referral_count,
  p.referred_by,
  -- bets
  COALESCE(b.bet_count, 0)        AS bet_count,
  -- preferences (kept available even though the table doesn't show them)
  up.favourite_team,
  up.lucky_charm_team,
  up.betting_experience,
  up.onboarding_completed,
  -- subscription (Pro status)
  p.subscription_status,
  p.subscription_tier,
  p.subscription_current_period_end,
  (
    p.subscription_status IN ('active','trialing')
    AND (p.subscription_current_period_end IS NULL
         OR p.subscription_current_period_end > NOW())
  )                               AS is_pro,
  -- derived: paid vs organic acquisition
  (p.utm_medium IN ('paid','cpc','ppc','sponsored')) AS is_paid_acquisition
FROM auth.users u
LEFT JOIN profiles                p  ON p.id      = u.id
LEFT JOIN user_preferences        up ON up.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS bet_count
  FROM bet_slips
  GROUP BY user_id
) b ON b.user_id = u.id;
