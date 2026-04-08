-- Migration: onboarding_emails tracking table
-- Run this once in the Supabase SQL Editor before deploying the onboarding cron.
--
-- This table prevents duplicate onboarding emails from being sent.
-- The cron checks this table before sending and inserts a row after each send.

create table if not exists onboarding_emails (
  user_id uuid references auth.users(id) on delete cascade,
  day     int not null,          -- 1, 3, or 6
  sent_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Index for fast lookups by user
create index if not exists idx_onboarding_emails_user_id on onboarding_emails(user_id);
