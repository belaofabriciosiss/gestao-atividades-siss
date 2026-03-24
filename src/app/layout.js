import './globals.css'

export const metadata = {
  title: 'Gestão de Atividades SISS',
  description: 'Sistema de gestão de visitas e atividades de equipe',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
