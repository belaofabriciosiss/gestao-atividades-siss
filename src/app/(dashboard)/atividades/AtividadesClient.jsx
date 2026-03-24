'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Modal from '@/components/Modal'
import StatusBadge from '@/components/StatusBadge'
import styles from './atividades.module.css'

const STATUS_OPTIONS = ['Pendente', 'Finalizado', 'Cancelado']

function fmt(dateStr) {
  if (!dateStr) return '—'
  try { return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR }) }
  catch { return dateStr }
}

export default function AtividadesPage({ userPapel, userId }) {
  const supabase = createClient()

  const [atividades, setAtividades] = useState([])
  const [locais, setLocais] = useState([])
  const [responsaveis, setResponsaveis] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroLocal, setFiltroLocal] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: at }, { data: lc }, { data: rs }] = await Promise.all([
      supabase.from('atividades').select(`
        *,
        locais(nome),
        atividade_responsaveis(responsavel_id, profiles(id, nome))
      `).order('planejado_dt_inicio', { ascending: true }),
      supabase.from('locais').select('id, nome').order('nome'),
      supabase.from('profiles').select('id, nome').eq('ativo', true).order('nome'),
    ])
    setAtividades(at || [])
    setLocais(lc || [])
    setResponsaveis(rs || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Verificar se usuário é responsável pela atividade
  function isResponsavel(atividade) {
    return atividade.atividade_responsaveis?.some(r => r.responsavel_id === userId)
  }

  // Permissão de editar
  function canEdit(atividade) {
    if (userPapel === 'gestor') return true
    return isResponsavel(atividade)
  }

  // Filtrar atividades
  const filtered = atividades.filter(at => {
    const respIds = at.atividade_responsaveis?.map(r => r.responsavel_id) || []
    if (filtroLocal && at.local_id !== filtroLocal) return false
    if (filtroResp && !respIds.includes(filtroResp)) return false
    if (filtroStatus && at.status !== filtroStatus) return false
    if (filtroDataInicio && at.planejado_dt_inicio < filtroDataInicio) return false
    if (filtroDataFim && at.planejado_dt_fim > filtroDataFim) return false
    return true
  })

  function openEdit(atividade) {
    setSelected(atividade)
    setForm({
      executado_dt_inicio: atividade.executado_dt_inicio || '',
      executado_dt_fim: atividade.executado_dt_fim || '',
      objetivo: atividade.objetivo || '',
      status: atividade.status || 'Pendente',
      observacao: atividade.observacao || '',
      // Campos gestor
      local_id: atividade.local_id || '',
      planejado_dt_inicio: atividade.planejado_dt_inicio || '',
      planejado_dt_fim: atividade.planejado_dt_fim || '',
      responsavel_ids: atividade.atividade_responsaveis?.map(r => r.responsavel_id) || [],
    })
    setSaveError('')
    setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      const update = {
        executado_dt_inicio: form.executado_dt_inicio || null,
        executado_dt_fim: form.executado_dt_fim || null,
        objetivo: form.objetivo || null,
        status: form.status,
        observacao: form.observacao || null,
        atualizado_em: new Date().toISOString(),
      }
      if (userPapel === 'gestor') {
        update.local_id = form.local_id
        update.planejado_dt_inicio = form.planejado_dt_inicio
        update.planejado_dt_fim = form.planejado_dt_fim
      }

      const { error: upErr } = await supabase
        .from('atividades')
        .update(update)
        .eq('id', selected.id)

      if (upErr) throw upErr

      // Gestor: atualiza responsáveis
      if (userPapel === 'gestor') {
        await supabase.from('atividade_responsaveis').delete().eq('atividade_id', selected.id)
        if (form.responsavel_ids.length > 0) {
          await supabase.from('atividade_responsaveis').insert(
            form.responsavel_ids.map(rid => ({ atividade_id: selected.id, responsavel_id: rid }))
          )
        }
      }

      setModalOpen(false)
      await fetchData()
    } catch (e) {
      setSaveError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function handleRespToggle(id) {
    setForm(f => ({
      ...f,
      responsavel_ids: f.responsavel_ids.includes(id)
        ? f.responsavel_ids.filter(r => r !== id)
        : [...f.responsavel_ids, id]
    }))
  }

  if (loading) return (
    <div className="loading-center"><div className="spinner" /></div>
  )

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Gestão de Atividades</h1>
          <p>{filtered.length} atividade{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className={`card ${styles.filterCard}`}>
        <div className="filter-bar">
          <div className="form-group">
            <label className="form-label">Local</label>
            <select className="form-control" value={filtroLocal} onChange={e => setFiltroLocal(e.target.value)}>
              <option value="">Todos os locais</option>
              {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Responsável</label>
            <select className="form-control" value={filtroResp} onChange={e => setFiltroResp(e.target.value)}>
              <option value="">Todos</option>
              {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Data início (de)</label>
            <input type="date" className="form-control" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Data início (até)</label>
            <input type="date" className="form-control" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
          </div>
          {(filtroLocal || filtroResp || filtroStatus || filtroDataInicio || filtroDataFim) && (
            <button className="btn btn-ghost btn-sm" style={{alignSelf:'flex-end'}}
              onClick={() => { setFiltroLocal(''); setFiltroResp(''); setFiltroStatus(''); setFiltroDataInicio(''); setFiltroDataFim('') }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>Nenhuma atividade encontrada</h3>
          <p>Ajuste os filtros ou aguarde o gestor incluir atividades.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`table-wrapper ${styles.tableDesktop}`}>
            <table>
              <thead>
                <tr>
                  <th>Local</th>
                  <th>Responsáveis</th>
                  <th>Plan. Início</th>
                  <th>Plan. Fim</th>
                  <th>Exec. Início</th>
                  <th>Exec. Fim</th>
                  <th>Status</th>
                  <th>Objetivo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(at => (
                  <tr key={at.id}>
                    <td className="fw-600">{at.locais?.nome || '—'}</td>
                    <td>
                      <div className={styles.chips}>
                        {at.atividade_responsaveis?.map(r => (
                          <span key={r.responsavel_id} className="chip">{r.profiles?.nome}</span>
                        ))}
                      </div>
                    </td>
                    <td className="text-sm">{fmt(at.planejado_dt_inicio)}</td>
                    <td className="text-sm">{fmt(at.planejado_dt_fim)}</td>
                    <td className="text-sm">{fmt(at.executado_dt_inicio)}</td>
                    <td className="text-sm">{fmt(at.executado_dt_fim)}</td>
                    <td><StatusBadge status={at.status} /></td>
                    <td className={styles.objetivoCell}>
                      <span title={at.objetivo}>{at.objetivo ? at.objetivo.substring(0, 40) + (at.objetivo.length > 40 ? '...' : '') : '—'}</span>
                    </td>
                    <td>
                      {canEdit(at) && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(at)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className={styles.mobileCards}>
            {filtered.map(at => (
              <div key={at.id} className={`card ${styles.mobileCard}`}>
                <div className="flex-between" style={{marginBottom:'0.75rem'}}>
                  <span className="fw-600 text-primary">{at.locais?.nome || '—'}</span>
                  <StatusBadge status={at.status} />
                </div>
                <div className={styles.mobileChips}>
                  {at.atividade_responsaveis?.map(r => <span key={r.responsavel_id} className="chip">{r.profiles?.nome}</span>)}
                </div>
                <div className={styles.mobileInfo}>
                  <div><span className="text-xs text-muted">Plan. Início</span><br/><span className="text-sm">{fmt(at.planejado_dt_inicio)}</span></div>
                  <div><span className="text-xs text-muted">Plan. Fim</span><br/><span className="text-sm">{fmt(at.planejado_dt_fim)}</span></div>
                  <div><span className="text-xs text-muted">Exec. Início</span><br/><span className="text-sm">{fmt(at.executado_dt_inicio)}</span></div>
                  <div><span className="text-xs text-muted">Exec. Fim</span><br/><span className="text-sm">{fmt(at.executado_dt_fim)}</span></div>
                </div>
                {at.objetivo && <p className={`text-sm text-secondary ${styles.mobileObjetivo}`}>{at.objetivo}</p>}
                {canEdit(at) && (
                  <button className="btn btn-secondary btn-sm" style={{marginTop:'0.75rem', width:'100%', justifyContent:'center'}} onClick={() => openEdit(at)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de Edição */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Editar Atividade — ${selected?.locais?.nome || ''}`}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {saveError && <div className="alert alert-error" style={{marginBottom:'1rem'}}>{saveError}</div>}

        {/* Campos gestor */}
        {userPapel === 'gestor' && (
          <>
            <div className="form-grid form-grid-2" style={{marginBottom:'1rem'}}>
              <div className="form-group">
                <label className="form-label">Local</label>
                <select className="form-control" value={form.local_id} onChange={e => setForm(f => ({...f, local_id: e.target.value}))}>
                  <option value="">Selecione</option>
                  {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Plan. Início</label>
                <input type="date" className="form-control" value={form.planejado_dt_inicio} onChange={e => setForm(f => ({...f, planejado_dt_inicio: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Plan. Fim</label>
                <input type="date" className="form-control" value={form.planejado_dt_fim} onChange={e => setForm(f => ({...f, planejado_dt_fim: e.target.value}))} />
              </div>
            </div>
            <div className="form-group" style={{marginBottom:'1rem'}}>
              <label className="form-label">Responsáveis</label>
              <div className={styles.respCheckboxes}>
                {responsaveis.map(r => (
                  <label key={r.id} className={styles.respCheckbox}>
                    <input type="checkbox" checked={form.responsavel_ids?.includes(r.id)} onChange={() => handleRespToggle(r.id)} />
                    <span>{r.nome}</span>
                  </label>
                ))}
              </div>
            </div>
            <hr style={{borderColor:'var(--color-border-light)', margin:'1.25rem 0'}} />
          </>
        )}

        {/* Campos de execução (todos com permissão) */}
        <div className="form-grid form-grid-2" style={{marginBottom:'1rem'}}>
          <div className="form-group">
            <label className="form-label">Exec. Início</label>
            <input type="date" className="form-control" value={form.executado_dt_inicio} onChange={e => setForm(f => ({...f, executado_dt_inicio: e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Exec. Fim</label>
            <input type="date" className="form-control" value={form.executado_dt_fim} onChange={e => setForm(f => ({...f, executado_dt_fim: e.target.value}))} />
          </div>
        </div>

        {userPapel === 'membro' && (
          <div className="form-group" style={{marginBottom:'1rem'}}>
            <label className="form-label">Status</label>
            <select className="form-control" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="form-group" style={{marginBottom:'1rem'}}>
          <label className="form-label">Objetivo</label>
          <textarea className="form-control" rows={3} value={form.objetivo} onChange={e => setForm(f => ({...f, objetivo: e.target.value}))} placeholder="Descreva o objetivo da atividade..." />
        </div>
        <div className="form-group">
          <label className="form-label">Observação</label>
          <textarea className="form-control" rows={3} value={form.observacao} onChange={e => setForm(f => ({...f, observacao: e.target.value}))} placeholder="Observações adicionais..." />
        </div>

        {/* Campos bloqueados para membro (visualização) */}
        {userPapel === 'membro' && selected && (
          <div className={styles.readonlyInfo}>
            <p className="text-xs text-muted" style={{marginBottom:'0.5rem'}}>Campos somente leitura (gerenciados pelo gestor)</p>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label">Local</label>
                <input className="form-control" value={selected.locais?.nome || ''} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Plan. Início</label>
                <input className="form-control" value={fmt(selected.planejado_dt_inicio)} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Plan. Fim</label>
                <input className="form-control" value={fmt(selected.planejado_dt_fim)} disabled />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
