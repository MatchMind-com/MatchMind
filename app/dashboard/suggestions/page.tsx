import { redirect } from 'next/navigation'

// AI Suggestions hidden until user betting history exists — Month 2-3
export default function Page() {
  redirect('/dashboard')
}
