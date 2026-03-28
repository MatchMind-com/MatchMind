import { createClient } from '@/lib/supabase/server'
import SuggestionsPanel from '@/components/suggestions/SuggestionsPanel'

export default async function SuggestionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: bets } = await supabase.from('bet_slips').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
  return <SuggestionsPanel userId={user!.id} bets={bets || []} />
}
