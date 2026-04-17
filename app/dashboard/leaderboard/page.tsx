import { redirect } from 'next/navigation'

// Leaderboard hidden until 50+ users — see launch plan
export default function Page() {
  redirect('/dashboard')
}
