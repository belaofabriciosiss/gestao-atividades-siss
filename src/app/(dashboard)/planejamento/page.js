import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanejamentoClient from './PlanejamentoClient'

export const metadata = { title: 'Planejamento — SISS' }

export default async function PlanejamentoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('papel').eq('id', user.id).single()
  if (profile?.papel !== 'gestor') redirect('/atividades')

  return <PlanejamentoClient />
}
