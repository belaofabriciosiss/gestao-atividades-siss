'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay, isSameDay, isWeekend } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Modal from '@/components/Modal'
import StatusBadge from '@/components/StatusBadge'
import styles from './planejamento.module.css'

const STATUS_OPTIONS = ['Pendente', 'Finalizado', 'Cancelado']

function fmt(d) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }) }
  catch { return d }
}

function emptyForm() {
  return {
    local_id: '', responsavel_ids: [],
    planejado_dt_inicio: '', planejado_dt_fim: '',
    executado_dt_inicio: '', executado_dt_fim: '',
    objetivo: '', status: 'Pendente', observacao: '',
    ocorre_fds: false,
  }
}

export default function PlanejamentoClient() {
  const supabase = createClient()
  const [tab, setTab] = useState('lista')
  const [atividades, setAtividades] = useState([])
  const [locais, setLocais] = useState([])
  const [responsaveis, setResponsaveis] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [calMonth, setCalMonth] = useState(new Date())

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: at }, { data: lc }, { data: rs }] = await Promise.all([
      supabase.from('atividades').select(`*, locais(nome), atividade_responsaveis(responsavel_id, profiles(id,nome))`).order('planejado_dt_inicio', { ascending: true }),
      supabase.from('locais').select('id,nome').order('nome'),
      supabase.from('profiles').select('id,nome').eq('ativo', true).order('nome'),
    ])
    setAtividades(at || [])
    setLocais(lc || [])
    setResponsaveis(rs || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setSaveError('')
    setModalOpen(true)
  }

  function openEdit(at) {
    setEditing(at)
    setForm({
      local_id: at.local_id || '',
      responsavel_ids: at.atividade_responsaveis?.map(r => r.responsavel_id) || [],
      planejado_dt_inicio: at.planejado_dt_inicio || '',
      planejado_dt_fim: at.planejado_dt_fim || '',
      executado_dt_inicio: at.executado_dt_inicio || '',
      executado_dt_fim: at.executado_dt_fim || '',
      objetivo: at.objetivo || '',
      status: at.status || 'Pendente',
      observacao: at.observacao || '',
      ocorre_fds: at.ocorre_fds || false,
    })
    setSaveError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.local_id || !form.planejado_dt_inicio || !form.planejado_dt_fim) {
      setSaveError('Preencha Local, Data Início e Data Fim planejados.')
      return
    }
    setSaving(true); setSaveError('')
    try {
      const payload = {
        local_id: form.local_id,
        planejado_dt_inicio: form.planejado_dt_inicio,
        planejado_dt_fim: form.planejado_dt_fim,
        executado_dt_inicio: form.executado_dt_inicio || null,
        executado_dt_fim: form.executado_dt_fim || null,
        objetivo: form.objetivo || null,
        status: form.status,
        observacao: form.observacao || null,
        ocorre_fds: form.ocorre_fds,
        atualizado_em: new Date().toISOString(),
      }
      let atId = editing?.id
      if (editing) {
        const { error } = await supabase.from('atividades').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('atividades').insert(payload).select().single()
        if (error) throw error
        atId = data.id
      }
      // Responsáveis
      await supabase.from('atividade_responsaveis').delete().eq('atividade_id', atId)
      if (form.responsavel_ids.length > 0) {
        await supabase.from('atividade_responsaveis').insert(
          form.responsavel_ids.map(rid => ({ atividade_id: atId, responsavel_id: rid }))
        )
      }
      setModalOpen(false)
      await fetchData()
    } catch { setSaveError('Erro ao salvar. Verifique os dados e tente novamente.') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    await supabase.from('atividades').delete().eq('id', id)
    setDeleteConfirm(null)
    await fetchData()
  }

  function toggleResp(id) {
    setForm(f => ({
      ...f,
      responsavel_ids: f.responsavel_ids.includes(id)
        ? f.responsavel_ids.filter(r => r !== id)
        : [...f.responsavel_ids, id]
    }))
  }

  // Calendário
  const calDays = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) })
  const firstDow = getDay(startOfMonth(calMonth))
  function atsByDay(day) {
    return atividades.filter(at => {
      if (!at.planejado_dt_inicio || !at.planejado_dt_fim) return false
      try {
        const start = parseISO(at.planejado_dt_inicio)
        const end = parseISO(at.planejado_dt_fim)
        if (day < start || day > end) return false
        if (isWeekend(day) && !at.ocorre_fds) return false
        return true
      } catch { return false }
    })
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Planejamento</h1>
          <p>Gerencie as atividades planejadas da equipe</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova Atividade
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'lista' ? 'active' : ''}`} onClick={() => setTab('lista')}>
          📋 Lista
        </button>
        <button className={`tab-btn ${tab === 'calendario' ? 'active' : ''}`} onClick={() => setTab('calendario')}>
          📅 Calendário
        </button>
      </div>

      {/* Lista */}
      {tab === 'lista' && (
        atividades.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>Nenhuma atividade planejada</h3>
            <p>Clique em "Nova Atividade" para começar.</p>
          </div>
        ) : (
          <>
            <div className={`table-wrapper ${styles.tableDesktop}`}>
              <table>
                <thead>
                  <tr>
                    <th>Local</th>
                    <th>Responsáveis</th>
                    <th>Plan. Início</th>
                    <th>Plan. Fim</th>
                    <th>Status</th>
                    <th>Objetivo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {atividades.map(at => (
                    <tr key={at.id}>
                      <td className="fw-600">{at.locais?.nome || '—'}</td>
                      <td>
                        <div style={{display:'flex',flexWrap:'wrap',gap:'0.3rem'}}>
                          {at.atividade_responsaveis?.map(r => <span key={r.responsavel_id} className="chip">{r.profiles?.nome}</span>)}
                        </div>
                      </td>
                      <td className="text-sm">{fmt(at.planejado_dt_inicio)}</td>
                      <td className="text-sm">{fmt(at.planejado_dt_fim)}</td>
                      <td><StatusBadge status={at.status} /></td>
                      <td className="text-sm text-secondary">{at.objetivo ? at.objetivo.substring(0,50)+'...' : '—'}</td>
                      <td>
                        <div style={{display:'flex',gap:'0.5rem'}}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(at)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(at)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className={styles.mobileCards}>
              {atividades.map(at => (
                <div key={at.id} className="card" style={{padding:'1rem'}}>
                  <div className="flex-between" style={{marginBottom:'0.6rem'}}>
                    <span className="fw-600 text-primary">{at.locais?.nome}</span>
                    <StatusBadge status={at.status} />
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'0.3rem',marginBottom:'0.6rem'}}>
                    {at.atividade_responsaveis?.map(r => <span key={r.responsavel_id} className="chip">{r.profiles?.nome}</span>)}
                  </div>
                  <p className="text-xs text-muted">{fmt(at.planejado_dt_inicio)} → {fmt(at.planejado_dt_fim)}</p>
                  <div style={{display:'flex',gap:'0.5rem',marginTop:'0.75rem'}}>
                    <button className="btn btn-secondary btn-sm" style={{flex:1,justifyContent:'center'}} onClick={() => openEdit(at)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(at)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {/* Calendário */}
      {tab === 'calendario' && (
        <div className={`card ${styles.calendarCard}`}>
          <div className={styles.calHeader}>
            <button className="btn-icon" onClick={() => setCalMonth(m => subMonths(m, 1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h2 className={styles.calTitle}>
              {format(calMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <button className="btn-icon" onClick={() => setCalMonth(m => addMonths(m, 1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div className={styles.calGrid}>
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
              <div key={d} className={styles.calDowHeader}>{d}</div>
            ))}
            {Array.from({length: firstDow}).map((_, i) => <div key={`e${i}`} />)}
            {calDays.map(day => {
              const dayAts = atsByDay(day)
              const today = isSameDay(day, new Date())
              return (
                <div key={day.toISOString()} className={`${styles.calDay} ${today ? styles.today : ''}`}>
                  <span className={styles.calDayNum}>{format(day, 'd')}</span>
                  <div className={styles.calDayAts}>
                    {dayAts.slice(0,3).map(at => (
                      <div key={at.id} className={`${styles.calChip} ${styles['calChip_'+at.status?.toLowerCase()]}`}
                        onClick={() => openEdit(at)} title={at.locais?.nome}>
                        {at.locais?.nome?.substring(0,15)}
                      </div>
                    ))}
                    {dayAts.length > 3 && <div className={styles.calMore}>+{dayAts.length-3}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal Criar/Editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar — ${editing.locais?.nome || 'Atividade'}` : 'Nova Atividade'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar atividade'}
            </button>
          </>
        }
      >
        {saveError && <div className="alert alert-error" style={{marginBottom:'1rem'}}>{saveError}</div>}
        <div className="form-grid" style={{gap:'1rem'}}>
          <div className="form-group">
            <label className="form-label">Local *</label>
            <select className="form-control" value={form.local_id} onChange={e => setForm(f=>({...f,local_id:e.target.value}))}>
              <option value="">Selecione o local</option>
              {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Responsáveis</label>
            <div className={styles.respCheckboxes}>
              {responsaveis.map(r => (
                <label key={r.id} className={styles.respCheckbox}>
                  <input type="checkbox" checked={form.responsavel_ids.includes(r.id)} onChange={() => toggleResp(r.id)} />
                  <span>{r.nome}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Plan. Início *</label>
              <input type="date" className="form-control" value={form.planejado_dt_inicio} onChange={e => setForm(f=>({...f,planejado_dt_inicio:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Plan. Fim *</label>
              <input type="date" className="form-control" value={form.planejado_dt_fim} onChange={e => setForm(f=>({...f,planejado_dt_fim:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Exec. Início</label>
              <input type="date" className="form-control" value={form.executado_dt_inicio} onChange={e => setForm(f=>({...f,executado_dt_inicio:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Exec. Fim</label>
              <input type="date" className="form-control" value={form.executado_dt_fim} onChange={e => setForm(f=>({...f,executado_dt_fim:e.target.value}))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal', fontWeight: '500' }}>
              <input type="checkbox" checked={form.ocorre_fds} onChange={e => setForm(f=>({...f,ocorre_fds:e.target.checked}))} style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px', margin: 0 }} />
              A atividade ocorrerá também em fins de semana
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Objetivo</label>
            <textarea className="form-control" value={form.objetivo} onChange={e => setForm(f=>({...f,objetivo:e.target.value}))} placeholder="Descreva o objetivo..." rows={3} />
          </div>
          <div className="form-group">
            <label className="form-label">Observação</label>
            <textarea className="form-control" value={form.observacao} onChange={e => setForm(f=>({...f,observacao:e.target.value}))} placeholder="Observações..." rows={2} />
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar Delete */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmar exclusão"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.id)}>Excluir</button>
          </>
        }
      >
        <p>Tem certeza que deseja excluir a atividade <strong>{deleteConfirm?.locais?.nome}</strong>? Esta ação não pode ser desfeita.</p>
      </Modal>
    </div>
  )
}
