'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/Modal'
import styles from './responsaveis.module.css'

export default function ResponsaveisClient() {
  const supabase = createClient()
  const [membros, setMembros] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nome: '', email: '', papel: 'membro', senha: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchMembros = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('nome')
    setMembros(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMembros() }, [fetchMembros])

  function openNew() {
    setEditing(null)
    setForm({ nome: '', email: '', papel: 'membro', senha: '' })
    setError(''); setSuccess('')
    setModalOpen(true)
  }
  function openEdit(m) {
    setEditing(m)
    setForm({ nome: m.nome, email: m.email, papel: m.papel, senha: '' })
    setError(''); setSuccess('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.email.trim()) { setError('Nome e e-mail são obrigatórios.'); return }
    setSaving(true); setError('')
    try {
      if (editing) {
        // Editar perfil existente
        const { error: e } = await supabase.from('profiles')
          .update({ nome: form.nome.trim(), papel: form.papel })
          .eq('id', editing.id)
        if (e) throw e
        setSuccess('Membro atualizado com sucesso!')
      } else {
        // Criar novo usuário (via admin API — precisa de service_role em produção)
        // Por enquanto, inserimos o perfil e orientamos a criação via Supabase Auth
        const { data, error: signupErr } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.senha || 'Siss@2025!',
          options: { data: { nome: form.nome.trim() } }
        })
        if (signupErr) throw signupErr

        if (data.user) {
          const { error: profileErr } = await supabase.from('profiles').upsert({
            id: data.user.id,
            nome: form.nome.trim(),
            email: form.email.trim(),
            papel: form.papel,
            ativo: true,
          })
          if (profileErr) throw profileErr
        }
        setSuccess(`Membro criado! Senha temporária: "${form.senha || 'Siss@2025!'}". Oriente o membro a alterá-la.`)
      }
      await fetchMembros()
      if (!editing) { setForm({ nome: '', email: '', papel: 'membro', senha: '' }) }
    } catch (e) {
      setError(e.message || 'Erro ao salvar. Verifique os dados.')
    } finally { setSaving(false) }
  }

  async function toggleAtivo(membro) {
    await supabase.from('profiles').update({ ativo: !membro.ativo }).eq('id', membro.id)
    await fetchMembros()
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Cadastro de Responsáveis</h1>
          <p>{membros.length} membro{membros.length !== 1 ? 's' : ''} cadastrado{membros.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Membro
        </button>
      </div>

      <div className={styles.membrosGrid}>
        {membros.map(m => (
          <div key={m.id} className={`card ${styles.membroCard} ${!m.ativo ? styles.inativo : ''}`}>
            <div className={styles.membroAvatar}>
              {m.nome.charAt(0).toUpperCase()}
            </div>
            <div className={styles.membroInfo}>
              <span className="fw-600">{m.nome}</span>
              <span className="text-sm text-muted">{m.email}</span>
              <div className={styles.membroMeta}>
                <span className={`badge ${m.papel === 'gestor' ? 'badge-finalizado' : 'badge-pendente'}`}>
                  {m.papel === 'gestor' ? '⭐ Gestor' : '👤 Membro'}
                </span>
                {!m.ativo && <span className="badge badge-cancelado">Inativo</span>}
              </div>
            </div>
            <div className={styles.membroActions}>
              <button className="btn-icon" onClick={() => openEdit(m)} title="Editar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button
                className={`btn-icon ${m.ativo ? '' : styles.ativoBtn}`}
                onClick={() => toggleAtivo(m)}
                title={m.ativo ? 'Desativar' : 'Ativar'}
                style={{color: m.ativo ? 'var(--color-danger)' : 'var(--color-status-finalizado)'}}
              >
                {m.ativo
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                }
              </button>
            </div>
          </div>
        ))}
      </div>

      {membros.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <h3>Nenhum membro cadastrado</h3>
          <p>Clique em "Novo Membro" para adicionar.</p>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Membro' : 'Novo Membro'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Fechar</button>
            {!success && <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>}
          </>
        }
      >
        {error && <div className="alert alert-error" style={{marginBottom:'1rem'}}>{error}</div>}
        {success && <div className="alert alert-success" style={{marginBottom:'1rem'}}>{success}</div>}
        <div className="form-grid" style={{gap:'1rem'}}>
          <div className="form-group">
            <label className="form-label">Nome completo *</label>
            <input type="text" className="form-control" value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome do membro" />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail *</label>
            <input type="email" className="form-control" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="email@exemplo.com" disabled={!!editing} />
            {editing && <span className="text-xs text-muted" style={{marginTop:'0.25rem'}}>E-mail não pode ser alterado após criação.</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Papel / Nível de acesso</label>
            <select className="form-control" value={form.papel} onChange={e => setForm(f=>({...f,papel:e.target.value}))}>
              <option value="membro">👤 Membro</option>
              <option value="gestor">⭐ Gestor</option>
            </select>
          </div>
          {!editing && (
            <div className="form-group">
              <label className="form-label">Senha temporária</label>
              <input type="text" className="form-control" value={form.senha} onChange={e => setForm(f=>({...f,senha:e.target.value}))} placeholder="Deixe em branco para usar padrão: Siss@2025!" />
              <span className="text-xs text-muted" style={{marginTop:'0.25rem'}}>O membro deverá alterar após o primeiro acesso.</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
