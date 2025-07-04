// app/docente/page.tsx - Dashboard mejorado
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Usuario, Documento, EntregaProgramada, CargaHoraria, Asignatura, Curso } from '@/types/database'
import toast from 'react-hot-toast'

interface CargaHorariaCompleta {
  id: number
  horas_semanales: number
  curso_asignatura: {
    curso: Curso
    asignatura: Asignatura
    horas_semanales: number
  }
}

interface EntregaPendiente extends EntregaProgramada {
  tipo_documento: {
    nombre: string
    codigo: string
  }
  dias_restantes: number
  vencido: boolean
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

      const { data: userData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (userData) {
        setUser(userData)
        await loadDocenteData(userData.id)
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
        toast.warning('No hay período académico activo')
        return
      }

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
                curso,
                paralelo,
                jornada
              ),
              asignaturas (
                id,
                codigo,
                nombre,
                area
              )
            `)
            .eq('id', carga.curso_asignatura_id)
            .single()

          return {
            id: carga.id,
            horas_semanales: carga.horas_semanales,
            curso_asignatura: {
              curso: cursoAsig?.cursos,
              asignatura: cursoAsig?.asignaturas,
              horas_semanales: cursoAsig?.horas_semanales || 0
            }
          }
        })
      )

      setCargaHoraria(cargaCompleta.filter(c => c.curso_asignatura.curso && c.curso_asignatura.asignatura))

      // Cargar entregas pendientes
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

      // Cargar documentos recientes
      const { data: documentosData } = await supabase
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

      setDocumentosRecientes(documentosData || [])

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

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <button
              onClick={() => router.push('/docente')}
              className="mr-4 text-gray-500 hover:text-gray-700"
            >
              ← Volver
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Subir Documento
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo de Documento */}
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

            {/* Entrega Programada (opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entrega Programada (opcional)
              </label>
              <select
                value={formData.entrega_id}
                onChange={(e) => setFormData({ ...formData, entrega_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sin entrega específica</option>
                {entregas
                  .filter((e: any) => !formData.tipo_documento_id || e.tipo_documento_id === parseInt(formData.tipo_documento_id))
                  .map((entrega: any) => (
                    <option key={entrega.id} value={entrega.id}>
                      {entrega.titulo} - Vence: {new Date(entrega.fecha_limite).toLocaleDateString()}
                    </option>
                  ))}
              </select>
            </div>

            {/* Asignatura */}
            {tiposDocumento.find(t => t.id === parseInt(formData.tipo_documento_id))?.requiere_asignatura && (
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
                onClick={() => router.push('/docente')}
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
      </main>
    </div>
  )
}