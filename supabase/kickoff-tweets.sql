-- /api/admin/post-kickoff-alerts dedupe table
-- One row per fixture we've sent a "kicked off" alert tweet for.
-- The endpoint inserts after a successful tweet so subsequent invocations
-- (every 3-5 min) don't re-tweet the same kickoff.
--
-- Safe to run multiple times — uses IF NOT EXISTS.
-- The endpoint works WITHOUT this table (falls back to a per-warm-instance
-- module Set) but with the table you get cross-instance dedupe.

create table if not exists public.kickoff_tweets (
  fixture_id  bigint primary key,
  tweet_id    text,
  posted_at   timestamptz not null default now()
);

-- No RLS needed — only the cron endpoint touches this via service-role.
-- Optional cleanup: keep only last 7 days of rows so the table stays small.
-- (Run manually if desired.)
--   delete from public.kickoff_tweets where posted_at < now() - interval '7 days';
