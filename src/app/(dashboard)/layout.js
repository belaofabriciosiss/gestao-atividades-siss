import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import styles from './DashboardLayout.module.css'

export default async function DashboardLayout({ children }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, papel')
    .eq('id', user.id)
    .single()

  return (
    <div className={styles.layout}>
      <Sidebar userPapel={profile?.papel || 'membro'} />
      <div className={styles.mainContent}>
        <Header userName={profile?.nome} userPapel={profile?.papel} />
        <main className={styles.pageWrapper}>
          {children}
        </main>
      </div>
    </div>
  )
}
