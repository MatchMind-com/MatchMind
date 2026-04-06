import type { Metadata } from 'next'
import AuthForm from '@/components/auth/AuthForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Start Free — AI Betting Coach',
  description: 'Create your free BetIQ account. Get AI value bet predictions, track your betting performance, and access your personal football betting coach. No card needed.',
}

export default function SignupPage() {
  return <AuthForm defaultTab="signup" />
}
