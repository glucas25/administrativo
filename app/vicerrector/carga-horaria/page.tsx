// app/vicerrector/carga-horaria/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Usuario, Asignatura, Curso, CursoAsignatura, CargaHoraria, PeriodoAcademico } from '@/types/database'
import toast from 'react-hot-toast'

interface DocenteWithCarga extends Usuario {
  cargas?: Array<{
    id: number
    curso_asignatura: {
      id: number
      curso: Curso
      asignatura: Asignatura
      horas_semanales: number
    }
    horas_semanales: number
  }>
  total_horas?: number
}

export default function CargaHorariaPage() {
  const router = useRouter()
  const [docentes, setDocentes] = useState<DocenteWithCarga[]>([])
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])
  const [cursoAsignaturas, setCursoAsignaturas] = useState<CursoAsignatura[]>([])
  const [periodoActivo, setPeriodoActivo] = useState<PeriodoAcademico | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDocente, setSelectedDocente] = useState<Usuario | null>(null)
  const [showAsignModal, setShowAsignModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Form data para asignar carga
  const [asignFormData, setAsignFormData] = useState({
    curso_id: '',
    asignatura_id: '',
    horas_semanales: ''
  })

  // Form data para configurar curso-asignatura
  const [configFormData, setConfigFormData] = useState({
    curso_id: '',
    asignatura_id: '',
    horas_semanales: ''
  })

  useEffect(() => {
    checkAuth()
    loadData()
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

  const loadData = async () => {
    try {
      // Cargar período activo
      const { data: periodoData } = await supabase
        .from('periodos_academicos')
        .select('*')
        .eq('activo', true)
        .single()

      if (!periodoData) {
        toast.error('No hay período académico activo. Configure uno primero.')
        router.push('/vicerrector/periodos')
        return
      }

      setPeriodoActivo(periodoData)

      // Cargar docentes con su carga horaria
      const { data: docentesData, error: docentesError } = await supabase
        .from('usuarios')
        .select(`
          *,
          carga_horaria!carga_horaria_docente_id_fkey (
            id,
            horas_semanales,
            curso_asignatura_id
          )
        `)
        .eq('rol', 'docente')
        .eq('activo', true)

      if (docentesError) throw docentesError

      // Procesar docentes y calcular total de horas
      const docentesWithCarga = await Promise.all(
        (docentesData || []).map(async (docente) => {
          const cargas = await Promise.all(
            (docente.carga_horaria || []).map(async (carga: any) => {
              const { data: cursoAsigData } = await supabase
                .from('curso_asignaturas')
                .select(`
                  *,
                  cursos!inner(*),
                  asignaturas!inner(*)
                `)
                .eq('id', carga.curso_asignatura_id)
                .single()

              return {
                id: carga.id,
                curso_asignatura: {
                  id: cursoAsigData?.id,
                  curso: cursoAsigData?.cursos,
                  asignatura: cursoAsigData?.asignaturas,
                  horas_semanales: cursoAsigData?.horas_semanales || 0
                },
                horas_semanales: carga.horas_semanales
              }
            })
          )

          const total_horas = cargas.reduce((sum, c) => sum + c.horas_semanales, 0)

          return {
            ...docente,
            cargas: cargas.filter(c => c.curso_asignatura.id),
            total_horas
          }
        })
      )

      setDocentes(docentesWithCarga)

      // Cargar asignaturas
      const { data: asignaturasData } = await supabase
        .from('asignaturas')
        .select('*')
        .eq('activo', true)
        .order('nombre')

      setAsignaturas(asignaturasData || [])

      // Cargar cursos
      const { data: cursosData } = await supabase
        .from('cursos')
        .select('*')
        .eq('activo', true)
        // Mostrar todos los cursos disponibles
        .order('subnivel', { ascending: true })
        .order('curso', { ascending: true })
        .order('paralelo', { ascending: true })

      setCursos(cursosData || [])

      // Cargar relaciones curso-asignatura
      const { data: cursoAsigData } = await supabase
        .from('curso_asignaturas')
        .select(`
          *,
          cursos!inner(*),
          asignaturas!inner(*)
        `)
        .eq('activo', true)

      setCursoAsignaturas(cursoAsigData || [])

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleAsignarCarga = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedDocente || !periodoActivo) return

    try {
      // Verificar si existe la relación curso-asignatura
      const { data: cursoAsigData } = await supabase
        .from('curso_asignaturas')
        .select('id')
        .eq('curso_id', parseInt(asignFormData.curso_id))
        .eq('asignatura_id', parseInt(asignFormData.asignatura_id))
        .single()

      let cursoAsignaturaId: number

      if (cursoAsigData) {
        cursoAsignaturaId = cursoAsigData.id
      } else {
        // Crear la relación si no existe
        const { data: newCursoAsig, error: createError } = await supabase
          .from('curso_asignaturas')
          .insert({
            curso_id: parseInt(asignFormData.curso_id),
            asignatura_id: parseInt(asignFormData.asignatura_id),
            horas_semanales: parseInt(asignFormData.horas_semanales),
            activo: true
          })
          .select()
          .single()

        if (createError) throw createError
        cursoAsignaturaId = newCursoAsig.id
      }

      // Verificar si ya existe esta asignación
      const { data: existingCarga } = await supabase
        .from('carga_horaria')
        .select('id')
        .eq('docente_id', selectedDocente.id)
        .eq('curso_asignatura_id', cursoAsignaturaId)
        .eq('periodo_id', periodoActivo.id)
        .single()

      if (existingCarga) {
        toast.error('El docente ya tiene asignada esta materia en este curso')
        return
      }

      // Crear la carga horaria
      const { error } = await supabase
        .from('carga_horaria')
        .insert({
          docente_id: selectedDocente.id,
          curso_asignatura_id: cursoAsignaturaId,
          periodo_id: periodoActivo.id,
          horas_semanales: parseInt(asignFormData.horas_semanales),
          activo: true
        })

      if (error) throw error

      toast.success('Carga horaria asignada correctamente')
      setShowAsignModal(false)
      resetAsignForm()
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al asignar carga horaria')
    }
  }

  const handleDeleteCarga = async (cargaId: number, docenteName: string) => {
    if (!confirm(`¿Está seguro de eliminar esta asignación de ${docenteName}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('carga_horaria')
        .delete()
        .eq('id', cargaId)

      if (error) throw error
      toast.success('Asignación eliminada correctamente')
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al eliminar asignación')
    }
  }

  const handleConfigureCursoAsignatura = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Verificar si ya existe
      const { data: existing } = await supabase
        .from('curso_asignaturas')
        .select('id')
        .eq('curso_id', parseInt(configFormData.curso_id))
        .eq('asignatura_id', parseInt(configFormData.asignatura_id))
        .single()

      if (existing) {
        toast.error('Esta asignatura ya está configurada para este curso')
        return
      }

      const { error } = await supabase
        .from('curso_asignaturas')
        .insert({
          curso_id: parseInt(configFormData.curso_id),
          asignatura_id: parseInt(configFormData.asignatura_id),
          horas_semanales: parseInt(configFormData.horas_semanales),
          activo: true
        })

      if (error) throw error

      toast.success('Relación curso-asignatura creada')
      setShowConfigModal(false)
      resetConfigForm()
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al configurar curso-asignatura')
    }
  }

  const resetAsignForm = () => {
    setAsignFormData({
      curso_id: '',
      asignatura_id: '',
      horas_semanales: ''
    })
  }

  const resetConfigForm = () => {
    setConfigFormData({
      curso_id: '',
      asignatura_id: '',
      horas_semanales: ''
    })
  }

  const filteredDocentes = docentes.filter(docente =>
    docente.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    docente.correo.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-purple-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold">Asignación de Carga Horaria</h1>
              <button
                onClick={() => router.push('/vicerrector')}
                className="text-purple-200 hover:text-white text-sm mt-1"
              >
                ← Volver al dashboard
              </button>
            </div>
            <button
              onClick={() => setShowConfigModal(true)}
              className="bg-white text-purple-700 px-4 py-2 rounded hover:bg-purple-50"
            >
              ⚙️ Configurar Curso-Asignatura
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Period Info */}
        {periodoActivo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Período Activo:</span> {periodoActivo.nombre}
            </p>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Buscar docente por nombre o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Docentes List */}
        <div className="space-y-6">
          {filteredDocentes.map((docente) => (
            <div key={docente.id} className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{docente.nombre_completo}</h3>
                    <p className="text-sm text-gray-600">{docente.correo}</p>
                    {docente.titulo && (
                      <p className="text-sm text-gray-500">{docente.titulo}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">
                      {docente.total_horas || 0} hrs/sem
                    </p>
                    <button
                      onClick={() => {
                        setSelectedDocente(docente)
                        setShowAsignModal(true)
                      }}
                      className="mt-2 bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700"
                    >
                      ➕ Asignar Carga
                    </button>
                  </div>
                </div>

                {/* Cargas Asignadas */}
                {docente.cargas && docente.cargas.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Carga Horaria Asignada:</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Curso
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Asignatura
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Horas/Sem
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {docente.cargas.map((carga) => (
                            <tr key={carga.id}>
                              <td className="px-4 py-2 text-sm">
                                {carga.curso_asignatura.curso?.curso} {carga.curso_asignatura.curso?.paralelo}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {carga.curso_asignatura.asignatura?.nombre}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium">
                                {carga.horas_semanales}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <button
                                  onClick={() => handleDeleteCarga(carga.id, docente.nombre_completo)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Eliminar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(!docente.cargas || docente.cargas.length === 0) && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-500 text-center">
                      No tiene carga horaria asignada
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredDocentes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No se encontraron docentes</p>
          </div>
        )}
      </main>

      {/* Modal Asignar Carga */}
      {showAsignModal && selectedDocente && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-6">
              Asignar Carga Horaria
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Docente: <span className="font-medium">{selectedDocente.nombre_completo}</span>
            </p>
            
            <form onSubmit={handleAsignarCarga}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Curso *
                </label>
                <select
                  value={asignFormData.curso_id}
                  onChange={(e) => setAsignFormData({ ...asignFormData, curso_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Seleccionar curso...</option>
                  {cursos.map((curso) => (
                    <option key={curso.id} value={curso.id}>
                      {curso.curso} {curso.paralelo} - {curso.jornada}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asignatura *
                </label>
                <select
                  value={asignFormData.asignatura_id}
                  onChange={(e) => setAsignFormData({ ...asignFormData, asignatura_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Seleccionar asignatura...</option>
                  {asignaturas.map((asignatura) => (
                    <option key={asignatura.id} value={asignatura.id}>
                      {asignatura.nombre} ({asignatura.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horas Semanales *
                </label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={asignFormData.horas_semanales}
                  onChange={(e) => setAsignFormData({ ...asignFormData, horas_semanales: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAsignModal(false)
                    setSelectedDocente(null)
                    resetAsignForm()
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Asignar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Configurar Curso-Asignatura */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-6">
              Configurar Relación Curso-Asignatura
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Define qué asignaturas se imparten en cada curso
            </p>
            
            <form onSubmit={handleConfigureCursoAsignatura}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Curso *
                </label>
                <select
                  value={configFormData.curso_id}
                  onChange={(e) => setConfigFormData({ ...configFormData, curso_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Seleccionar curso...</option>
                  {cursos.map((curso) => (
                    <option key={curso.id} value={curso.id}>
                      {curso.curso} {curso.paralelo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asignatura *
                </label>
                <select
                  value={configFormData.asignatura_id}
                  onChange={(e) => setConfigFormData({ ...configFormData, asignatura_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Seleccionar asignatura...</option>
                  {asignaturas.map((asignatura) => (
                    <option key={asignatura.id} value={asignatura.id}>
                      {asignatura.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horas Semanales por Defecto *
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={configFormData.horas_semanales}
                  onChange={(e) => setConfigFormData({ ...configFormData, horas_semanales: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfigModal(false)
                    resetConfigForm()
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Crear Relación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
