-- supabase/instagram-token-storage.sql
--
-- Tiny key-value table for rotating secrets that Vercel env can't manage
-- on its own (e.g. Instagram long-lived tokens that expire every 60 days).
--
-- The post-instagram endpoint reads from this table first, falling back to
-- the Vercel env var INSTAGRAM_ACCESS_TOKEN if no row exists. The refresh
-- cron writes new tokens here every ~14 days, so the IG pipeline keeps
-- working forever without manual OAuth re-runs.
--
-- Apply once via Supabase SQL Editor.

create table if not exists app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Service role only — never readable by anon / authenticated.
alter table app_secrets enable row level security;
-- (No policies = no row-level access; service-role key bypasses RLS.)

comment on table app_secrets is
  'Server-only rotating secrets (e.g. Instagram long-lived tokens). '
  'Read/written exclusively via the Supabase service-role key from API '
  'routes — RLS denies all client access by default.';
