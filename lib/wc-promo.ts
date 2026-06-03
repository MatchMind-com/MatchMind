/**
 * World Cup 2026 promo helper.
 *
 * During the World Cup group stage (June 11 — July 3, 2026) all picks are
 * unlocked free for every user. Banner copy + paywall gate share this date
 * window so they stay in sync.
 *
 * The kickoff date (Mexico v South Africa, Estadio Azteca) is anchored to
 * June 11. The end date covers the entire tournament through the final on
 * July 19 — TikTok-driven visitors who discover us mid-tournament get the
 * same offer as launch-day visitors.
 *
 * To activate the paywall post-tournament, replace `FORCE_PRO_TIER = true`
 * in app/dashboard/predictions/page.tsx with `isWcPromoActive()`. That
 * keeps WC free and automatically restores the paywall once it ends.
 */

// Hard-coded WC 2026 dates (UTC).
const WC_START_UTC = new Date('2026-06-11T16:00:00Z') // first kickoff
const WC_END_UTC   = new Date('2026-07-20T00:00:00Z') // day after final

/**
 * @returns true if today falls within the World Cup promo window.
 * Use this anywhere we want the promo to gate behavior (banner visibility,
 * future paywall bypass, email content, etc.).
 */
export function isWcPromoActive(now: Date = new Date()): boolean {
  return now >= WC_START_UTC && now < WC_END_UTC
}

/**
 * @returns true if we're in the pre-kickoff hype window (T-14 to T-0).
 * Used to show "Free until kickoff" promo banner BEFORE the tournament
 * starts — same offer, framed as a teaser for visitors landing early.
 */
export function isWcPreKickoffWindow(now: Date = new Date()): boolean {
  const fourteenDaysOut = new Date(WC_START_UTC.getTime() - 14 * 24 * 60 * 60 * 1000)
  return now >= fourteenDaysOut && now < WC_START_UTC
}

/**
 * @returns true if the promo (pre-window OR active window) is visible.
 * Banner uses this; gate logic uses isWcPromoActive() only.
 */
export function isWcPromoVisible(now: Date = new Date()): boolean {
  return isWcPreKickoffWindow(now) || isWcPromoActive(now)
}

/**
 * Days until kickoff, clamped to ≥0. After kickoff returns 0.
 */
export function daysUntilWcKickoff(now: Date = new Date()): number {
  const ms = WC_START_UTC.getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

/**
 * Banner copy variants depending on which window we're in.
 */
export function wcPromoBannerCopy(now: Date = new Date()): {
  eyebrow: string
  headline: string
  cta: string
} | null {
  if (isWcPreKickoffWindow(now)) {
    const days = daysUntilWcKickoff(now)
    return {
      eyebrow: 'World Cup 2026',
      headline: `${days} days until kickoff — all picks unlocked free during the tournament`,
      cta: 'Claim free access',
    }
  }
  if (isWcPromoActive(now)) {
    return {
      eyebrow: 'World Cup 2026 · LIVE',
      headline: 'All picks unlocked free for every match of the World Cup',
      cta: 'See today’s picks',
    }
  }
  return null
}
