// app/docente/page.tsx - Dashboard mejorado
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Usuario, Documento, EntregaProgramada, CargaHoraria, Asignatura, Curso, TipoDocumento } from '@/types/database'
import toast from 'react-hot-toast'
import { useRef } from 'react'

interface CargaHorariaCompleta {
  id: number
  horas_semanales: number
  curso_asignatura: {
    curso?: Curso
    asignatura?: Asignatura
    horas_semanales: number
  }
}

interface EntregaPendiente {
  tipo_documento: {
    nombre: string
    codigo: string
  }
  dias_restantes: number
  vencido: boolean
}

interface EntregaExpandida extends EntregaProgramada {
  asignatura?: Asignatura
  asignatura_id?: number
  curso?: Curso
}

export default function DocenteDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [cargaHoraria, setCargaHoraria] = useState<CargaHorariaCompleta[]>([])
  const [entregasPendientes, setEntregasPendientes] = useState<EntregaPendiente[]>([])
  const [documentosRecientes, setDocumentosRecientes] = useState<Documento[]>([])
const [stats, setStats] = useState({
  totalDocumentos: 0,
  pendientes: 0,
  observados: 0,
  aprobados: 0,
  totalHoras: 0,
  asignaturas: 0,
  cursos: 0
})

  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([])
  const [entregas, setEntregas] = useState<EntregaProgramada[]>([])
  const [documentosPorEntrega, setDocumentosPorEntrega] = useState<{[key: number]: Documento | null}>({})
  const [formData, setFormData] = useState({
    tipo_documento_id: '',
    entrega_id: '',
    asignatura_id: '',
    observaciones: ''
  })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [periodoActivo, setPeriodoActivo] = useState<any>(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push('/auth/login')
        return
      }

      // Usar la función correcta para obtener el perfil
      const { data: userData } = await supabase
        .rpc('obtener_perfil_usuario', { p_user_id: authUser.id })

      const rol = (userData && userData[0]?.rol) ? userData[0].rol.toLowerCase().trim() : '';
      if (rol !== 'docente') {
        router.push('/vicerrector')
        return
      }

      if (userData && userData[0]) {
        setUser(userData[0])
        await loadDocenteData(authUser.id)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar datos del usuario')
    } finally {
      setLoading(false)
    }
  }

  const loadDocenteData = async (docenteId: string) => {
    try {
      // Cargar período activo
      const { data: periodoActivo } = await supabase
        .from('periodos_academicos')
        .select('*')
        .eq('activo', true)
        .single()

      if (!periodoActivo) {
        toast('No hay período académico activo')
        return
      }
      setPeriodoActivo(periodoActivo)

      // Cargar carga horaria con detalles
      const { data: cargaData } = await supabase
        .from('carga_horaria')
        .select(`
          id,
          horas_semanales,
          curso_asignatura_id
        `)
        .eq('docente_id', docenteId)
        .eq('periodo_id', periodoActivo.id)
        .eq('activo', true)

      // Obtener detalles de cada carga
      const cargaCompleta = await Promise.all(
        (cargaData || []).map(async (carga) => {
          const { data: cursoAsig } = await supabase
            .from('curso_asignaturas')
            .select(`
              horas_semanales,
              cursos (
                id,
                codigo,
                subnivel,
                curso,
                paralelo,
                jornada,
                activo
              ),
              asignaturas (
                id,
                codigo,
                nombre,
                area,
                activo
              )
            `)
            .eq('id', carga.curso_asignatura_id)
            .single()

          return {
            id: carga.id,
            horas_semanales: carga.horas_semanales,
            curso_asignatura: {
              curso: Array.isArray(cursoAsig?.cursos) ? cursoAsig.cursos[0] : cursoAsig?.cursos,
              asignatura: Array.isArray(cursoAsig?.asignaturas) ? cursoAsig.asignaturas[0] : cursoAsig?.asignaturas,
              horas_semanales: cursoAsig?.horas_semanales || 0
            }
          }
        })
      )

      setCargaHoraria(cargaCompleta.filter(c => c.curso_asignatura.curso && c.curso_asignatura.asignatura))

      // Cargar entregas del período
      const { data: entregasData } = await supabase
        .from('entregas_programadas')
        .select(`
          *,
          tipos_documento (
            nombre,
            codigo
          )
        `)
        .eq('periodo_id', periodoActivo.id)
        .eq('activo', true)
        .eq('es_obligatorio', true)
        .gte('fecha_limite', new Date().toISOString().split('T')[0])

      setEntregas(entregasData || [])

      // Cargar documentos del docente y mapearlos por entrega
      const { data: documentosData } = await supabase
        .from('documentos')
        .select('id, estado, nombre_archivo, fecha_subida, entrega_id, asignatura_id')
        .eq('docente_id', docenteId)

      const documentosPorEntregaMap: {[key: number]: any | null} = {}
      if (entregasData) {
        for (const entrega of entregasData) {
          const documento = documentosData?.find(doc => doc.entrega_id === entrega.id) || null
          documentosPorEntregaMap[entrega.id] = documento
        }
      }
      setDocumentosPorEntrega(documentosPorEntregaMap)

      // Verificar cuáles ya fueron entregadas
      const entregasPendientes = await Promise.all(
        (entregasData || []).map(async (entrega) => {
          const { data: documento } = await supabase
            .from('documentos')
            .select('id, estado')
            .eq('docente_id', docenteId)
            .eq('entrega_id', entrega.id)
            .single()

          if (!documento || documento.estado === 'OBSERVADO' || documento.estado === 'RECHAZADO') {
            const diasRestantes = Math.ceil(
              (new Date(entrega.fecha_limite).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            )

            return {
              ...entrega,
              dias_restantes: diasRestantes,
              vencido: diasRestantes < 0
            }
          }
          return null
        })
      )

      setEntregasPendientes(entregasPendientes.filter(Boolean) as EntregaPendiente[])

      const { data: tiposData } = await supabase
        .from('tipos_documento')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })
      setTiposDocumento(tiposData || [])

      const { data: asignData } = await supabase
        .from('asignaturas')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })
      setAsignaturas(asignData || [])

      // Cargar documentos recientes
      const { data: documentosRecientesData } = await supabase
        .from('documentos')
        .select(`
          *,
          tipos_documento (
            nombre
          ),
          asignaturas (
            nombre
          )
        `)
        .eq('docente_id', docenteId)
        .order('fecha_subida', { ascending: false })
        .limit(5)

      setDocumentosRecientes(documentosRecientesData || [])

      // Calcular estadísticas
      const { data: allDocumentos } = await supabase
        .from('documentos')
        .select('estado')
        .eq('docente_id', docenteId)

      const totalHoras = cargaCompleta.reduce((sum, c) => sum + c.horas_semanales, 0)
      const asignaturasUnicas = new Set(cargaCompleta.map(c => c.curso_asignatura.asignatura?.id)).size
      const cursosUnicos = new Set(cargaCompleta.map(c => c.curso_asignatura.curso?.id)).size

      setStats({
        totalDocumentos: allDocumentos?.length || 0,
        pendientes: entregasPendientes.filter(Boolean).length,
        observados: allDocumentos?.filter(d => d.estado === 'OBSERVADO').length || 0,
        aprobados: allDocumentos?.filter(d => d.estado === 'APROBADO').length || 0,
        totalHoras,
        asignaturas: asignaturasUnicas,
        cursos: cursosUnicos
      })

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar información')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    setFile(selected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast.error('Seleccione un archivo')
      return
    }

    setUploading(true)
    try {
      // 1. Subir archivo a Google Drive vía API
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      const uploadRes = await fetch('/api/documentos/upload', {
        method: 'POST',
        body: formDataUpload
      })
      const uploadJson = await uploadRes.json()
      if (!uploadJson.success) {
        throw new Error(uploadJson.error || 'Error subiendo a Google Drive')
      }

      // 2. Guardar metadatos en la base de datos
      const now = new Date().toISOString()
      const { data, error } = await supabase.from('documentos').insert([
        {
          docente_id: user?.id,
          entrega_id: formData.entrega_id ? parseInt(formData.entrega_id) : null,
          tipo_documento_id: formData.tipo_documento_id ? parseInt(formData.tipo_documento_id) : null,
          periodo_id: periodoActivo?.id || null,
          asignatura_id: formData.asignatura_id ? parseInt(formData.asignatura_id) : null,
          nombre_archivo: uploadJson.name,
          nombre_original: file.name,
          tamaño_bytes: file.size,
          tipo_mime: file.type,
          link_onedrive: uploadJson.webViewLink,
          onedrive_file_id: uploadJson.id,
          estado: 'ENVIADO',
          fecha_subida: now,
          fecha_ultima_modificacion: now,
          version: 1,
          observaciones: formData.observaciones || null,
        }
      ])
      if (error) {
        throw new Error(error.message)
      }
      toast.success('Documento subido y registrado correctamente')
      setFormData({
        tipo_documento_id: '',
        entrega_id: '',
        asignatura_id: '',
        observaciones: ''
      })
      setFile(null)
      setShowUploadModal(false)
      // Recargar datos recientes
      if (user?.id) await loadDocenteData(user.id)
    } catch (error: any) {
      console.error('Error subiendo documento:', error)
      toast.error('Error al subir documento: ' + (error?.message || ''))
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  // Generar entregas expandidas por asignatura
  const entregasExpandida = entregas.flatMap(entrega => {
    if (tiposDocumento.find(t => t.id === entrega.tipo_documento_id)?.requiere_asignatura) {
      // Una fila por cada asignatura de la carga horaria
      return cargaHoraria.map(carga => ({
        ...entrega,
        asignatura: carga.curso_asignatura.asignatura,
        asignatura_id: carga.curso_asignatura.asignatura?.id,
        curso: carga.curso_asignatura.curso
      }))
    } else {
      // Solo una fila
      return [{ ...entrega, asignatura: undefined, asignatura_id: undefined, curso: undefined }]
    }
  }) as EntregaExpandida[]

  // Mapeo de documentos por entrega_id + asignatura_id
  const documentosPorEntregaAsignatura: {[key: string]: any | null} = {}
  documentosRecientes.forEach(doc => {
    const key = `${doc.entrega_id || ''}_${doc.asignatura_id || ''}`
    documentosPorEntregaAsignatura[key] = doc
  })

  // Filtrar documentos entregados aprobados
  const documentosAprobados = (entregasExpandida as Array<any>).filter((e: any) => {
    const key = `${e.id}_${e.asignatura_id || ''}`
    const doc = documentosPorEntregaAsignatura[key]
    return doc && doc.estado === 'APROBADO'
  })
  // Filtrar entregas solicitadas no aprobadas
  const entregasNoAprobadas = (entregasExpandida as Array<any>).filter((e: any) => {
    const key = `${e.id}_${e.asignatura_id || ''}`
    const doc = documentosPorEntregaAsignatura[key]
    return !doc || (doc.estado !== 'APROBADO')
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1 md:mb-0">Panel del Docente</h1>
            {user && (
              <p className="text-lg text-blue-100 font-medium">{user.nombre_completo || `${user.apellidos ?? ''} ${user.nombres ?? ''}`.trim()}</p>
            )}
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            <a
              href="#"
              onClick={e => { e.preventDefault(); handleLogout(); }}
              className="ml-0 md:ml-6 text-white hover:underline text-base font-semibold whitespace-nowrap"
              style={{ minWidth: '120px', textAlign: 'right' }}
            >
              Cerrar sesión
            </a>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white shadow p-3 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-blue-600">{stats.totalDocumentos}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Documentos<br />Subidos</span>
          </div>
          <div className="bg-white shadow p-3 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-green-600">{stats.aprobados}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Aprobados</span>
          </div>
          <div className="bg-white shadow p-3 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-yellow-600">{stats.observados}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Observados</span>
          </div>
          <div className="bg-white shadow p-3 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-purple-600">{stats.totalHoras}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Horas<br />Asignadas</span>
          </div>
          <div className="bg-white shadow p-3 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-indigo-600">{stats.asignaturas}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Asignaturas</span>
          </div>
          <div className="bg-white shadow p-3 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-pink-600">{stats.cursos}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Cursos</span>
          </div>
        </div>
        {/* Documentos Solicitados */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Documentos Solicitados</h2>
          {entregasNoAprobadas.length === 0 ? (
            <p className="text-gray-500">No hay documentos pendientes por entregar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Curso</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asignatura</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Archivo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha Límite</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {entregasNoAprobadas.map((entrega) => {
                    const documento = documentosPorEntregaAsignatura[`${entrega.id}_${entrega.asignatura_id || ''}`] || null;
                    const diasRestantes = Math.ceil(
                      (new Date(entrega.fecha_limite).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    )
                    const vencido = diasRestantes < 0
                    const puedeSubir = !documento || documento.estado === 'OBSERVADO' || documento.estado === 'RECHAZADO'
                    return (
                      <tr key={`${entrega.id}_${entrega.asignatura_id || ''}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{entrega?.tipo_documento?.nombre || entrega?.titulo || 'Sin nombre'}</td>
                        <td className="px-4 py-3 text-sm">{entrega?.curso ? `${entrega.curso.curso} ${entrega.curso.paralelo || ''}` : '-'}</td>
                        <td className="px-4 py-3 text-sm">{entrega?.asignatura?.nombre || '-'}</td>
                        <td className="px-4 py-3 text-sm">{documento?.nombre_archivo ? documento.nombre_archivo : 'Sin archivo'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={vencido ? 'text-red-600' : 'text-gray-900'}>
                            {new Date(entrega.fecha_limite).toLocaleDateString()}
                          </span>
                          <div className="text-xs text-gray-500">
                            {diasRestantes >= 0 ? `Faltan ${diasRestantes} días` : `Vencido hace ${Math.abs(diasRestantes)} días`}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {documento ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getEstadoColor(documento.estado)}`}>
                              {documento.estado}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                              No entregado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {puedeSubir ? (
                            <button
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  tipo_documento_id: entrega.tipo_documento_id.toString(),
                                  entrega_id: entrega.id.toString(),
                                  asignatura_id: entrega.asignatura_id || ''
                                })
                                setShowUploadModal(true)
                              }}
                              className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                            >
                              {documento ? 'Reemplazar' : 'Subir'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500">Entregado</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Documentos Entregados */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Documentos Entregados</h2>
          {documentosAprobados.length === 0 ? (
            <p className="text-gray-500">No hay documentos aprobados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Curso</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asignatura</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Archivo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {documentosAprobados.map((doc: any, idx) => {
                    const entregaExpandida = entregasExpandida.find(e => e.id === doc.entrega_id && e.asignatura_id === doc.asignatura_id)
                    return (
                      <tr key={doc.id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{entregaExpandida?.tipo_documento?.nombre || entregaExpandida?.titulo || 'Sin nombre'}</td>
                        <td className="px-4 py-3 text-sm">{entregaExpandida?.curso ? `${entregaExpandida.curso.curso} ${entregaExpandida.curso.paralelo || ''}` : '-'}</td>
                        <td className="px-4 py-3 text-sm">{entregaExpandida?.asignatura?.nombre || 'Sin asignatura'}</td>
                        <td className="px-4 py-3 text-sm">{doc.nombre_archivo}</td>
                        <td className="px-4 py-3 text-sm">{doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getEstadoColor(doc.estado)}`}>{doc.estado}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Carga Horaria */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Carga Horaria</h2>
          {cargaHoraria.length === 0 ? (
            <p className="text-gray-500">No tienes carga horaria asignada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Curso</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asignatura</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Horas/Sem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cargaHoraria.map((carga) => (
                    <tr key={carga.id}>
                      <td className="px-4 py-2 text-sm">{carga?.curso_asignatura?.curso?.curso ? `${carga.curso_asignatura.curso.curso} ${carga.curso_asignatura.curso.paralelo || ''}` : 'Sin curso'}</td>
                      <td className="px-4 py-2 text-sm">{carga?.curso_asignatura?.asignatura?.nombre || 'Sin asignatura'}</td>
                      <td className="px-4 py-2 text-sm">{carga?.curso_asignatura?.horas_semanales ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Documentos Recientes */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Documentos Recientes</h2>
          {documentosRecientes.length === 0 ? (
            <p className="text-gray-500">No hay documentos recientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asignatura</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {documentosRecientes.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-4 py-2 text-sm">{doc?.nombre_archivo || 'Sin nombre'}</td>
                      <td className="px-4 py-2 text-sm">{doc?.asignatura?.nombre || 'Sin asignatura'}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getEstadoColor(doc?.estado)}`}>{doc?.estado || 'Sin estado'}</span>
                      </td>
                      <td className="px-4 py-2 text-sm">{doc?.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Modal de subida de documento */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
                onClick={() => setShowUploadModal(false)}
              >
                ×
              </button>
              <h2 className="text-xl font-bold mb-4 text-gray-900">Subir Documento</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
                {/* Solo mostrar selects si no están definidos */}
                {!formData.tipo_documento_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Documento *
              </label>
              <select
                value={formData.tipo_documento_id}
                onChange={(e) => setFormData({ ...formData, tipo_documento_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Seleccione un tipo...</option>
                {tiposDocumento.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </div>
                )}
                {!formData.entrega_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                      Entrega Programada *
              </label>
              <select
                value={formData.entrega_id}
                onChange={(e) => setFormData({ ...formData, entrega_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Seleccione una entrega...</option>
                      {entregas.map((entrega) => (
                    <option key={entrega.id} value={entrega.id}>
                      {entrega.titulo} - Vence: {new Date(entrega.fecha_limite).toLocaleDateString()}
                    </option>
                  ))}
              </select>
            </div>
                )}
                {tiposDocumento.find(t => t.id === parseInt(formData.tipo_documento_id))?.requiere_asignatura && !formData.asignatura_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asignatura *
                </label>
                <select
                  value={formData.asignatura_id}
                  onChange={(e) => setFormData({ ...formData, asignatura_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Seleccione una asignatura...</option>
                  {asignaturas.map((asignatura) => (
                    <option key={asignatura.id} value={asignatura.id}>
                      {asignatura.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Archivo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo *
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {file ? (
                    <div className="text-sm text-gray-900">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="mt-2 text-red-600 hover:text-red-500"
                      >
                        Eliminar archivo
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                        >
                          <span>Seleccionar archivo</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            className="sr-only"
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx"
                          />
                        </label>
                        <p className="pl-1">o arrastrar y soltar</p>
                      </div>
                      <p className="text-xs text-gray-500">PDF, DOC, DOCX hasta 10MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones (opcional)
              </label>
              <textarea
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Agregue cualquier comentario adicional sobre el documento..."
              />
            </div>
            {/* Botones */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                    onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={uploading || !file}
              >
                {uploading ? 'Subiendo...' : 'Subir Documento'}
              </button>
            </div>
          </form>
        </div>
          </div>
        )}
      </main>
    </div>
  )
}
