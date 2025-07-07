'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Documento } from '@/types/database'
import toast from 'react-hot-toast'

export default function RevisarDocumentosPage() {
  const router = useRouter()
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
    loadDocumentos()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: userData } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (userData?.rol !== 'vicerrector') {
      router.push('/docente')
    }
  }

  const loadDocumentos = async () => {
    try {
      const { data } = await supabase
        .from('documentos')
        .select(`*, docentes:usuarios (nombre_completo), tipos_documento (nombre)`)
        .order('fecha_subida', { ascending: false })
      setDocumentos(data || [])
    } catch (error) {
      console.error('Error loading documentos:', error)
      toast.error('Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }

  const actualizarEstado = async (id: string, estado: string) => {
    try {
      const { error } = await supabase
        .from('documentos')
        .update({ estado })
        .eq('id', id)
      if (error) throw error
      toast.success('Estado actualizado')
      loadDocumentos()
    } catch (error) {
      console.error('Error updating estado:', error)
      toast.error('No se pudo actualizar')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-purple-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Revisar Documentos</h1>
          <button
            onClick={() => router.push('/vicerrector')}
            className="text-purple-200 hover:text-white text-sm"
          >
            ← Volver al dashboard
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Docente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documentos.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(doc as any).docentes?.nombre_completo || ''}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doc.tipos_documento?.nombre || ''}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doc.estado}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(doc.fecha_subida).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => actualizarEstado(doc.id, 'APROBADO')}
                      className="text-green-600 hover:text-green-900"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => actualizarEstado(doc.id, 'OBSERVADO')}
                      className="text-yellow-600 hover:text-yellow-900"
                    >
                      Observar
                    </button>
                    <button
                      onClick={() => actualizarEstado(doc.id, 'RECHAZADO')}
                      className="text-red-600 hover:text-red-900"
                    >
                      Rechazar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {documentos.length === 0 && (
            <div className="p-8 text-center text-gray-500">No hay documentos</div>
          )}
        </div>
      </main>
    </div>
  )
}
