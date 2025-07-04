import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'  // ← IMPORTANTE: Esta línea debe estar
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sistema de Documentos Docentes',
  description: 'Gestión de documentos institucionales',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}