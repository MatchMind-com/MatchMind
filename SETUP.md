# FootballBetAI - Setup Guide

## 1. Install Dependencies

```bash
cd footballbetai
npm install
```

## 2. Set Up Supabase

### Create a Supabase Project
1. Go to https://supabase.com and sign in
2. Click **New Project**
3. Give it a name (e.g., `footballbetai`), set a strong database password, choose a region
4. Wait ~2 minutes for it to provision

### Run the Database Schema
1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Copy the entire contents of `supabase-schema.sql` and paste it in
4. Click **Run** — you should see "Success"

### Get Your API Keys
1. In Supabase, go to **Project Settings** → **API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Enable Email Auth
1. Go to **Authentication** → **Providers**
2. Make sure **Email** is enabled (it is by default)
3. Optional: Disable "Confirm email" for easier development → **Authentication** → **Email Templates** → toggle off "Confirm email"

## 3. Get Your OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Click **Create new secret key**
3. Copy the key → `OPENAI_API_KEY`

## 4. Create Your .env.local File

Create a file called `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
OPENAI_API_KEY=sk-your-openai-key-here
```

## 5. Run the App

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to /login.

## 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

When prompted, add your environment variables. Or go to your Vercel dashboard → Project → Settings → Environment Variables and add all three keys.

## Troubleshooting

- **"relation profiles does not exist"** → Re-run the SQL schema in Supabase SQL Editor
- **"Invalid API Key"** → Check your `.env.local` has no spaces around the `=` sign
- **AI not responding** → Verify your `OPENAI_API_KEY` has credits and access to `gpt-4o`
- **Login not working** → Check Supabase Authentication → Email is enabled; try disabling email confirmation for dev
