'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/Modal'
import styles from './locais.module.css'

export default function LocaisClient() {
  const supabase = createClient()
  const [locais, setLocais] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchLocais = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('locais').select('*').order('nome')
    setLocais(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLocais() }, [fetchLocais])

  function openNew() { setEditing(null); setNome(''); setError(''); setModalOpen(true) }
  function openEdit(l) { setEditing(l); setNome(l.nome); setError(''); setModalOpen(true) }

  async function handleSave() {
    if (!nome.trim()) { setError('Informe o nome do local.'); return }
    setSaving(true); setError('')
    try {
      if (editing) {
        const { error: e } = await supabase.from('locais').update({ nome: nome.trim() }).eq('id', editing.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('locais').insert({ nome: nome.trim() })
        if (e) throw e
      }
      setModalOpen(false)
      await fetchLocais()
    } catch { setError('Erro ao salvar.') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    await supabase.from('locais').delete().eq('id', id)
    setDeleteConfirm(null)
    await fetchLocais()
  }

  const filtered = locais.filter(l => l.nome.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Cadastro de Locais</h1>
          <p>{locais.length} local{locais.length !== 1 ? 'is' : ''} cadastrado{locais.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Local
        </button>
      </div>

      {/* Search */}
      <div className={`card ${styles.searchCard}`}>
        <div className="form-group" style={{maxWidth:'360px'}}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" className={`form-control ${styles.searchInput}`} placeholder="Buscar local..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📍</div>
          <h3>{search ? 'Nenhum local encontrado' : 'Nenhum local cadastrado'}</h3>
          <p>{search ? 'Tente outro termo de busca.' : 'Clique em "Novo Local" para adicionar.'}</p>
        </div>
      ) : (
        <div className={styles.locaisGrid}>
          {filtered.map(l => (
            <div key={l.id} className={`card ${styles.localCard}`}>
              <div className={styles.localIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div className={styles.localInfo}>
                <span className="fw-600">{l.nome}</span>
                <span className="text-xs text-muted">Cadastrado em {new Date(l.criado_em).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className={styles.localActions}>
                <button className="btn-icon" onClick={() => openEdit(l)} title="Editar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="btn-icon" style={{color:'var(--color-danger)'}} onClick={() => setDeleteConfirm(l)} title="Excluir">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Local' : 'Novo Local'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </>
        }
      >
        {error && <div className="alert alert-error" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="form-group">
          <label className="form-label">Nome do Local *</label>
          <input type="text" className="form-control" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Hospital Municipal Centro" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }} />
        </div>
      </Modal>

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar exclusão"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.id)}>Excluir</button>
          </>
        }
      >
        <p>Tem certeza que deseja excluir o local <strong>{deleteConfirm?.nome}</strong>?</p>
        <p className="text-sm text-muted" style={{marginTop:'0.5rem'}}>Atividades vinculadas a este local podem ser afetadas.</p>
      </Modal>
    </div>
  )
}
