import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AtividadesClient from './AtividadesClient'

export const metadata = { title: 'Gestão de Atividades — SISS' }

export default async function AtividadesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .single()

  return <AtividadesClient userPapel={profile?.papel || 'membro'} userId={user.id} />
}
