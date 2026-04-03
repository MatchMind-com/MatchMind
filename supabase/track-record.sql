-- Track Record Schema
-- Stores every AI prediction and auto-verifies results nightly

create table if not exists prediction_records (
  id uuid primary key default gen_random_uuid(),
  fixture_id integer not null,
  home_team text not null,
  away_team text not null,
  league text not null,
  league_id integer,
  kick_off timestamptz not null,
  season integer not null,
  bet_type text not null,        -- e.g. 'Home Win', 'Over 2.5 Goals', 'BTTS'
  prediction text not null,      -- e.g. 'home_win', 'over_2_5', 'btts_yes'
  ai_probability integer,        -- 0-100
  odds numeric(5,2),             -- decimal odds at prediction time
  ev_percent numeric(6,2),       -- expected value %
  is_value_bet boolean default false,
  result text check (result in ('win', 'loss', 'void', null)),
  profit_loss numeric(8,2),      -- units (1 unit stake assumed)
  home_score integer,
  away_score integer,
  checked_at timestamptz,
  created_at timestamptz default now(),
  unique(fixture_id, prediction) -- prevent duplicates per fixture+bet combo
);

-- Index for fast lookups
create index if not exists idx_prediction_records_kick_off on prediction_records(kick_off);
create index if not exists idx_prediction_records_result on prediction_records(result);
create index if not exists idx_prediction_records_league on prediction_records(league);

-- Public read access (track record is public)
alter table prediction_records enable row level security;
create policy "prediction_records_public_read" on prediction_records for select using (true);
-- Only service role can insert/update (via cron + predictions API)
