import { createClient } from '@/lib/supabase/server'
import CommandCenter from '@/components/home/CommandCenter'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: bets } = await supabase
    .from('bet_slips').select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(50)
  return <CommandCenter userId={user!.id} email={user!.email!} initialBets={bets || []} />
}
