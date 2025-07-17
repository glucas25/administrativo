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
  observaciones_internas?: string | null;
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
  const [comentarioDocente, setComentarioDocente] = useState<string | null>(null);
  const [comentarioVicerrector, setComentarioVicerrector] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroDocente, setFiltroDocente] = useState<string>('todos');
  const [filtroEtapa, setFiltroEtapa] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [paginaActual, setPaginaActual] = useState(1);
  const [documentosPorPagina, setDocumentosPorPagina] = useState(25);

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

  // Obtener tipos únicos de documentos para el filtro
  const tiposDocumento = Array.from(new Set(documentos.map(doc => doc.tipo_documento_nombre).filter(Boolean))).sort();

  // Obtener docentes únicos para el filtro
  const docentesUnicos = Array.from(new Set(
    documentos
      .map(doc => `${doc.docente_nombres || ''} ${doc.docente_apellidos || ''}`.trim())
      .filter(nombre => nombre !== '')
  )).sort();

  // Obtener etapas únicas para el filtro
  const etapasUnicas = Array.from(new Set(documentos.map(doc => doc.etapa_nombre).filter(Boolean))).sort();

  // Obtener estados únicos para el filtro
  const estadosUnicos = Array.from(new Set(documentos.map(doc => doc.estado).filter(Boolean))).sort();

  // Filtrar documentos según todos los filtros seleccionados
  const documentosFiltrados = documentos.filter(doc => {
    const cumpleTipo = filtroTipo === 'todos' || doc.tipo_documento_nombre === filtroTipo;
    const nombreDocente = `${doc.docente_nombres || ''} ${doc.docente_apellidos || ''}`.trim();
    const cumpleDocente = filtroDocente === 'todos' || nombreDocente === filtroDocente;
    const cumpleEtapa = filtroEtapa === 'todos' || doc.etapa_nombre === filtroEtapa;
    const cumpleEstado = filtroEstado === 'todos' || doc.estado === filtroEstado;
    return cumpleTipo && cumpleDocente && cumpleEtapa && cumpleEstado;
  });

  // Calcular paginación
  const totalDocumentos = documentosFiltrados.length;
  const totalPaginas = Math.ceil(totalDocumentos / documentosPorPagina);
  const inicio = (paginaActual - 1) * documentosPorPagina;
  const fin = inicio + documentosPorPagina;
  const documentosPaginados = documentosFiltrados.slice(inicio, fin);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [filtroTipo, filtroDocente, filtroEtapa, filtroEstado]);

  // Función para cambiar página
  const cambiarPagina = (nuevaPagina: number) => {
    setPaginaActual(Math.max(1, Math.min(nuevaPagina, totalPaginas)));
  };

  // Función para ir a página específica
  const irAPagina = (pagina: number) => {
    setPaginaActual(pagina);
  };

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
      <header className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Revisar documentos
                </span>
              </h1>
              <div className="flex items-center space-x-2">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></div>
                <button
                  onClick={() => router.push('/vicerrector')}
                  className="text-blue-600 hover:text-blue-800 text-sm transition-colors font-medium flex items-center"
                >
                  <span className="mr-1">←</span>
                  Volver al dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros por tipo de documento, docente, etapa y estado */}
        <div className="mb-6 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Filtros de búsqueda</h3>
            <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
              {documentosFiltrados.length} de {documentos.length} documentos
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col space-y-1">
              <label htmlFor="filtro-tipo" className="text-xs font-medium text-gray-600">
                Tipo de documento
              </label>
              <select
                id="filtro-tipo"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="todos">Todos los tipos</option>
                {tiposDocumento.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col space-y-1">
              <label htmlFor="filtro-etapa" className="text-xs font-medium text-gray-600">
                Etapa
              </label>
              <select
                id="filtro-etapa"
                value={filtroEtapa}
                onChange={(e) => setFiltroEtapa(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="todos">Todas las etapas</option>
                {etapasUnicas.map(etapa => (
                  <option key={etapa} value={etapa}>{etapa}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col space-y-1">
              <label htmlFor="filtro-docente" className="text-xs font-medium text-gray-600">
                Docente
              </label>
              <select
                id="filtro-docente"
                value={filtroDocente}
                onChange={(e) => setFiltroDocente(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="todos">Todos los docentes</option>
                {docentesUnicos.map(docente => (
                  <option key={docente} value={docente}>{docente}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col space-y-1">
              <label htmlFor="filtro-estado" className="text-xs font-medium text-gray-600">
                Estado
              </label>
              <select
                id="filtro-estado"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="todos">Todos los estados</option>
                {estadosUnicos.map(estado => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Docente</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Etapa</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Curso</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Paralelo</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Jornada</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Asignatura</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Comentario</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {documentosPaginados.map((doc: Documento, idx: number) => (
                <tr key={doc.id} className={idx % 2 === 0 ? 'bg-white hover:bg-purple-50 transition' : 'bg-gray-50 hover:bg-purple-50 transition'}>
                  <td className="px-4 py-3 text-sm text-gray-900">{doc.docente_nombres || '-'} {doc.docente_apellidos || ''}</td>
                  <td className="px-4 py-3 text-sm">{doc.tipo_documento_nombre || '-'}</td>
                  <td className="px-4 py-3 text-sm">{doc.etapa_nombre || '-'}</td>
                  <td className="px-4 py-3 text-sm">{doc.curso_nombre || '-'}</td>
                  <td className="px-4 py-3 text-sm">{doc.curso_paralelo || '-'}</td>
                  <td className="px-4 py-3 text-sm">{doc.curso_jornada || '-'}</td>
                  <td className="px-4 py-3 text-sm">{doc.asignatura_nombre || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full shadow-sm ${
                      doc.estado === 'APROBADO' ? 'bg-green-100 text-green-700' :
                      doc.estado === 'OBSERVADO' ? 'bg-yellow-100 text-yellow-700' :
                      doc.estado === 'RECHAZADO' ? 'bg-red-100 text-red-700' :
                      doc.estado === 'EN_REVISION' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {doc.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(doc.fecha_subida).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">
                    {(doc.observaciones || doc.observaciones_internas) ? (
                      <button
                        onClick={() => {
                          setComentarioDocente(doc.observaciones_internas || null);
                          setComentarioVicerrector(doc.observaciones || null);
                          setShowModalComentario(true);
                          setSelectedDocument(doc);
                        }}
                        className="text-purple-600 hover:text-purple-900 text-xs underline font-semibold"
                        title="Ver comentarios"
                      >
                        Ver comentarios
                      </button>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <div className="flex items-center justify-center gap-2">
                      {doc.nombre_archivo ? (
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="p-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 transition disabled:opacity-50"
                          title="Descargar documento"
                        >
                          {/* Heroicon: Arrow Down Tray */}
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
                        </button>
                      ) : (
                        <span className="text-gray-300" title="No disponible">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </span>
                      )}
                      <button
                        onClick={() => handleAprobar(doc.id)}
                        className="p-2 rounded-full bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition"
                        title="Aprobar documento"
                      >
                        {/* Heroicon: Check Circle */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2l4-4m5 2a9 9 0 11-18 0a9 9 0 0118 0z" /></svg>
                      </button>
                      <button
                        onClick={() => handleActionClick(doc, 'OBSERVADO')}
                        className="p-2 rounded-full bg-yellow-50 hover:bg-yellow-100 text-yellow-600 hover:text-yellow-800 transition"
                        title="Observar documento"
                      >
                        {/* Heroicon: Chat Bubble Left Ellipsis */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h.01M12 8h.01M17 8h.01M21 12c0 3.866-3.582 7-8 7a8.96 8.96 0 01-4-.93L3 21l1.07-3.21A7.963 7.963 0 013 12c0-3.866 3.582-7 8-7s8 3.134 8 7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleActionClick(doc, 'RECHAZADO')}
                        className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition"
                        title="Rechazar documento"
                      >
                        {/* Heroicon: No Symbol (Ban) */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9l6 6" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {documentosPaginados.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {documentosFiltrados.length === 0 ? 'No hay documentos que coincidan con los filtros' : 'No hay documentos en esta página'}
            </div>
          )}
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  Mostrando {inicio + 1}-{Math.min(fin, totalDocumentos)} de {totalDocumentos} documentos
                </span>
                <div className="flex items-center space-x-2">
                  <label htmlFor="por-pagina" className="text-xs font-medium text-gray-600">
                    Por página:
                  </label>
                  <select
                    id="por-pagina"
                    value={documentosPorPagina}
                    onChange={(e) => {
                      setDocumentosPorPagina(Number(e.target.value));
                      setPaginaActual(1);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => cambiarPagina(paginaActual - 1)}
                  disabled={paginaActual === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                
                {/* Números de página */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    let pagina;
                    if (totalPaginas <= 5) {
                      pagina = i + 1;
                    } else if (paginaActual <= 3) {
                      pagina = i + 1;
                    } else if (paginaActual >= totalPaginas - 2) {
                      pagina = totalPaginas - 4 + i;
                    } else {
                      pagina = paginaActual - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pagina}
                        onClick={() => irAPagina(pagina)}
                        className={`px-3 py-1 text-sm rounded ${
                          pagina === paginaActual
                            ? 'bg-purple-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pagina}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => cambiarPagina(paginaActual + 1)}
                  disabled={paginaActual === totalPaginas}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
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
          <div className="bg-white p-6 rounded shadow-lg max-w-md w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowModalComentario(false)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <h2 className="text-lg font-bold mb-4">Comentarios del documento</h2>
            {comentarioDocente && (
              <div className="mb-4">
                <span className="block text-xs font-semibold text-blue-700 mb-1">🧑‍🏫 Comentario del docente:</span>
                <p className="text-gray-800 whitespace-pre-line text-sm bg-blue-50 rounded p-2">{comentarioDocente}</p>
              </div>
            )}
            {comentarioVicerrector && (
              <div className="mb-2">
                <span className="block text-xs font-semibold text-yellow-700 mb-1">🧑‍💼 Comentario del vicerrector:</span>
                <p className="text-gray-800 whitespace-pre-line text-sm bg-yellow-50 rounded p-2">{comentarioVicerrector}</p>
              </div>
            )}
            {(!comentarioDocente && !comentarioVicerrector) && (
              <p className="text-gray-500 text-sm">No hay comentarios registrados.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
