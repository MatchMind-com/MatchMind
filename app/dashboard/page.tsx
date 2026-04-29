import { createClient } from '@/lib/supabase/server'
import HomeView from '@/components/home/HomeView'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // First name: prefer the local part of the email, capitalised.
  // Stripping anything after a dot/underscore/digit gives "kemal" from
  // "kemal.dede@…" or "kemal_dede@…" — gentler than raw `kemal.dede`.
  const localPart = (user?.email ?? 'there').split('@')[0]
  const cleaned = localPart.split(/[._\d]/)[0] || localPart
  const firstName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)

  return <HomeView firstName={firstName} />
}
