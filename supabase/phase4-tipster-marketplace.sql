-- Phase 4: Tipster Marketplace Schema
-- Run this in your Supabase SQL Editor at: supabase.com → your project → SQL Editor

-- 1. Tipsters table
create table if not exists tipsters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text not null,
  bio text,
  speciality text, -- e.g. "Premier League Goals", "Asian Handicap", "BTTS"
  monthly_price numeric(10,2) not null default 9.99,
  avatar_url text,
  is_active boolean default true,
  -- Track record (auto-updated when tip results are set)
  total_tips integer default 0,
  wins integer default 0,
  losses integer default 0,
  voids integer default 0,
  win_rate numeric(5,2) default 0,       -- percentage e.g. 62.5
  roi numeric(6,2) default 0,            -- return on investment % e.g. +18.4
  total_profit numeric(10,2) default 0,  -- in units
  avg_odds numeric(5,2) default 0,
  subscribers integer default 0,
  created_at timestamptz default now()
);

-- 2. Tips table
create table if not exists tips (
  id uuid primary key default gen_random_uuid(),
  tipster_id uuid references tipsters(id) on delete cascade not null,
  match_name text not null,          -- e.g. "Arsenal vs Chelsea"
  league text,                       -- e.g. "Premier League"
  kick_off timestamptz,              -- match kickoff time
  bet_type text not null,            -- e.g. "Home Win", "Over 2.5", "BTTS"
  odds numeric(5,2) not null,        -- decimal odds e.g. 1.85
  stake_units numeric(3,1) not null default 1.0,  -- 0.5 to 5 units
  reasoning text,                    -- tipster's analysis
  result text check (result in ('win','loss','void',null)),
  profit_loss numeric(8,2),          -- in units (positive = profit)
  is_free boolean default false,     -- free tips visible to non-subscribers
  created_at timestamptz default now()
);

-- 3. Tipster subscriptions table
create table if not exists tipster_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid references auth.users(id) on delete cascade not null,
  tipster_id uuid references tipsters(id) on delete cascade not null,
  stripe_subscription_id text,
  status text default 'active' check (status in ('active','cancelled','past_due')),
  created_at timestamptz default now(),
  unique(subscriber_id, tipster_id)
);

-- 4. Row Level Security
alter table tipsters enable row level security;
alter table tips enable row level security;
alter table tipster_subscriptions enable row level security;

-- Tipsters: anyone can read, only owner can write
create policy "tipsters_public_read" on tipsters for select using (true);
create policy "tipsters_owner_insert" on tipsters for insert with check (auth.uid() = user_id);
create policy "tipsters_owner_update" on tipsters for update using (auth.uid() = user_id);

-- Tips: free tips visible to all; premium tips visible to subscribers + tipster
create policy "tips_free_read" on tips for select using (
  is_free = true
  or exists (select 1 from tipsters t where t.id = tips.tipster_id and t.user_id = auth.uid())
  or exists (select 1 from tipster_subscriptions s where s.tipster_id = tips.tipster_id and s.subscriber_id = auth.uid() and s.status = 'active')
);
create policy "tips_tipster_insert" on tips for insert with check (
  exists (select 1 from tipsters t where t.id = tipster_id and t.user_id = auth.uid())
);
create policy "tips_tipster_update" on tips for update using (
  exists (select 1 from tipsters t where t.id = tips.tipster_id and t.user_id = auth.uid())
);

-- Subscriptions: users see their own; service role sees all
create policy "subs_own_read" on tipster_subscriptions for select using (auth.uid() = subscriber_id);
create policy "subs_own_insert" on tipster_subscriptions for insert with check (auth.uid() = subscriber_id);
create policy "subs_own_update" on tipster_subscriptions for update using (auth.uid() = subscriber_id);

-- 5. Auto-update tipster stats when a tip result is set
create or replace function update_tipster_stats()
returns trigger as $$
declare
  v_tipster_id uuid;
  v_total integer;
  v_wins integer;
  v_losses integer;
  v_voids integer;
  v_total_profit numeric;
  v_avg_odds numeric;
  v_win_rate numeric;
  v_roi numeric;
begin
  v_tipster_id := coalesce(NEW.tipster_id, OLD.tipster_id);

  select
    count(*) filter (where result is not null),
    count(*) filter (where result = 'win'),
    count(*) filter (where result = 'loss'),
    count(*) filter (where result = 'void'),
    coalesce(sum(profit_loss) filter (where result is not null), 0),
    coalesce(avg(odds) filter (where result is not null), 0)
  into v_total, v_wins, v_losses, v_voids, v_total_profit, v_avg_odds
  from tips
  where tipster_id = v_tipster_id and result is not null;

  v_win_rate := case when (v_wins + v_losses) > 0 then round((v_wins::numeric / (v_wins + v_losses)) * 100, 1) else 0 end;
  -- ROI = total profit / total staked * 100
  v_roi := case when v_total > 0 then round(v_total_profit / v_total * 100, 1) else 0 end;

  update tipsters set
    total_tips = v_total,
    wins = v_wins,
    losses = v_losses,
    voids = v_voids,
    win_rate = v_win_rate,
    roi = v_roi,
    total_profit = v_total_profit,
    avg_odds = round(v_avg_odds, 2)
  where id = v_tipster_id;

  return NEW;
end;
$$ language plpgsql security definer;

create or replace trigger tipster_stats_trigger
after insert or update of result on tips
for each row execute function update_tipster_stats();

-- 6. Auto-update subscriber count
create or replace function update_subscriber_count()
returns trigger as $$
begin
  update tipsters set
    subscribers = (
      select count(*) from tipster_subscriptions
      where tipster_id = coalesce(NEW.tipster_id, OLD.tipster_id)
      and status = 'active'
    )
  where id = coalesce(NEW.tipster_id, OLD.tipster_id);
  return NEW;
end;
$$ language plpgsql security definer;

create or replace trigger subscriber_count_trigger
after insert or update of status or delete on tipster_subscriptions
for each row execute function update_subscriber_count();
