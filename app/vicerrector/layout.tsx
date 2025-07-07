'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function VicerrectorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single()

      if (userData?.rol !== 'vicerrector') {
        router.push('/docente')
        return
      }

      setUser({
        ...userData,
        nombre_completo: `${userData.apellidos ?? ''} ${userData.nombres ?? ''}`.trim(),
      })
    } catch (error) {
      console.error('Error:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    toast.success('Sesión cerrada')
  }

  const menuItems = [
    { href: '/vicerrector', label: 'Dashboard', icon: '🏠' },
    { href: '/vicerrector/tipos-documento', label: 'Tipos de Documento', icon: '📋' },
    { href: '/vicerrector/docentes', label: 'Gestión de Docentes', icon: '👥' },
    { href: '/vicerrector/entregas', label: 'Entregas Programadas', icon: '📅' },
    { href: '/vicerrector/documentos', label: 'Revisar Documentos', icon: '📄' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-purple-700 text-white shadow-lg fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white p-2 rounded-md hover:bg-purple-600 lg:hidden"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-bold ml-2">Panel de Vicerrectorado</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm">{user?.nombre_completo}</span>
            <button
              onClick={handleLogout}
              className="text-purple-200 hover:text-white transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <div className="flex pt-14">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-64 bg-white shadow-md fixed left-0 top-14 bottom-0 overflow-y-auto">
          <nav className="p-4">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                        isActive
                          ? 'bg-purple-100 text-purple-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* Sidebar - Mobile */}
        <div
          className={`lg:hidden fixed inset-0 z-50 transition-opacity ${
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="absolute inset-0 bg-black opacity-50" onClick={() => setSidebarOpen(false)}></div>
          <aside className={`absolute left-0 top-0 bottom-0 w-64 bg-white shadow-lg transform transition-transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="p-4 bg-purple-700 text-white">
              <h2 className="text-lg font-bold">Menú</h2>
            </div>
            <nav className="p-4">
              <ul className="space-y-2">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                          isActive
                            ? 'bg-purple-100 text-purple-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-xl">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>
        </div>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
