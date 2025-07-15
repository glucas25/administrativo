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
    curso_asignatura_id: ''
  })

  // Form data para configurar curso-asignatura
  const [configFormData, setConfigFormData] = useState({
    curso_id: '',
    asignatura_id: '',
    horas_semanales: ''
  })

  // Estado para edición de carga
  const [editCarga, setEditCarga] = useState<{id: number, horas_semanales: string} | null>(null)

  // Estado para periodo y filtros
  const [periodos, setPeriodos] = useState<PeriodoAcademico[]>([])
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<PeriodoAcademico | null>(null)
  const [filtroCurso, setFiltroCurso] = useState('')
  const [filtroAsignatura, setFiltroAsignatura] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
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
        return
      }

      // Solo cargar datos si es vicerrector
      loadData()
    } catch (error) {
      console.error('Error en checkAuth:', error)
      router.push('/auth/login')
    }
  }

  const loadData = async (periodoId?: number) => {
    try {
      // Cargar todos los periodos
      const { data: periodosData } = await supabase.from('periodos_academicos').select('*').order('nombre', { ascending: false })
      setPeriodos(periodosData || [])

      // Seleccionar periodo
      let periodoActivoData = periodoSeleccionado
      if (periodoId) {
        periodoActivoData = (periodosData || []).find(p => p.id === periodoId) || null
        setPeriodoSeleccionado(periodoActivoData)
      } else if (!periodoSeleccionado && periodosData && periodosData.length > 0) {
        periodoActivoData = periodosData.find(p => p.activo) || periodosData[0]
        setPeriodoSeleccionado(periodoActivoData)
      }
      if (!periodoActivoData) return
      setPeriodoActivo(periodoActivoData)

      // Cargar docentes desde la vista usuarios_completos
      const { data: docentesData, error: docentesError } = await supabase
        .from('usuarios_completos')
        .select('*')
        .eq('rol', 'docente')

      if (docentesError) throw docentesError

      // Filtrar solo los activos en el frontend
      const docentesActivos = (docentesData || []).filter((d: any) => d.activo)

      // Procesar docentes y cargar su carga horaria
      const docentesWithCarga = await Promise.all(
        (docentesActivos || []).map(async (docente: any) => {
          // Cargar la carga horaria del docente para el periodo actual
          const { data: cargasData } = await supabase
            .from('carga_horaria')
                .select(`
              id,
              horas_semanales,
              curso_asignatura_id,
              curso_asignaturas!inner(
                id,
                horas_semanales,
                  cursos!inner(*),
                  asignaturas!inner(*)
              )
                `)
            .eq('docente_id', docente.id)
            .eq('periodo_id', periodoActivoData.id)
            .eq('activo', true)

          const cargas = (cargasData || []).map((carga: any) => ({
                id: carga.id,
            horas_semanales: carga.horas_semanales,
                curso_asignatura: {
              id: carga.curso_asignaturas.id,
              curso: carga.curso_asignaturas.cursos,
              asignatura: carga.curso_asignaturas.asignaturas,
              horas_semanales: carga.curso_asignaturas.horas_semanales
              }
          }))

          const total_horas = cargas.reduce((sum, c) => sum + c.horas_semanales, 0)

          const nombre_completo = docente.nombre_completo || `${docente.apellidos ?? ''} ${docente.nombres ?? ''}`.trim();

          return {
            ...docente,
            nombre_completo,
            cargas,
            total_horas
          }
        })
      )

      console.log('Docentes cargados:', docentesWithCarga.length)
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
      // Verificar si ya existe esta asignación
      const { data: existingCarga } = await supabase
        .from('carga_horaria')
        .select('id')
        .eq('docente_id', selectedDocente.id)
        .eq('curso_asignatura_id', parseInt(asignFormData.curso_asignatura_id))
        .eq('periodo_id', periodoActivo.id)
        .single()

      if (existingCarga) {
        toast.error('El docente ya tiene asignada esta materia en este curso')
        return
      }

      // Obtener las horas de la malla
      const cursoAsig = cursoAsignaturas.find(ca => ca.id === parseInt(asignFormData.curso_asignatura_id))
      const horasMalla = cursoAsig?.horas_semanales || 0

      const { data, error } = await supabase
        .from('carga_horaria')
        .insert([{
          docente_id: selectedDocente.id,
          curso_asignatura_id: parseInt(asignFormData.curso_asignatura_id),
          periodo_id: periodoActivo.id,
          horas_semanales: horasMalla,
          activo: true
        }])
        .select();

      if (error || !data || data.length === 0) {
        toast.error(error?.message || 'No se pudo guardar la carga horaria');
        return;
      }

      toast.success('Guardado exitosamente');
      setShowAsignModal(false)
      resetAsignForm()
      loadData()
    } catch (error: any) {
      console.error('Error al asignar carga:', error?.message || error);
      toast.error(error?.message || 'Error al asignar carga');
    }
  }

  const handleDeleteCarga = async (cargaId: number, docenteName: string) => {
    if (!confirm(`¿Está seguro de eliminar esta asignación de ${docenteName}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('carga_horaria')
        .update({ activo: false })
        .eq('id', cargaId)

      if (error) throw error
      toast.success('Asignación desactivada correctamente')
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al desactivar asignación')
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
      curso_asignatura_id: ''
    })
  }

  const resetConfigForm = () => {
    setConfigFormData({
      curso_id: '',
      asignatura_id: '',
      horas_semanales: ''
    })
  }

  // Función para guardar edición
  const handleEditCarga = async () => {
    if (!editCarga) return;
    try {
      const { error } = await supabase
        .from('carga_horaria')
        .update({ horas_semanales: parseInt(editCarga.horas_semanales) })
        .eq('id', editCarga.id)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Carga horaria actualizada')
        setEditCarga(null)
        loadData()
      }
    } catch (error) {
      toast.error('Error al actualizar carga')
    }
  }

  const filteredDocentes = docentes.filter(docente =>
    (docente.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
     docente.correo.toLowerCase().includes(searchTerm.toLowerCase())) &&
    // Si hay filtros de curso o asignatura, solo mostrar docentes que tengan cargas que coincidan
    ((filtroCurso || filtroAsignatura) ? 
      (docente.cargas && docente.cargas.some(carga =>
        (!filtroCurso || (carga.curso_asignatura.curso?.curso + carga.curso_asignatura.curso?.paralelo) === filtroCurso) &&
        (!filtroAsignatura || carga.curso_asignatura.asignatura?.nombre === filtroAsignatura)
      )) : true)
  )

  // --- NUEVO: Filtrar relaciones con carga horaria asignada para la vista principal ---
  const relacionesConCarga = cursoAsignaturas.filter(rel =>
    docentes.some(doc =>
      doc.cargas && doc.cargas.some(c => c.curso_asignatura.id === rel.id)
    )
  )

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  const cursoAsignaturasAsignadas = docentes.flatMap(doc => (doc.cargas || []).map((c: any) => c.curso_asignatura.id));
  const cursoAsignaturasDisponibles: typeof cursoAsignaturas = cursoAsignaturas.filter((ca: any) => !cursoAsignaturasAsignadas.includes(ca.id));

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
            {/* Eliminar botón Configurar Curso-Asignatura */}
            {/* <button
              onClick={() => setShowConfigModal(true)}
              className="bg-white text-purple-700 px-4 py-2 rounded hover:bg-purple-50"
            >
              ⚙️ Configurar Curso-Asignatura
            </button> */}
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

        {/* Selector de periodo académico */}
        <div className="mb-4 flex flex-wrap gap-4 items-center">
          <label className="font-medium">Periodo académico:</label>
          <select
            value={periodoSeleccionado?.id || ''}
            onChange={e => loadData(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {periodos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <label className="font-medium ml-6">Curso:</label>
          <select
            value={filtroCurso}
            onChange={e => setFiltroCurso(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">Todos</option>
            {cursos.map(c => (
              <option key={c.id} value={c.curso + c.paralelo}>{c.curso} {c.paralelo}</option>
            ))}
          </select>
          <label className="font-medium ml-6">Asignatura:</label>
          <select
            value={filtroAsignatura}
            onChange={e => setFiltroAsignatura(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">Todas</option>
            {asignaturas.map(a => (
              <option key={a.id} value={a.nombre}>{a.nombre}</option>
            ))}
          </select>
        </div>

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
                                {carga.curso_asignatura.curso?.curso ?? ''} {carga.curso_asignatura.curso?.paralelo ?? ''}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {carga.curso_asignatura.asignatura?.nombre ?? ''}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium">
                                {editCarga && editCarga.id === carga.id ? (
                                  <input
                                    type="number"
                                    min={1}
                                    value={editCarga.horas_semanales}
                                    onChange={e => setEditCarga({ ...editCarga, horas_semanales: e.target.value })}
                                    className="border rounded px-2 py-1 w-20"
                                  />
                                ) : (
                                  carga.horas_semanales
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm space-x-2">
                                {editCarga && editCarga.id === carga.id ? (
                                  <>
                                    <button onClick={handleEditCarga} className="text-green-600 hover:underline">Guardar</button>
                                    <button onClick={() => setEditCarga(null)} className="text-gray-500 hover:underline">Cancelar</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => setEditCarga({ id: carga.id, horas_semanales: String(carga.horas_semanales) })} className="text-blue-600 hover:underline">Editar</button>
                                    <button onClick={() => handleDeleteCarga(carga.id, docente.nombre_completo ? docente.nombre_completo : '')} className="text-red-600 hover:text-red-900">Eliminar</button>
                                  </>
                                )}
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

        {/* Eliminar sección de Relaciones Curso-Asignatura y el modal de configuración */}
        {/* ...el resto del código permanece igual... */}
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
                  Relación Curso-Asignatura *
                </label>
                {/* Filtrar las opciones del select para mostrar solo las no asignadas */}
                <select
                  value={asignFormData.curso_asignatura_id}
                  onChange={e => setAsignFormData({ curso_asignatura_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Seleccionar relación curso-asignatura...</option>
                  {cursoAsignaturasDisponibles.map((ca: any) => (
                    <option key={ca.id} value={ca.id}>
                      {ca.cursos.curso} {ca.cursos.paralelo} - {ca.asignaturas.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Eliminar el input de horas del formulario de asignación */}
              {/* <div className="mb-6">
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
              </div> */}

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

      {/* Eliminar sección de Relaciones Curso-Asignatura y el modal de configuración */}
      {/* ...el resto del código permanece igual... */}
    </div>
  )
}
