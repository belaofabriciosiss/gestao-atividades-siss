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
  const [copied, setCopied] = useState(false)

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
      ocorre_fds: atividade.ocorre_fds || false,
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
        update.ocorre_fds = form.ocorre_fds
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

  function handleCopyWhatsApp() {
    if (!selected) return
    const responsaveis = selected.atividade_responsaveis?.map(r => r.profiles?.nome).filter(Boolean).join(', ') || '—'
    const local = selected.locais?.nome || '—'
    const objetivo = form.objetivo || '—'
    const observacao = form.observacao || ''
    const msg = `Responsável: ${responsaveis}\nLocal: ${local}\nObjetivo: ${objetivo}${observacao ? '\n\nObservações: ' + observacao : ''}`
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleGenerateRAT() {
    if (!selected) return
    const responsaveis = selected.atividade_responsaveis?.map(r => r.profiles?.nome).filter(Boolean).join(', ') || '—'
    const local = selected.locais?.nome || '—'
    const dtInicio = selected.executado_dt_inicio
      ? format(parseISO(selected.executado_dt_inicio), 'dd/MM/yyyy', { locale: ptBR })
      : '____ / ____ / ______'
    const dtFim = selected.executado_dt_fim
      ? format(parseISO(selected.executado_dt_fim), 'dd/MM/yyyy', { locale: ptBR })
      : '____ / ____ / ______'
    const descricao = form.objetivo || '—'
    const observacao = form.observacao || ''
    const versao = '2026/0323133234'

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title> </title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; background: #fff; padding: 15mm; }
  @page { size: A4; margin: 0; }
  @media print { body { padding: 10mm 15mm; } }


  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .logo-img { max-height: 70px; max-width: 150px; object-fit: contain; }
  .logo-text { border: 2px solid #222; padding: 4px 8px; display: inline-block; }
  .logo-gies { display: flex; }
  .logo-gi { font-size: 32px; font-weight: 900; color: #2b6496; letter-spacing: -2px; }
  .logo-espp { font-size: 32px; font-weight: 900; color: #e04a1c; letter-spacing: -2px; }
  .logo-sub { font-size: 6.5px; color: #444; margin-top: 2px; line-height: 1.3; max-width: 120px; }
  .report-title { font-size: 22px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; text-align: right; }
  .divider { border: none; border-top: 2px solid #222; margin: 6px 0 10px; }

  /* Main table */
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .info-table td { border: 1px solid #555; padding: 5px 7px; vertical-align: top; }
  .info-table .label { font-weight: bold; font-style: italic; white-space: nowrap; width: 130px; background: #c8d8e8; }
  .info-table .label-sm { font-weight: bold; font-style: italic; white-space: nowrap; width: 70px; background: #c8d8e8; }

  /* Activity section */
  .section-box { border: 1px solid #555; margin-bottom: 12px; }
  .section-header { background: #c8d8e8; padding: 0 8px; font-weight: bold; font-style: italic; font-size: 11px; }
  .section-header .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #8aaac0; }
  .section-header .sh-line { padding: 5px 0; border-bottom: 1px solid #8aaac0; }
  .section-header .sh-line:last-child { border-bottom: none; }
  .section-content { padding: 10px 8px; min-height: 200px; line-height: 1.8; white-space: pre-wrap; border-top: 1px solid #555; }

  /* Signature section */
  .sig-box { border: 1px solid #555; }
  .sig-header { background: #c8d8e8; padding: 6px 8px; font-style: italic; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; border-top: 1px solid #555; }
  .sig-cell { padding: 10px 10px 20px; font-size: 11px; }
  .sig-cell:not(:last-child) { border-right: 1px solid #555; }
  .sig-label { font-style: italic; margin-bottom: 28px; }
  .sig-value { border-top: 1px solid #333; padding-top: 4px; }
  .date-line { display: flex; gap: 4px; align-items: center; margin-top: 28px; }
  .date-line span { border-bottom: 1px solid #333; width: 50px; display: inline-block; }

  /* Footer — fixo no rodapé de cada página impressa */
  .footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    display: flex; justify-content: space-between;
    border-top: 1px solid #555; padding: 6px 15mm;
    font-size: 10px; color: #555; background: #fff;
  }
  /* Espaço extra no final do body para o conteúdo não ficar atrás do rodapé */
  body { padding-bottom: 20mm; }
</style>
</head>
<body>

<div class="header">
  <div>
    <img class="logo-img" src="${window.location.origin}/giespp-logo.png" alt="Giespp" 
      onerror="this.style.display='none';document.getElementById('logo-fb').style.display='inline-block'" />
    <div id="logo-fb" style="display:none" class="logo-text">
      <div class="logo-gies"><span class="logo-gi">GI</span><span class="logo-espp">espp</span></div>
      <div class="logo-sub">GESTÃO INTELIGENTE DA EDUCAÇÃO<br>E SAÚDE PÚBLICA E PRIVADA</div>
    </div>
  </div>
  <div class="report-title">Relatório de Atividades</div>
</div>
<hr class="divider">

<table class="info-table">
  <tr>
    <td class="label">Contratada:</td>
    <td>Giespp Gestão Inteligente de Educação e Saúde Pública e Privada Ltda.</td>
    <td class="label-sm">Produto:</td>
    <td style="width:90px">SISS</td>
  </tr>
  <tr>
    <td class="label">Contratante:</td>
    <td>Prefeitura Municipal de Guarulhos</td>
    <td class="label-sm">Contrato:</td>
    <td>040401/2023-DLC</td>
  </tr>
  <tr>
    <td class="label">Local:</td>
    <td colspan="3">${local}</td>
  </tr>
  <tr>
    <td class="label">Referente Entrega<br>Contratual:</td>
    <td colspan="3">    -6. SUPORTE, MANUTENÇÃO E OPERAÇÃO-Suporte e Manutenção-Siss</td>
  </tr>
  <tr>
    <td class="label">Responsável:</td>
    <td colspan="3">${responsaveis}</td>
  </tr>
</table>

<div class="section-box">
  <div class="section-header">
    <div class="row">
      <span><em>Data e Hora Início:</em> ${dtInicio}</span>
      <span><em>Data e Hora Fim:</em> ${dtFim}</span>
    </div>
    <div class="sh-line"><em>Tipo de Atividade:</em> Suporte Operacional</div>
    <div class="sh-line"><em>Descrição da Atividade:</em></div>
  </div>
  <div class="section-content">${descricao}${observacao ? '\n\n' + observacao : ''}</div>
</div>

<div class="sig-box">
  <div class="sig-header">Atesto que as atividades foram realizadas como descritas.</div>
  <div class="sig-grid">
    <div class="sig-cell">
      <div class="sig-label">Data:</div>
      <div class="date-line"><span></span> / <span></span> / <span style="width:70px"></span></div>
    </div>
    <div class="sig-cell">
      <div class="sig-label">Assinatura do Responsável:</div>
      <div class="sig-value">${responsaveis}</div>
    </div>
    <div class="sig-cell">
      <div class="sig-label">Assinatura do Cliente:</div>
      <div class="sig-value" style="font-style:italic;color:#555">
        Nome legível e cargo do cliente<br>Carimbo com assinatura e matrícula
      </div>
    </div>
  </div>
</div>

<div class="footer">
  <span>Versão do Conteúdo nº ${versao}</span>
  <span>Página 1 de 1</span>
</div>

</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
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
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal', fontWeight: '500' }}>
                <input type="checkbox" checked={form.ocorre_fds} onChange={e => setForm(f=>({...f,ocorre_fds:e.target.checked}))} style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px', margin: 0 }} />
                A atividade ocorrerá também em fins de semana
              </label>
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

        {/* Botões WhatsApp + RAT */}
        <div style={{display:'flex', justifyContent:'flex-end', marginTop:'0.5rem', gap:'0.5rem'}}>
          <button
            type="button"
            onClick={handleGenerateRAT}
            style={{
              display:'flex', alignItems:'center', gap:'0.5rem',
              padding:'0.5rem 1rem', borderRadius:'var(--radius-sm)',
              border:'none', cursor:'pointer', fontWeight:'600', fontSize:'0.875rem',
              background:'#1a56db', color:'white', transition:'all 0.2s'
            }}
            title="Gerar Relatório de Atividades (RAT)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Gerar RAT
          </button>
          <button
            type="button"
            onClick={handleCopyWhatsApp}
            style={{
              display:'flex', alignItems:'center', gap:'0.5rem',
              padding:'0.5rem 1rem', borderRadius:'var(--radius-sm)',
              border:'none', cursor:'pointer', fontWeight:'600', fontSize:'0.875rem',
              background: copied ? '#128C7E' : '#25D366',
              color:'white', transition:'all 0.2s'
            }}
            title="Copiar informações para o WhatsApp"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {copied ? 'Copiado! ✓' : 'Copiar para WhatsApp'}
          </button>
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
