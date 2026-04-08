# BetIQ — Collaboration Guide
*For Kemal and collaborator*

---

## Step 1 — Kemal: Add Your Friend as a Collaborator

1. Go to **https://github.com/Kemald07/footballbetai**
2. Click **Settings** (top menu)
3. Click **Collaborators** (left sidebar)
4. Click **Add people**
5. Enter your friend's GitHub username or email
6. They'll receive an email invite — they must accept it

Once accepted, they have full push access to the repo.

---

## Step 2 — Friend: Clone the Repo

Your friend runs this once on their machine:

```bash
git clone https://github.com/Kemald07/footballbetai.git
cd footballbetai
npm install
```

They'll also need a `.env.local` file — **Kemal sends this privately** (never commit it):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
RESEND_API_KEY=...
STRIPE_SECRET_KEY=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
CRON_SECRET=...
NEXT_PUBLIC_APP_URL=https://footballbetai.vercel.app
```

To run locally:
```bash
npm run dev
# opens at http://localhost:3000
```

---

## Branch Strategy

```
main          ← live production (auto-deploys to Vercel)
dev           ← shared working branch (merge features here first)
kemal/[name]  ← Kemal's feature branches
friend/[name] ← Friend's feature branches
```

### The workflow

**Starting a new feature:**
```bash
git checkout dev
git pull origin dev
git checkout -b kemal/my-new-feature   # or friend/my-new-feature
```

**Finishing a feature:**
```bash
git add .
git commit -m "feat: description of what you built"
git push origin kemal/my-new-feature
```

Then open a **Pull Request** on GitHub from your branch → `dev`.
The other person reviews and merges it into `dev`.

**Deploying to production:**
When `dev` is stable and tested:
```bash
git checkout main
git merge dev
git push origin main
# Vercel auto-deploys within ~1 min
```

---

## Rules to Avoid Conflicts

| Rule | Why |
|------|-----|
| Never push directly to `main` | Keeps production stable |
| Always `git pull origin dev` before starting work | Avoids merge conflicts |
| One person per file at a time | Tell each other what you're working on |
| Use clear commit messages (`feat:`, `fix:`, `chore:`) | Easy to track who did what |

---

## Key Files — Who Owns What (suggested split)

| Area | Owner |
|------|-------|
| AI predictions logic (`app/api/predictions/`) | Kemal |
| Frontend UI / landing page | Either |
| Tipster marketplace | Friend |
| SEO / public pages | Friend |
| Stripe / billing | Kemal |
| Dashboard features | Either |

---

## Friend's First Task (suggested)

A great first contribution: **write the first blog post** for the content hub.

Create `app/blog/page.tsx` and `app/blog/how-to-find-value-bets/page.tsx` — a public SEO article explaining what value betting is. This requires no backend knowledge, just React + Tailwind, and will immediately drive Google traffic.

---

## Useful Links

| Link | What it is |
|------|-----------|
| https://footballbetai.vercel.app | Live production site |
| https://github.com/Kemald07/footballbetai | GitHub repo |
| https://supabase.com/dashboard | Database (Kemal shares access) |
| https://vercel.com/dashboard | Deployments (Kemal shares access) |

---

*Questions? Ping each other on WhatsApp — or open a GitHub Issue on the repo.*
