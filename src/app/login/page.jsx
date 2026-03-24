'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('E-mail ou senha inválidos. Verifique suas credenciais.')
      setLoading(false)
    } else {
      router.push('/atividades')
      router.refresh()
    }
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        {/* Logo / Branding */}
        <div className={styles.branding}>
          <div className={styles.logoWrap}>
            <img src="/logo.png" alt="SISS" className={styles.logo}
              onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
            <div className={styles.logoFallback} style={{display:'none'}}>
              <div className={styles.logoIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
              </div>
            </div>
          </div>
          <h1 className={styles.brandTitle}>Gestão de Atividades</h1>
          <p className={styles.brandSub}>SISS · Acesse sua conta para continuar</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className={styles.form}>
          {error && (
            <div className="alert alert-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              type="email"
              className="form-control"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Senha</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
            {loading ? (
              <>
                <div className={styles.btnSpinner} />
                Entrando...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Entrar
              </>
            )}
          </button>
        </form>

        <p className={styles.footer}>
          Problemas de acesso? Contate o gestor do sistema.
        </p>
      </div>

      {/* Background decoration */}
      <div className={styles.bgDecoration} />
    </div>
  )
}
