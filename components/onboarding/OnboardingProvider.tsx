'use client'

import { useEffect, useState } from 'react'
import OnboardingModal from './OnboardingModal'

export default function OnboardingProvider() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Check if user needs to complete onboarding
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(d => {
        if (!d.completed) {
          // Small delay so the dashboard renders first
          setTimeout(() => setShowOnboarding(true), 800)
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true))
  }, [])

  if (!checked) return null

  return (
    <OnboardingModal
      isOpen={showOnboarding}
      onComplete={() => setShowOnboarding(false)}
    />
  )
}
