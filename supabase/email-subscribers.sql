-- Email subscribers table for landing page capture
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'landing_page',
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- Only service role can read/write — no public access
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
