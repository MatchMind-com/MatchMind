/**
 * MatchMind Affiliate Configuration
 * ─────────────────────────────────
 * Replace the `url` values with your real affiliate tracking links.
 * Each bookmaker also has a `signupUrl` for the "New customer" bonus CTA.
 *
 * To get your links:
 *   Bet365     → affiliates.bet365.com
 *   Unibet     → unibetpartners.com
 *   Betway     → betwaypartners.com
 *   1xBet      → 1xbet-partners.com
 *   William Hill → williamhillaffiliates.com
 */

export interface BookmakerAffiliate {
  name: string
  /** Short display name for buttons */
  short: string
  /** Your affiliate tracking URL — replace XXXXXXXXXX with your ID */
  url: string
  /** Colour shown on the button (Tailwind-compatible inline style) */
  color: string
  /** Welcome bonus copy shown next to the button */
  bonus: string | null
}

export const AFFILIATES: Record<string, BookmakerAffiliate> = {
  bet365: {
    name: 'Bet365',
    short: 'Bet365',
    url: 'https://www.bet365.com/?affiliate=XXXXXXXXXX',  // ← replace with your link
    color: '#1d7a3c',
    bonus: 'New customer offer',
  },
  unibet: {
    name: 'Unibet',
    short: 'Unibet',
    url: 'https://www.unibet.com/affiliates/XXXXXXXXXX',  // ← replace
    color: '#147b45',
    bonus: null,
  },
  betway: {
    name: 'Betway',
    short: 'Betway',
    url: 'https://betway.com/?aff=XXXXXXXXXX',           // ← replace
    color: '#00a651',
    bonus: null,
  },
  '1xbet': {
    name: '1xBet',
    short: '1xBet',
    url: 'https://1xbet.com/?affiliateId=XXXXXXXXXX',    // ← replace
    color: '#1a5fb4',
    bonus: null,
  },
  williamhill: {
    name: 'William Hill',
    short: 'W. Hill',
    url: 'https://www.williamhill.com/?aff=XXXXXXXXXX',  // ← replace
    color: '#4a1a8c',
    bonus: null,
  },
}

/**
 * The primary bookmaker to show on prediction cards.
 * Change to whichever affiliate program you have confirmed & active.
 */
export const PRIMARY_AFFILIATE = AFFILIATES.bet365

/**
 * All affiliates shown on the bookmakers page (ordered by preference).
 */
export const AFFILIATE_LIST: BookmakerAffiliate[] = [
  AFFILIATES.bet365,
  AFFILIATES.unibet,
  AFFILIATES.betway,
  AFFILIATES['1xbet'],
  AFFILIATES.williamhill,
]
