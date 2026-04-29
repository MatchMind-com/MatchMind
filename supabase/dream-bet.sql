-- Dream Bet — user-defined bankroll growth goals
create table if not exists dream_bet_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  starting_bankroll numeric not null,
  current_bankroll numeric not null,
  target numeric not null,
  end_date date not null,
  risk_level text default 'balanced',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table dream_bet_goals enable row level security;

drop policy if exists "users own goals" on dream_bet_goals;
create policy "users own goals" on dream_bet_goals for all using (auth.uid() = user_id);

create index if not exists dream_bet_goals_user_idx on dream_bet_goals(user_id);
