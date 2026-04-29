-- predictions_cache: single-row store for the full /api/predictions payload.
-- The heavy generation (API-Football + GPT-4o) runs in the refresh-predictions cron
-- and writes here. The public /api/predictions route just reads this row (<100ms).

create table if not exists predictions_cache (
  id          integer primary key default 1,  -- always one row
  payload     jsonb        not null,
  generated_at timestamptz not null default now(),
  fixture_count integer,
  leagues_count integer
);

-- Ensure only one row can ever exist
create unique index if not exists predictions_cache_singleton on predictions_cache (id);

-- Public read (no auth required — same as the route returns)
alter table predictions_cache enable row level security;
create policy "public read" on predictions_cache for select using (true);
