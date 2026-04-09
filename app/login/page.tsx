import type { Metadata } from 'next'
import AuthForm from '@/components/auth/AuthForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your MatchMind account to track your bets, view AI value bet tips, and access your personal football betting coach.',
}

export default function LoginPage() {
  return <AuthForm defaultTab="login" />
}
