import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Feldherr — Schach-Kontrollanalyse',
  description:
    'Wissenschaftliche Positionsanalyse: Kontroll-Heatmap, Deckungsnetz, Fragilität und Engine-Prognose. PGN, FEN und Lichess-Import.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
