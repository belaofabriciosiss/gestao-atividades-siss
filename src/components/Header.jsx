'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './Header.module.css'

export default function Header({ userName, userPapel }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>Gestão de Atividades SISS</h1>
      </div>
      <div className={styles.right}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className={styles.userDetails}>
            <span className={styles.userName}>{userName || 'Usuário'}</span>
            <span className={styles.userRole}>
              {userPapel === 'gestor' ? '⭐ Gestor' : '👤 Membro'}
            </span>
          </div>
        </div>
        <button className={`btn btn-ghost btn-sm ${styles.logoutBtn}`} onClick={handleLogout} title="Sair">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair
        </button>
      </div>
    </header>
  )
}
