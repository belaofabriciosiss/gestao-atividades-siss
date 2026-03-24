import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LocaisClient from './LocaisClient'

export const metadata = { title: 'Cadastro de Locais — SISS' }

export default async function LocaisPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('papel').eq('id', user.id).single()
  if (profile?.papel !== 'gestor') redirect('/atividades')
  return <LocaisClient />
}
