import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ResponsaveisClient from './ResponsaveisClient'

export const metadata = { title: 'Cadastro de Responsáveis — SISS' }

export default async function ResponsaveisPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('papel').eq('id', user.id).single()
  if (profile?.papel !== 'gestor') redirect('/atividades')
  return <ResponsaveisClient />
}
