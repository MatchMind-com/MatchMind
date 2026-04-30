/**
 * /privacy — public privacy policy.
 *
 * Required by Stripe, Meta (Instagram Graph API), and TikTok (Content
 * Posting API) for app review. Covers what data we collect, how we use
 * it, third-party processors, retention, user rights.
 *
 * Plain HTML — no auth, no client JS — so reviewers and crawlers can
 * read it without rendering issues.
 */

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — MatchMind',
  description:
    'How MatchMind collects, uses, and protects your personal data when you use matchmindcom.com.',
}

const LAST_UPDATED = 'April 30, 2026'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-bg-base text-fg px-5 lg:px-8 py-10 lg:py-14">
      <article className="max-w-3xl mx-auto prose prose-invert prose-headings:text-fg prose-a:text-brand">
        <h1 className="font-headline text-3xl lg:text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-fg-muted text-sm mb-8">Last updated: {LAST_UPDATED}</p>

        <p className="text-fg-secondary leading-relaxed">
          MatchMind (&quot;we&quot;, &quot;us&quot;) operates{' '}
          <a href="https://www.matchmindcom.com">matchmindcom.com</a> — an AI
          football betting analyst. This policy explains what we collect,
          how we use it, and your rights. We follow GDPR and the UK Data
          Protection Act 2018.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account info</strong>: email address, display name,
            authentication tokens (via Supabase Auth).
          </li>
          <li>
            <strong>Bet history you log</strong>: matches, selections,
            stakes, odds, results — only what you enter or upload via the
            slip scanner.
          </li>
          <li>
            <strong>Bankroll &amp; goals</strong>: your starting bankroll,
            target amounts, and snapshot history.
          </li>
          <li>
            <strong>AI conversations</strong>: messages you exchange with
            the Coach assistant. Used to build memory of your preferences
            and improve responses.
          </li>
          <li>
            <strong>Usage analytics</strong>: pages visited, features used.
            Aggregated, not tied to advertising profiles.
          </li>
          <li>
            <strong>Payment info</strong>: handled by Stripe — we never
            store full card details. We retain only Stripe&apos;s subscription
            id + plan tier.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>Provide the betting analysis service you signed up for.</li>
          <li>Personalise AI Coach responses to your bet history.</li>
          <li>Send transactional emails (sign-up confirmation, billing).</li>
          <li>Improve our prediction models in aggregate (no individual identifiers).</li>
        </ul>

        <h2>Third-party processors</h2>
        <p>
          We use the following sub-processors. Each handles only the data
          necessary for the service they provide:
        </p>
        <ul>
          <li><strong>Supabase</strong> — auth, database, storage.</li>
          <li><strong>Stripe</strong> — payment processing.</li>
          <li><strong>Vercel</strong> — hosting.</li>
          <li><strong>OpenAI</strong> — AI Coach and predictions inference. Conversation content is sent to OpenAI&apos;s API; per their commercial agreement they do not train on it.</li>
          <li><strong>API-Football &amp; SofaScore</strong> — fixture / odds / live data feeds (no user data sent).</li>
          <li><strong>Resend</strong> — transactional email delivery.</li>
        </ul>

        <h2>Social posting</h2>
        <p>
          Our @MatchMind_AI accounts on Twitter, Instagram, and TikTok
          post AI-generated picks publicly. These posts contain match
          names + odds + AI verdicts only — never any individual user
          data. Our automation accesses ONLY our own social accounts via
          OAuth, scoped to publishing posts. No user&apos;s personal social
          accounts are touched.
        </p>

        <h2>Data retention</h2>
        <ul>
          <li>Active account data: kept while your account is open.</li>
          <li>Bet history: kept indefinitely so you can review your track record (delete any bet at any time from Money → My Bets → History).</li>
          <li>Closed accounts: data deleted within 30 days of account closure, except for legal/billing records (kept 7 years per UK accounting law).</li>
        </ul>

        <h2>Your rights (GDPR / UK DPA)</h2>
        <p>You can:</p>
        <ul>
          <li><strong>Access</strong> — export all your data via Money → My Bets → Export CSV.</li>
          <li><strong>Rectify</strong> — edit any bet, profile field, or preference in-app.</li>
          <li><strong>Delete</strong> — close your account from Settings → Account, or email us.</li>
          <li><strong>Object</strong> — opt out of analytics or marketing emails any time.</li>
          <li><strong>Complain</strong> — to the UK Information Commissioner&apos;s Office (ICO) at <a href="https://ico.org.uk">ico.org.uk</a>.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We use first-party cookies for authentication (your Supabase
          session) and a single preference cookie (currency display).
          We don&apos;t use third-party advertising cookies.
        </p>

        <h2>Children</h2>
        <p>
          MatchMind is for users 18+. We do not knowingly collect data
          from anyone under 18. If you believe a minor has registered,
          contact us and we will delete the account.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We&apos;ll post material changes here and bump the &quot;last updated&quot;
          date. Significant changes will also trigger an in-app notice.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, data requests, or complaints:{' '}
          <a href="mailto:hello@matchmindcom.com">hello@matchmindcom.com</a>
        </p>
      </article>
    </main>
  )
}
