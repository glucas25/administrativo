'use client'
import { Inter } from 'next/font/google'
import './globals.css'  // ← IMPORTANTE: Esta línea debe estar
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
