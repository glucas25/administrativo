'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { iniciarSesion } from '@/lib/auth/cliente'
import CompletarPerfil from '@/components/forms/CompletarPerfil'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [authUser, setAuthUser] = useState<any>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setNeedsProfile(false)
    setAuthUser(null)
    try {
      const result = await iniciarSesion(email, password)
      if (result.success) {
        toast.success('¡Bienvenido!')
        // Redirige según el rol
        if (result.user.rol === 'vicerrector') {
          router.push('/vicerrector')
        } else if (result.user.rol === 'docente') {
          router.push('/docente')
        } else if (result.user.rol === 'admin') {
          router.push('/admin')
        } else {
          router.push('/')
        }
      } else if (result.needsProfile) {
        setNeedsProfile(true)
        setAuthUser(result.auth_user)
      } else {
        toast.error(
          typeof result.error === 'string'
            ? result.error
            : result.error?.message || JSON.stringify(result.error) || 'Error al iniciar sesión'
        )
      }
    } catch (error: any) {
      toast.error(
        typeof error === 'string'
          ? error
          : error?.message || JSON.stringify(error) || 'Error al iniciar sesión'
      )
    } finally {
      setLoading(false)
    }
  }

  if (needsProfile && authUser) {
    return <CompletarPerfil authUser={authUser} onComplete={() => router.push('/')} />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sistema de Documentos
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Gestión Docente Institucional
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Correo electrónico"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Contraseña"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
