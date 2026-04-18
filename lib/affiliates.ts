/**
 * MatchMind Affiliate Configuration
 * ─────────────────────────────────
 * Current state: placeholder URLs point to each bookmaker's homepage with
 * NO affiliate tracking ID (Kemal is in Turkey and hasn't signed up for the
 * UK-based affiliate programs yet). Links work for users; MatchMind earns
 * nothing on the click until real affiliate URLs are dropped in.
 *
 * To enable monetization, replace the `url` field with your tracking link:
 *   Bet365        → affiliates.bet365.com  (requires UK entity / address)
 *   Unibet        → unibetpartners.com
 *   Betway        → betwaypartners.com
 *   1xBet         → 1xbet-partners.com     (accepts most geos)
 *   William Hill  → williamhillaffiliates.com
 *
 * Workaround options for the Turkey blocker:
 *   1. Use 1xBet — their affiliate program accepts Turkish registrants
 *   2. Set up a UK Ltd via Osome / Coddan (£100, 1 week) — unlocks everything
 *   3. Ask Alp or a UK friend to sign up as the affiliate and revenue-share
 */

export interface BookmakerAffiliate {
  name: string
  short: string
  url: string
  color: string
  bonus: string | null
  /** true once a real affiliate ID is wired in */
  monetized: boolean
}

export const AFFILIATES: Record<string, BookmakerAffiliate> = {
  bet365: {
    name: 'Bet365',
    short: 'Bet365',
    url: 'https://www.bet365.com',
    color: '#1d7a3c',
    bonus: 'New customer offer',
    monetized: false,
  },
  unibet: {
    name: 'Unibet',
    short: 'Unibet',
    url: 'https://www.unibet.com',
    color: '#147b45',
    bonus: null,
    monetized: false,
  },
  betway: {
    name: 'Betway',
    short: 'Betway',
    url: 'https://betway.com',
    color: '#00a651',
    bonus: null,
    monetized: false,
  },
  '1xbet': {
    name: '1xBet',
    short: '1xBet',
    url: 'https://1xbet.com',
    color: '#1a5fb4',
    bonus: null,
    monetized: false,
  },
  williamhill: {
    name: 'William Hill',
    short: 'W. Hill',
    url: 'https://www.williamhill.com',
    color: '#4a1a8c',
    bonus: null,
    monetized: false,
  },
}

export const PRIMARY_AFFILIATE = AFFILIATES.bet365

export const AFFILIATE_LIST: BookmakerAffiliate[] = [
  AFFILIATES.bet365,
  AFFILIATES.unibet,
  AFFILIATES.betway,
  AFFILIATES['1xbet'],
  AFFILIATES.williamhill,
]
