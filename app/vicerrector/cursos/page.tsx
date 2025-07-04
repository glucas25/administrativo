// app/vicerrector/cursos/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Curso, PeriodoAcademico } from '@/types/database'
import toast from 'react-hot-toast'

export default function CursosPage() {
  const router = useRouter()
  const [cursos, setCursos] = useState<Curso[]>([])
  const [periodos, setPeriodos] = useState<PeriodoAcademico[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCurso, setEditingCurso] = useState<Curso | null>(null)
  const [formData, setFormData] = useState({
    codigo: '',
    subnivel: '',
    curso: '',
    paralelo: '',
    jornada: 'Matutina',
    periodo_id: ''
  })
  const [showImportModal, setShowImportModal] = useState(false)
  const [importData, setImportData] = useState('')

  // Opciones para los selects
  const subniveles = [
    'Educación Inicial',
    'Preparatoria',
    'Básica Elemental',
    'Básica Media',
    'Básica Superior',
    'Bachillerato'
  ]

  const cursosOptions = {
    'Educación Inicial': ['Inicial 1', 'Inicial 2'],
    'Preparatoria': ['Primero de Básica'],
    'Básica Elemental': ['Segundo de Básica', 'Tercero de Básica', 'Cuarto de Básica'],
    'Básica Media': ['Quinto de Básica', 'Sexto de Básica', 'Séptimo de Básica'],
    'Básica Superior': ['Octavo de Básica', 'Noveno de Básica', 'Décimo de Básica'],
    'Bachillerato': ['Primero de Bachillerato', 'Segundo de Bachillerato', 'Tercero de Bachillerato']
  }

  const paralelos = ['A', 'B', 'C', 'D', 'E', 'F']
  const jornadas = ['Matutina', 'Vespertina', 'Nocturna']

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
      // Cargar periodos
      const { data: periodosData, error: periodosError } = await supabase
        .from('periodos_academicos')
        .select('*')
        .order('fecha_inicio', { ascending: false })

      if (periodosError) throw periodosError
      setPeriodos(periodosData || [])

      // Cargar cursos
      const { data: cursosData, error: cursosError } = await supabase
        .from('cursos')
        .select('*')
        .order('subnivel, curso, paralelo')

      if (cursosError) throw cursosError
      setCursos(cursosData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const cursoData = {
        codigo: formData.codigo,
        subnivel: formData.subnivel,
        curso: formData.curso,
        paralelo: formData.paralelo,
        jornada: formData.jornada,
        periodo_id: formData.periodo_id ? parseInt(formData.periodo_id) : null,
        activo: true
      }

      if (editingCurso) {
        // Actualizar
        const { error } = await supabase
          .from('cursos')
          .update(cursoData)
          .eq('id', editingCurso.id)

        if (error) throw error
        toast.success('Curso actualizado correctamente')
      } else {
        // Crear nuevo
        const { error } = await supabase
          .from('cursos')
          .insert([cursoData])

        if (error) throw error
        toast.success('Curso creado correctamente')
      }

      setShowModal(false)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Error:', error)
      if (error.code === '23505') {
        toast.error('El código de curso ya existe')
      } else {
        toast.error('Error al guardar curso')
      }
    }
  }

  const handleEdit = (curso: Curso) => {
    setEditingCurso(curso)
    setFormData({
      codigo: curso.codigo,
      subnivel: curso.subnivel,
      curso: curso.curso,
      paralelo: curso.paralelo,
      jornada: curso.jornada,
      periodo_id: curso.periodo_id?.toString() || ''
    })
    setShowModal(true)
  }

  const handleToggleActive = async (curso: Curso) => {
    try {
      const { error } = await supabase
        .from('cursos')
        .update({ activo: !curso.activo })
        .eq('id', curso.id)

      if (error) throw error
      toast.success(`Curso ${curso.activo ? 'desactivado' : 'activado'}`)
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cambiar estado')
    }
  }

  const handleImport = async () => {
    try {
      const lines = importData.trim().split('\n')
      const cursosToImport = []

      for (const line of lines) {
        const [codigo, subnivel, curso, paralelo, jornada] = line.split(',').map(s => s.trim())
        if (codigo && subnivel && curso && paralelo) {
          cursosToImport.push({
            codigo,
            subnivel,
            curso,
            paralelo,
            jornada: jornada || 'Matutina',
            periodo_id: periodos.find(p => p.activo)?.id || null,
            activo: true
          })
        }
      }

      if (cursosToImport.length === 0) {
        toast.error('No se encontraron cursos válidos para importar')
        return
      }

      const { error } = await supabase
        .from('cursos')
        .insert(cursosToImport)

      if (error) throw error

      toast.success(`${cursosToImport.length} cursos importados correctamente`)
      setShowImportModal(false)
      setImportData('')
      loadData()
    } catch (error: any) {
      console.error('Error:', error)
      if (error.code === '23505') {
        toast.error('Algunos códigos ya existen en la base de datos')
      } else {
        toast.error('Error al importar cursos')
      }
    }
  }

  const generateCodigo = () => {
    if (formData.subnivel && formData.curso && formData.paralelo) {
      const subnivelCode = formData.subnivel.substring(0, 3).toUpperCase()
      const cursoCode = formData.curso.split(' ')[0].substring(0, 3).toUpperCase()
      const code = `${subnivelCode}-${cursoCode}-${formData.paralelo}`
      setFormData({ ...formData, codigo: code })
    }
  }

  const resetForm = () => {
    setFormData({
      codigo: '',
      subnivel: '',
      curso: '',
      paralelo: '',
      jornada: 'Matutina',
      periodo_id: ''
    })
    setEditingCurso(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  const activePeriod = periodos.find(p => p.activo)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-purple-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold">Gestión de Cursos</h1>
              <button
                onClick={() => router.push('/vicerrector')}
                className="text-purple-200 hover:text-white text-sm mt-1"
              >
                ← Volver al dashboard
              </button>
            </div>
            <div className="space-x-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-800"
              >
                📥 Importar
              </button>
              <button
                onClick={() => {
                  resetForm()
                  setShowModal(true)
                }}
                className="bg-white text-purple-700 px-4 py-2 rounded hover:bg-purple-50"
              >
                ➕ Nuevo Curso
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Period Alert */}
        {activePeriod && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Período Activo:</span> {activePeriod.nombre} 
              ({new Date(activePeriod.fecha_inicio).toLocaleDateString()} - {new Date(activePeriod.fecha_fin).toLocaleDateString()})
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Cursos</p>
            <p className="text-2xl font-bold">{cursos.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Activos</p>
            <p className="text-2xl font-bold text-green-600">
              {cursos.filter(c => c.activo).length}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Matutina</p>
            <p className="text-2xl font-bold text-blue-600">
              {cursos.filter(c => c.jornada === 'Matutina').length}
            </p>
          </div>
          <div className="bg-orange-50 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Vespertina</p>
            <p className="text-2xl font-bold text-orange-600">
              {cursos.filter(c => c.jornada === 'Vespertina').length}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Paralelos</p>
            <p className="text-2xl font-bold text-purple-600">
              {new Set(cursos.map(c => c.paralelo)).size}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subnivel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Curso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paralelo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jornada
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cursos.map((curso) => (
                <tr key={curso.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {curso.codigo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {curso.subnivel}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {curso.curso}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="px-2 py-1 bg-gray-100 rounded">
                      {curso.paralelo}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {curso.jornada}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      curso.activo
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {curso.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(curso)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(curso)}
                      className={`${
                        curso.activo
                          ? 'text-red-600 hover:text-red-900'
                          : 'text-green-600 hover:text-green-900'
                      }`}
                    >
                      {curso.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal de Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">
              {editingCurso ? 'Editar Curso' : 'Nuevo Curso'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subnivel *
                </label>
                <select
                  value={formData.subnivel}
                  onChange={(e) => {
                    setFormData({ 
                      ...formData, 
                      subnivel: e.target.value,
                      curso: '' // Reset curso when subnivel changes
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {subniveles.map(subnivel => (
                    <option key={subnivel} value={subnivel}>{subnivel}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Curso *
                </label>
                <select
                  value={formData.curso}
                  onChange={(e) => {
                    setFormData({ ...formData, curso: e.target.value })
                    // Auto-generate código when all fields are filled
                    setTimeout(() => generateCodigo(), 100)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                  disabled={!formData.subnivel}
                >
                  <option value="">Seleccionar...</option>
                  {formData.subnivel && cursosOptions[formData.subnivel as keyof typeof cursosOptions]?.map(curso => (
                    <option key={curso} value={curso}>{curso}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paralelo *
                </label>
                <select
                  value={formData.paralelo}
                  onChange={(e) => {
                    setFormData({ ...formData, paralelo: e.target.value })
                    setTimeout(() => generateCodigo(), 100)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {paralelos.map(paralelo => (
                    <option key={paralelo} value={paralelo}>{paralelo}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jornada *
                </label>
                <select
                  value={formData.jornada}
                  onChange={(e) => setFormData({ ...formData, jornada: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  {jornadas.map(jornada => (
                    <option key={jornada} value={jornada}>{jornada}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código *
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={generateCodigo}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    title="Generar código automático"
                  >
                    🔄
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Se genera automáticamente o puede editarlo manualmente
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Período Académico
                </label>
                <select
                  value={formData.periodo_id}
                  onChange={(e) => setFormData({ ...formData, periodo_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Sin período asignado</option>
                  {periodos.map(periodo => (
                    <option key={periodo.id} value={periodo.id}>
                      {periodo.nombre} {periodo.activo && '(Activo)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  {editingCurso ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Importar */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4">Importar Cursos</h2>
            <p className="text-sm text-gray-600 mb-4">
              Formato: CÓDIGO,SUBNIVEL,CURSO,PARALELO,JORNADA (un curso por línea)
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Ejemplo: BAS-SEG-A,Básica Elemental,Segundo de Básica,A,Matutina
            </p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              placeholder="CÓDIGO,SUBNIVEL,CURSO,PARALELO,JORNADA
BAS-SEG-A,Básica Elemental,Segundo de Básica,A,Matutina
BAS-SEG-B,Básica Elemental,Segundo de Básica,B,Matutina
BAS-TER-A,Básica Elemental,Tercero de Básica,A,Matutina"
            />
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false)
                  setImportData('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}