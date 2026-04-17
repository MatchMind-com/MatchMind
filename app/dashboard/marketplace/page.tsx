import { redirect } from 'next/navigation'

// Tipster Marketplace hidden until supply exists — Phase 2
export default function Page() {
  redirect('/dashboard')
}
