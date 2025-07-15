'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Documento as DocumentoBase } from '@/types/database'
import toast from 'react-hot-toast'

// Extiende Documento para los campos de la vista
interface Documento extends DocumentoBase {
  docente_nombres?: string;
  docente_apellidos?: string;
  tipo_documento_nombre?: string;
  entrega_titulo?: string;
  entrega_fecha_limite?: string;
  curso_nombre?: string;
  curso_paralelo?: string;
  curso_jornada?: string;
  asignatura_nombre?: string;
  etapa_nombre?: string;
}

export default function RevisarDocumentosPage() {
  const router = useRouter()
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Documento | null>(null)
  const [selectedAction, setSelectedAction] = useState<'OBSERVADO' | 'RECHAZADO' | null>(null)
  const [comentario, setComentario] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showModalComentario, setShowModalComentario] = useState(false);

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
      .rpc('obtener_perfil_usuario', { p_user_id: user.id })

    const rol = (userData && userData[0]?.rol) ? userData[0].rol.toLowerCase().trim() : '';
    if (rol !== 'vicerrector') {
      router.push('/docente')
    }
  }

  const loadDocumentos = async () => {
    try {
      const { data, error } = await supabase
        .from('vista_documentos_completa')
        .select('*')
        .order('fecha_subida', { ascending: false })

      if (error) {
        console.error('Error en la consulta:', error)
        throw error
      }

      setDocumentos(data || [])
    } catch (error) {
      console.error('Error loading documentos:', error)
      toast.error('Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }

  const handleActionClick = (doc: Documento, action: 'OBSERVADO' | 'RECHAZADO') => {
    setSelectedDocument(doc)
    setSelectedAction(action)
    setComentario('')
    setShowModal(true)
  }

  const handleAprobar = async (id: string) => {
    await actualizarEstado(id, 'APROBADO')
  }

  const actualizarEstado = async (id: string, estado: string, comentario?: string) => {
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      console.log('Actualizando documento:', id, estado, comentario);
      const { data, error } = await supabase
        .from('documentos')
        .update({ 
          estado,
          observaciones: comentario || null,
          fecha_revision: new Date().toISOString(),
          revisado_por: user.id
        })
        .eq('id', id)
        .select();

      console.log('Respuesta update:', { data, error });

      if (error || !data || data.length === 0) {
        toast.error('No se pudo actualizar el documento');
        setSubmitting(false);
        return;
      }

      // Registrar en historial de estados
      const { error: histError } = await supabase
        .from('historial_estados')
        .insert({
          documento_id: id,
          estado_anterior: selectedDocument?.estado || 'ENVIADO',
          estado_nuevo: estado,
          cambiado_por: user.id,
          comentario: comentario || null
        })

      if (histError) {
        console.error('Error registrando historial:', histError)
        // No lanzar error aquí, el documento ya se actualizó
      }

      toast.success('Estado actualizado')
      loadDocumentos()
      setShowModal(false)
      setSelectedDocument(null)
      setSelectedAction(null)
      setComentario('')
    } catch (error) {
      console.error('Error updating estado:', error)
      toast.error('No se pudo actualizar')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitComentario = async () => {
    if (!selectedDocument || !selectedAction) return
    
    if (!comentario.trim()) {
      toast.error('Debe agregar un comentario')
      return
    }

    await actualizarEstado(selectedDocument.id, selectedAction, comentario.trim())
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

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-purple-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold">Revisar documentos</h1>
              <button
                onClick={() => router.push('/vicerrector')}
                className="text-purple-200 hover:text-white text-sm mt-1"
              >
                ← Volver al dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Docente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Etapa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Curso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paralelo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jornada</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asignatura</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comentario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documentos.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {doc.docente_nombres || '-'} {doc.docente_apellidos || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {doc.tipo_documento_nombre || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {doc.etapa_nombre || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {doc.curso_nombre || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {doc.curso_paralelo || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {doc.curso_jornada || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {doc.asignatura_nombre || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      doc.estado === 'APROBADO' ? 'bg-green-100 text-green-800' :
                      doc.estado === 'OBSERVADO' ? 'bg-yellow-100 text-yellow-800' :
                      doc.estado === 'RECHAZADO' ? 'bg-red-100 text-red-800' :
                      doc.estado === 'EN_REVISION' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {doc.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(doc.fecha_subida).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {doc.observaciones ? (
                      <button
                        onClick={() => {
                          setSelectedDocument(doc);
                          setShowModalComentario(true);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Ver comentario
                      </button>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {doc.nombre_archivo ? (
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition disabled:opacity-50"
                          title="Descargar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
                          Descargar
                        </button>
                      ) : (
                        <span className="text-gray-400 mr-2">No disponible</span>
                      )}
                      <button
                        onClick={() => handleAprobar(doc.id)}
                        className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition"
                        title="Aprobar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Aprobar
                      </button>
                      <button
                        onClick={() => handleActionClick(doc, 'OBSERVADO')}
                        className="inline-flex items-center px-3 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600 transition"
                        title="Observar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" /></svg>
                        Observar
                      </button>
                      <button
                        onClick={() => handleActionClick(doc, 'RECHAZADO')}
                        className="inline-flex items-center px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
                        title="Rechazar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        Rechazar
                      </button>
                    </div>
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

      {/* Modal para comentarios */}
      {showModal && selectedDocument && selectedAction && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedAction === 'OBSERVADO' ? 'Observar Documento' : 'Rechazar Documento'}
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Docente:</strong> {selectedDocument.docente_nombres} {selectedDocument.docente_apellidos}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Documento:</strong> {selectedDocument.tipo_documento_nombre}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Asignatura:</strong> {selectedDocument.asignatura_nombre}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comentario {selectedAction === 'OBSERVADO' ? '(observaciones)' : '(motivo del rechazo)'}:
                </label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  rows={4}
                  placeholder={selectedAction === 'OBSERVADO' 
                    ? 'Especifique las observaciones o correcciones necesarias...' 
                    : 'Especifique el motivo del rechazo...'
                  }
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowModal(false)
                    setSelectedDocument(null)
                    setSelectedAction(null)
                    setComentario('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitComentario}
                  disabled={submitting || !comentario.trim()}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                    selectedAction === 'OBSERVADO' 
                      ? 'bg-yellow-600 hover:bg-yellow-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {submitting ? 'Guardando...' : selectedAction === 'OBSERVADO' ? 'Observar' : 'Rechazar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver comentario */}
      {showModalComentario && selectedDocument && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
            <h2 className="text-lg font-bold mb-2">Comentario/Observación</h2>
            <p className="mb-4 whitespace-pre-line">{selectedDocument.observaciones}</p>
            <button
              onClick={() => setShowModalComentario(false)}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
