-- Daily Social ACCA tracking
-- Persists the once-per-day "Featured ACCA" that gets posted to Twitter
-- (and Instagram/TikTok once those auth flows resolve).
--
-- Each row represents one calendar-day's ACCA. Legs are denormalised into JSON
-- so we don't need a separate join — track-record display only needs to read.
-- Result is null until the grading cron resolves all legs.

create table if not exists daily_accas (
  id uuid primary key default gen_random_uuid(),
  date date not null,                          -- UTC date this ACCA was generated for
  tier text not null default 'balanced',       -- 'safe' | 'balanced' | 'big_win' | 'btts_themed'
  legs jsonb not null,                         -- [{fixture_id, home, away, league, market, prediction, odds, ev, kick_off}]
  combined_odds numeric(8,2) not null,
  combined_implied_prob numeric(5,2),          -- 100 / combined_odds, for display
  -- Twitter post tracking
  tweet_id text,
  tweet_posted_at timestamptz,
  -- Result tracking (filled by /api/cron/check-predictions after all legs resolved)
  result text check (result in ('win', 'loss', 'void', null)),
  profit_loss numeric(8,2),                    -- combined_odds - 1 if win, -1 if loss
  legs_won integer,                            -- 0..N — useful for "2 of 3 legs hit" partial display
  legs_total integer,
  graded_at timestamptz,
  created_at timestamptz default now(),
  unique(date, tier)                           -- one ACCA per date per tier
);

create index if not exists idx_daily_accas_date on daily_accas(date desc);
create index if not exists idx_daily_accas_result on daily_accas(result);

-- Public read access (these are publicly-broadcast ACCAs, same as track record)
alter table daily_accas enable row level security;
create policy if not exists "daily_accas_public_read"
  on daily_accas for select using (true);
-- Only service role can insert/update (via cron + grading)
