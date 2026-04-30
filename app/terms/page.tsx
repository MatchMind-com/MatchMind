/**
 * /terms — public Terms of Service.
 *
 * Required for Stripe + IG Graph API + TikTok Content Posting API
 * app review. Plain HTML, no auth, no client JS.
 */

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — MatchMind',
  description:
    'Terms of Service for matchmindcom.com — an AI football betting analyst.',
}

const LAST_UPDATED = 'April 30, 2026'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-bg-base text-fg px-5 lg:px-8 py-10 lg:py-14">
      <article className="max-w-3xl mx-auto prose prose-invert prose-headings:text-fg prose-a:text-brand">
        <h1 className="font-headline text-3xl lg:text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-fg-muted text-sm mb-8">Last updated: {LAST_UPDATED}</p>

        <p className="text-fg-secondary leading-relaxed">
          These Terms govern your use of <a href="https://www.matchmindcom.com">matchmindcom.com</a> and the
          MatchMind service (the &quot;Service&quot;). By using the Service you
          agree to these Terms. If you don&apos;t agree, please stop using
          the Service.
        </p>

        <h2>1. The Service</h2>
        <p>
          MatchMind provides AI-generated football betting analysis,
          value-bet predictions, bankroll tracking, and a chat-based
          coaching assistant. Predictions are produced by automated
          models that combine bookmaker odds with statistical analysis.
        </p>
        <p>
          <strong>This is information, not advice.</strong> We do not
          guarantee any outcome. All bets you place are entirely your
          own decision and at your own risk.
        </p>

        <h2>2. 18+ only — bet responsibly</h2>
        <p>
          You must be 18 or older (or the legal gambling age in your
          jurisdiction, whichever is higher) to use this Service. By
          using MatchMind you confirm you meet that age requirement.
        </p>
        <p>
          Gambling can be addictive. If you&apos;re worried about your
          betting, please contact:
        </p>
        <ul>
          <li>UK: <a href="https://www.gamcare.org.uk">GamCare</a> · <a href="https://www.begambleaware.org">BeGambleAware</a> · 0808 8020 133</li>
          <li>US: <a href="https://www.ncpgambling.org">National Council on Problem Gambling</a> · 1-800-522-4700</li>
          <li>Other: search for &quot;problem gambling helpline&quot; in your country.</li>
        </ul>
        <p>
          You can set a personal loss limit in Settings → Bankroll
          which we&apos;ll surface as warnings during the session.
        </p>

        <h2>3. Your account</h2>
        <p>
          You&apos;re responsible for the security of your account credentials
          and for all activity under your account. Notify us immediately
          if you suspect unauthorised access. We may suspend or terminate
          accounts that breach these Terms or engage in abuse / fraud.
        </p>

        <h2>4. Subscriptions &amp; payments</h2>
        <p>
          Some features are paid (Pro tier). Subscriptions are billed
          monthly or annually via Stripe and renew automatically until
          cancelled. You can cancel any time from Settings → Billing —
          access continues until the end of the current billing period.
          We do not refund partial months unless required by law.
        </p>

        <h2>5. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Resell or rebrand the Service without written permission.</li>
          <li>Scrape, automate, or reverse-engineer the prediction models or any API beyond your subscription tier&apos;s rate limit.</li>
          <li>Upload illegal, infringing, or malicious content (slip scanner included).</li>
          <li>Use the Service to violate any applicable gambling, financial, or data protection laws in your jurisdiction.</li>
        </ul>

        <h2>6. Intellectual property</h2>
        <p>
          The Service&apos;s software, design, AI prompts, and aggregated
          prediction data are owned by MatchMind. You retain ownership
          of bets and notes you log; you grant us a non-exclusive licence
          to process them in order to provide the Service.
        </p>

        <h2>7. Third-party data</h2>
        <p>
          Live fixtures, odds, and stats are sourced from API-Football
          and SofaScore. We make no warranty as to accuracy, completeness,
          or timeliness of that data. Always verify with your bookmaker
          before placing a real bet.
        </p>

        <h2>8. Disclaimers</h2>
        <p>
          The Service is provided &quot;as is&quot; without warranty of any kind.
          To the maximum extent permitted by law, we disclaim all implied
          warranties including merchantability, fitness for a particular
          purpose, and non-infringement.
        </p>
        <p>
          We are not responsible for any losses arising from bets you
          place — winning or losing money based on our analysis is entirely
          your own decision and risk.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, our total liability to
          you for any claim arising out of these Terms or the Service is
          limited to the amount you paid us in the 12 months preceding
          the claim. We are not liable for indirect, incidental, special,
          consequential, or exemplary damages — including any betting
          losses.
        </p>

        <h2>10. Termination</h2>
        <p>
          You can close your account any time. We may suspend or terminate
          access for breach of these Terms. Upon termination, your right
          to use the Service ends immediately. Sections 6, 8, 9, 10, 11,
          and 12 survive termination.
        </p>

        <h2>11. Changes</h2>
        <p>
          We may update these Terms. Material changes get an in-app
          notice and we bump the &quot;last updated&quot; date. Continued use
          after changes means you accept the new Terms.
        </p>

        <h2>12. Governing law</h2>
        <p>
          These Terms are governed by the laws of England and Wales.
          Disputes will be heard in the courts of England and Wales,
          unless local consumer law gives you stronger rights.
        </p>

        <h2>Contact</h2>
        <p>
          <a href="mailto:hello@matchmindcom.com">hello@matchmindcom.com</a>
        </p>
      </article>
    </main>
  )
}
