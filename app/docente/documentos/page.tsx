'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Documento } from '@/types/database'
import toast from 'react-hot-toast'

export default function MisDocumentosPage() {
  const router = useRouter()
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Documento | null>(null)

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
    // Validar rol
    const { data: userData } = await supabase.rpc('obtener_perfil_usuario', { p_user_id: user.id })
    const rol = (userData && userData[0]?.rol) ? userData[0].rol.toLowerCase().trim() : '';
    if (rol !== 'docente') {
      router.push('/vicerrector')
    }
  }

  const loadDocumentos = async () => {
    try {
      const { data } = await supabase
        .from('documentos')
        .select(`*, tipos_documento (nombre), asignaturas (nombre)`)
        .order('fecha_subida', { ascending: false })
      // Agrupar por entrega_id + asignatura_id y mostrar solo el más reciente
      if (data && Array.isArray(data)) {
        const grouped: { [key: string]: Documento[] } = {}
        for (const doc of data) {
          const key = `${doc.entrega_id || ''}_${doc.asignatura_id || ''}`
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(doc)
        }
        // Tomar el más reciente de cada grupo
        const docsUnicos = Object.values(grouped).map(arr => arr.sort((a, b) => new Date(b.fecha_subida).getTime() - new Date(a.fecha_subida).getTime())[0])
        setDocumentos(docsUnicos)
      } else {
        setDocumentos([])
      }
    } catch (error) {
      console.error('Error loading documentos:', error)
      toast.error('Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (doc: Documento) => {
    setDownloadingId(doc.id)
    try {
      const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.nombre_archivo, 60 * 60)
      if (error || !data?.signedUrl) {
        toast.error('No se pudo generar el enlace de descarga')
        return
      }
      window.open(data.signedUrl, '_blank')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleViewComments = (doc: Documento) => {
    setSelectedDocument(doc)
    setShowModal(true)
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'APROBADO':
        return 'bg-green-100 text-green-800'
      case 'OBSERVADO':
        return 'bg-yellow-100 text-yellow-800'
      case 'RECHAZADO':
        return 'bg-red-100 text-red-800'
      case 'EN_REVISION':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'OBSERVADO':
        return '⚠️'
      case 'RECHAZADO':
        return '❌'
      default:
        return ''
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <button onClick={() => router.push('/docente')} className="mr-4 text-gray-500 hover:text-gray-700">
              ← Volver
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Mis Documentos</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asignatura</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documentos.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doc.tipo_documento?.nombre || ''}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doc.asignatura?.nombre || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstadoColor(doc.estado)}`}>
                        {getEstadoIcon(doc.estado)} {doc.estado}
                      </span>
                      {(doc.estado === 'OBSERVADO' || doc.estado === 'RECHAZADO') && doc.observaciones && (
                        <button
                          onClick={() => handleViewComments(doc)}
                          className="text-blue-600 hover:text-blue-800 text-xs underline"
                          title="Ver comentarios"
                        >
                          Ver comentarios
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(doc.fecha_subida).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      {doc.nombre_archivo ? (
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {downloadingId === doc.id ? 'Generando...' : 'Descargar'}
                        </button>
                      ) : (
                        <span className="text-gray-400">No disponible</span>
                      )}
                      {(doc.estado === 'OBSERVADO' || doc.estado === 'RECHAZADO') && doc.observaciones && (
                        <button
                          onClick={() => handleViewComments(doc)}
                          className="text-yellow-600 hover:text-yellow-800 text-xs"
                          title="Ver detalles"
                        >
                          📋
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {documentos.length === 0 && (
            <div className="p-8 text-center text-gray-500">No has subido documentos</div>
          )}
        </div>
      </main>

      {/* Modal para mostrar comentarios */}
      {showModal && selectedDocument && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedDocument.estado === 'OBSERVADO' ? 'Observaciones' : 'Motivo del Rechazo'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false)
                    setSelectedDocument(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Documento:</strong> {selectedDocument.tipo_documento?.nombre}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Asignatura:</strong> {selectedDocument.asignatura?.nombre}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Fecha de revisión:</strong> {selectedDocument.fecha_revision ? new Date(selectedDocument.fecha_revision).toLocaleDateString() : 'No disponible'}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comentario del vicerrector:
                </label>
                <div className="bg-gray-50 p-3 rounded-md border">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {selectedDocument.observaciones || 'No hay comentarios disponibles'}
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowModal(false)
                    setSelectedDocument(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
