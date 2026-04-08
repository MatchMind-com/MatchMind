/**
 * Trial utility — 7-day full Pro access for new users, no Stripe needed.
 * Reads profiles.created_at and computes trial status client-side.
 */

export function getTrialInfo(createdAt: string | null | undefined): {
  isActive: boolean
  daysLeft: number
  expiresAt: Date | null
} {
  if (!createdAt) return { isActive: false, daysLeft: 0, expiresAt: null }
  const created = new Date(createdAt)
  const expiresAt = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000)
  const now = new Date()
  const msLeft = expiresAt.getTime() - now.getTime()
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
  return {
    isActive: now < expiresAt,
    daysLeft,
    expiresAt,
  }
}

/** Returns 'pro' if trial active, otherwise returns the stored tier */
export function effectiveTier(
  storedTier: string | null | undefined,
  createdAt: string | null | undefined
): 'free' | 'pro' | 'elite' {
  const stored = (storedTier || 'free') as 'free' | 'pro' | 'elite'
  if (stored === 'pro' || stored === 'elite') return stored
  const { isActive } = getTrialInfo(createdAt)
  return isActive ? 'pro' : 'free'
}
