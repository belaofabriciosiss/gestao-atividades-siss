export default function StatusBadge({ status }) {
  const config = {
    'Pendente':   { cls: 'badge-pendente',   label: 'Pendente' },
    'Finalizado': { cls: 'badge-finalizado', label: 'Finalizado' },
    'Cancelado':  { cls: 'badge-cancelado',  label: 'Cancelado' },
  }
  const c = config[status] || config['Pendente']
  return (
    <span className={`badge ${c.cls}`}>
      <span className="badge-dot" />
      {c.label}
    </span>
  )
}
