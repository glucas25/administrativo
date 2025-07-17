// app/vicerrector/periodos/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { PeriodoAcademico } from '@/types/database'
import toast from 'react-hot-toast'

export default function PeriodosAcademicosPage() {
  const router = useRouter()
  const [periodos, setPeriodos] = useState<PeriodoAcademico[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPeriodo, setEditingPeriodo] = useState<PeriodoAcademico | null>(null)
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    fecha_inicio: '',
    fecha_fin: ''
  })

  useEffect(() => {
    checkAuth()
    loadPeriodos()
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

  const loadPeriodos = async () => {
    try {
      const { data, error } = await supabase
        .from('periodos_academicos')
        .select('*')
        .order('fecha_inicio', { ascending: false })

      if (error) throw error
      setPeriodos(data || [])
    } catch (error) {
      console.error('Error loading periodos:', error)
      toast.error('Error al cargar períodos')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar fechas
    if (new Date(formData.fecha_inicio) >= new Date(formData.fecha_fin)) {
      toast.error('La fecha de inicio debe ser anterior a la fecha de fin')
      return
    }

    try {
      const periodoData = {
        codigo: formData.codigo,
        nombre: formData.nombre,
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin,
        activo: false // Por defecto inactivo
      }

      if (editingPeriodo) {
        // Actualizar
        const { error } = await supabase
          .from('periodos_academicos')
          .update(periodoData)
          .eq('id', editingPeriodo.id)

        if (error) throw error
        toast.success('Período actualizado correctamente')
      } else {
        // Crear nuevo
        const { error } = await supabase
          .from('periodos_academicos')
          .insert([periodoData])

        if (error) throw error
        toast.success('Período creado correctamente')
      }

      setShowModal(false)
      resetForm()
      loadPeriodos()
    } catch (error: any) {
      console.error('Error:', error)
      if (error.code === '23505') {
        toast.error('El código de período ya existe')
      } else {
        toast.error('Error al guardar período')
      }
    }
  }

  const handleSetActive = async (periodo: PeriodoAcademico) => {
    try {
      // Primero desactivar todos los períodos
      const { error: deactivateError } = await supabase
        .from('periodos_academicos')
        .update({ activo: false })
        .neq('id', periodo.id)

      if (deactivateError) throw deactivateError

      // Luego activar el período seleccionado
      const { error: activateError } = await supabase
        .from('periodos_academicos')
        .update({ activo: true })
        .eq('id', periodo.id)

      if (activateError) throw activateError

      toast.success(`Período ${periodo.nombre} activado`)
      loadPeriodos()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al activar período')
    }
  }

  const handleEdit = (periodo: PeriodoAcademico) => {
    setEditingPeriodo(periodo)
    setFormData({
      codigo: periodo.codigo,
      nombre: periodo.nombre,
      fecha_inicio: periodo.fecha_inicio,
      fecha_fin: periodo.fecha_fin
    })
    setShowModal(true)
  }

  const handleDelete = async (periodo: PeriodoAcademico) => {
    if (!confirm(`¿Está seguro de eliminar el período ${periodo.nombre}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('periodos_academicos')
        .delete()
        .eq('id', periodo.id)

      if (error) throw error
      toast.success('Período eliminado correctamente')
      loadPeriodos()
    } catch (error: any) {
      console.error('Error:', error)
      if (error.code === '23503') {
        toast.error('No se puede eliminar el período porque tiene datos asociados')
      } else {
        toast.error('Error al eliminar período')
      }
    }
  }

  const generateCodigo = () => {
    if (formData.fecha_inicio) {
      const year = new Date(formData.fecha_inicio).getFullYear()
      const nextYear = year + 1
      setFormData({ ...formData, codigo: `${year}-${nextYear}` })
    }
  }

  const resetForm = () => {
    setFormData({
      codigo: '',
      nombre: '',
      fecha_inicio: '',
      fecha_fin: ''
    })
    setEditingPeriodo(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  const activePeriodo = periodos.find(p => p.activo)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Períodos Académicos
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
            <button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              ➕ Nuevo Período
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Period Alert */}
        {activePeriodo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <span className="text-2xl mr-3">✅</span>
              <div>
                <p className="text-sm font-medium text-green-800">Período Activo Actual</p>
                <p className="text-lg text-green-900">{activePeriodo.nombre}</p>
                <p className="text-sm text-green-700">
                  {new Date(activePeriodo.fecha_inicio).toLocaleDateString()} - {new Date(activePeriodo.fecha_fin).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Periods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {periodos.map((periodo) => (
            <div
              key={periodo.id}
              className={`bg-white rounded-lg shadow-md overflow-hidden ${
                periodo.activo ? 'ring-2 ring-green-500' : ''
              }`}
            >
              <div className={`p-4 ${periodo.activo ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">{periodo.nombre}</h3>
                  {periodo.activo && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      Activo
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">Código: {periodo.codigo}</p>
              </div>
              
              <div className="p-4">
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm">
                    <span className="text-gray-500 w-20">Inicio:</span>
                    <span>{new Date(periodo.fecha_inicio).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="text-gray-500 w-20">Fin:</span>
                    <span>{new Date(periodo.fecha_fin).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="text-gray-500 w-20">Duración:</span>
                    <span>
                      {Math.ceil(
                        (new Date(periodo.fecha_fin).getTime() - new Date(periodo.fecha_inicio).getTime()) / 
                        (1000 * 60 * 60 * 24)
                      )} días
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  {!periodo.activo && (
                    <button
                      onClick={() => handleSetActive(periodo)}
                      className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700"
                    >
                      Activar
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(periodo)}
                    className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
                  >
                    Editar
                  </button>
                  {!periodo.activo && (
                    <button
                      onClick={() => handleDelete(periodo)}
                      className="flex-1 bg-red-600 text-white py-2 px-3 rounded text-sm hover:bg-red-700"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {periodos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No hay períodos académicos registrados</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700"
            >
              Crear primer período
            </button>
          </div>
        )}
      </main>

      {/* Modal de Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-6">
              {editingPeriodo ? 'Editar Período' : 'Nuevo Período Académico'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Período *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Ej: Año Lectivo 2024-2025"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Inicio *
                </label>
                <input
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={(e) => {
                    setFormData({ ...formData, fecha_inicio: e.target.value })
                    setTimeout(() => generateCodigo(), 100)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Fin *
                </label>
                <input
                  type="date"
                  value={formData.fecha_fin}
                  onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código *
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Ej: 2024-2025"
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
                  Se genera automáticamente basado en la fecha de inicio
                </p>
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
                  {editingPeriodo ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
