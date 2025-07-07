// app/vicerrector/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Usuario } from '@/types/database'
import toast from 'react-hot-toast'

export default function VicerrectorDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalDocentes: 0,
    documentosPorRevisar: 0,
    documentosAprobados: 0,
    tiposDocumento: 0,
    asignaturas: 0,
    cursos: 0
  })

  useEffect(() => {
    checkUser()
    loadStats()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push('/auth/login')
        return
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (userData && userData.rol !== 'vicerrector') {
        toast.error('No tienes permisos para acceder a esta sección')
        router.push('/docente')
        return
      }

      if (userData) {
        setUser({
          ...userData,
          nombre_completo: `${userData.apellidos ?? ''} ${userData.nombres ?? ''}`.trim()
        })
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      // Contar docentes
      const { count: docentesCount } = await supabase
        .from('usuarios')
        .select('*', { count: 'exact', head: true })
        .eq('rol', 'docente')
        .eq('activo', true)

      // Contar documentos por revisar
      const { count: porRevisarCount } = await supabase
        .from('documentos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'ENVIADO')

      // Contar documentos aprobados
      const { count: aprobadosCount } = await supabase
        .from('documentos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'APROBADO')

      // Contar tipos de documento
      const { count: tiposCount } = await supabase
        .from('tipos_documento')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)

      // Contar asignaturas
      const { count: asignaturasCount } = await supabase
        .from('asignaturas')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)

      // Contar cursos
      const { count: cursosCount } = await supabase
        .from('cursos')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)

      setStats({
        totalDocentes: docentesCount || 0,
        documentosPorRevisar: porRevisarCount || 0,
        documentosAprobados: aprobadosCount || 0,
        tiposDocumento: tiposCount || 0,
        asignaturas: asignaturasCount || 0,
        cursos: cursosCount || 0
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-purple-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold">
              Panel de Vicerrectorado
            </h1>
            <button
              onClick={handleLogout}
              className="text-sm text-purple-200 hover:text-white"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Bienvenido, {user?.nombre_completo || 'Vicerrectorado'}
          </h2>
          <p className="text-gray-600 mt-1">
            Panel de administración del sistema
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm font-medium text-gray-600">Docentes</p>
            <p className="text-2xl font-semibold text-gray-900">{stats.totalDocentes}</p>
          </div>

          <div className="bg-orange-50 rounded-lg shadow p-4">
            <p className="text-sm font-medium text-orange-800">Por Revisar</p>
            <p className="text-2xl font-semibold text-orange-900">{stats.documentosPorRevisar}</p>
          </div>

          <div className="bg-green-50 rounded-lg shadow p-4">
            <p className="text-sm font-medium text-green-800">Aprobados</p>
            <p className="text-2xl font-semibold text-green-900">{stats.documentosAprobados}</p>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-4">
            <p className="text-sm font-medium text-blue-800">Tipos Doc.</p>
            <p className="text-2xl font-semibold text-blue-900">{stats.tiposDocumento}</p>
          </div>

          <div className="bg-purple-50 rounded-lg shadow p-4">
            <p className="text-sm font-medium text-purple-800">Asignaturas</p>
            <p className="text-2xl font-semibold text-purple-900">{stats.asignaturas}</p>
          </div>

          <div className="bg-indigo-50 rounded-lg shadow p-4">
            <p className="text-sm font-medium text-indigo-800">Cursos</p>
            <p className="text-2xl font-semibold text-indigo-900">{stats.cursos}</p>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Gestión Académica */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📚 Gestión Académica</h3>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/vicerrector/asignaturas')}
                className="w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                → Gestionar Asignaturas
              </button>
              <button
                onClick={() => router.push('/vicerrector/cursos')}
                className="w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                → Gestionar Cursos
              </button>
              <button
                onClick={() => router.push('/vicerrector/periodos')}
                className="w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                → Períodos Académicos
              </button>
              <button
                onClick={() => router.push('/vicerrector/carga-horaria')}
                className="w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                → Asignar Carga Horaria
              </button>
            </div>
          </div>

          {/* Gestión de Documentos */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📄 Gestión de Documentos</h3>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/vicerrector/tipos-documento')}
                className="w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                → Tipos de Documento
              </button>
              <button
                onClick={() => router.push('/vicerrector/entregas')}
                className="w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                → Programar Entregas
              </button>
              <button
                onClick={() => router.push('/vicerrector/documentos')}
                className="w-full text-left px-4 py-2 bg-orange-50 rounded hover:bg-orange-100 transition-colors"
              >
                → Revisar Documentos ({stats.documentosPorRevisar})
              </button>
            </div>
          </div>

          {/* Gestión de Usuarios */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 Gestión de Usuarios</h3>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/vicerrector/docentes')}
                className="w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                → Gestionar Docentes
              </button>
              <button
                onClick={() => router.push('/vicerrector/importar')}
                className="w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                → Importar Masivamente
              </button>
              <button
                onClick={() => router.push('/vicerrector/reportes')}
                className="w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                → Generar Reportes
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
