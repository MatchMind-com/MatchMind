-- Per-league predictions cache. Each cron writes its own leagues.
-- Public route reads all rows and merges.
create table if not exists predictions_by_league (
  league_id integer primary key,
  league_name text not null,
  league_flag text,
  payload jsonb not null,           -- array of prediction objects for this league
  generated_at timestamptz not null default now(),
  fixture_count integer default 0,
  api_failures integer default 0
);

create index if not exists predictions_by_league_generated_at_idx on predictions_by_league (generated_at desc);

alter table predictions_by_league enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'predictions_by_league' and policyname = 'public read') then
    execute 'create policy "public read" on predictions_by_league for select using (true)';
  end if;
end $$;
