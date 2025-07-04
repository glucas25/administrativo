// app/vicerrector/asignaturas/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Asignatura } from '@/types/database'
import toast from 'react-hot-toast'

export default function AsignaturasPage() {
  const router = useRouter()
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAsignatura, setEditingAsignatura] = useState<Asignatura | null>(null)
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    tipo: '',
    area: ''
  })
  const [showImportModal, setShowImportModal] = useState(false)
  const [importData, setImportData] = useState('')

  useEffect(() => {
    checkAuth()
    loadAsignaturas()
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

  const loadAsignaturas = async () => {
    try {
      const { data, error } = await supabase
        .from('asignaturas')
        .select('*')
        .order('nombre', { ascending: true })

      if (error) throw error
      setAsignaturas(data || [])
    } catch (error) {
      console.error('Error loading asignaturas:', error)
      toast.error('Error al cargar asignaturas')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingAsignatura) {
        // Actualizar
        const { error } = await supabase
          .from('asignaturas')
          .update({
            codigo: formData.codigo,
            nombre: formData.nombre,
            tipo: formData.tipo,
            area: formData.area
          })
          .eq('id', editingAsignatura.id)

        if (error) throw error
        toast.success('Asignatura actualizada correctamente')
      } else {
        // Crear nueva
        const { error } = await supabase
          .from('asignaturas')
          .insert([{
            codigo: formData.codigo,
            nombre: formData.nombre,
            tipo: formData.tipo,
            area: formData.area,
            activo: true
          }])

        if (error) throw error
        toast.success('Asignatura creada correctamente')
      }

      setShowModal(false)
      resetForm()
      loadAsignaturas()
    } catch (error: any) {
      console.error('Error:', error)
      if (error.code === '23505') {
        toast.error('El código de asignatura ya existe')
      } else {
        toast.error('Error al guardar asignatura')
      }
    }
  }

  const handleEdit = (asignatura: Asignatura) => {
    setEditingAsignatura(asignatura)
    setFormData({
      codigo: asignatura.codigo,
      nombre: asignatura.nombre,
      tipo: asignatura.tipo || '',
      area: asignatura.area || ''
    })
    setShowModal(true)
  }

  const handleToggleActive = async (asignatura: Asignatura) => {
    try {
      const { error } = await supabase
        .from('asignaturas')
        .update({ activo: !asignatura.activo })
        .eq('id', asignatura.id)

      if (error) throw error
      toast.success(`Asignatura ${asignatura.activo ? 'desactivada' : 'activada'}`)
      loadAsignaturas()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cambiar estado')
    }
  }

  const handleImport = async () => {
    try {
      const lines = importData.trim().split('\n')
      const asignaturasToImport = []

      for (const line of lines) {
        const [codigo, nombre, tipo, area] = line.split(',').map(s => s.trim())
        if (codigo && nombre) {
          asignaturasToImport.push({
            codigo,
            nombre,
            tipo: tipo || null,
            area: area || null,
            activo: true
          })
        }
      }

      if (asignaturasToImport.length === 0) {
        toast.error('No se encontraron asignaturas válidas para importar')
        return
      }

      const { error } = await supabase
        .from('asignaturas')
        .insert(asignaturasToImport)

      if (error) throw error

      toast.success(`${asignaturasToImport.length} asignaturas importadas correctamente`)
      setShowImportModal(false)
      setImportData('')
      loadAsignaturas()
    } catch (error: any) {
      console.error('Error:', error)
      if (error.code === '23505') {
        toast.error('Algunos códigos ya existen en la base de datos')
      } else {
        toast.error('Error al importar asignaturas')
      }
    }
  }

  const resetForm = () => {
    setFormData({ codigo: '', nombre: '', tipo: '', area: '' })
    setEditingAsignatura(null)
  }

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
              <h1 className="text-2xl font-bold">Gestión de Asignaturas</h1>
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
                ➕ Nueva Asignatura
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Asignaturas</p>
            <p className="text-2xl font-bold">{asignaturas.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Activas</p>
            <p className="text-2xl font-bold text-green-600">
              {asignaturas.filter(a => a.activo).length}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Inactivas</p>
            <p className="text-2xl font-bold text-gray-600">
              {asignaturas.filter(a => !a.activo).length}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Áreas</p>
            <p className="text-2xl font-bold text-blue-600">
              {new Set(asignaturas.map(a => a.area).filter(Boolean)).size}
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
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Área
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
              {asignaturas.map((asignatura) => (
                <tr key={asignatura.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {asignatura.codigo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {asignatura.nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {asignatura.tipo || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {asignatura.area || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      asignatura.activo
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {asignatura.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(asignatura)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(asignatura)}
                      className={`${
                        asignatura.activo
                          ? 'text-red-600 hover:text-red-900'
                          : 'text-green-600 hover:text-green-900'
                      }`}
                    >
                      {asignatura.activo ? 'Desactivar' : 'Activar'}
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
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-6">
              {editingAsignatura ? 'Editar Asignatura' : 'Nueva Asignatura'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo
                </label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Básica">Básica</option>
                  <option value="Complementaria">Complementaria</option>
                  <option value="Optativa">Optativa</option>
                  <option value="Especialidad">Especialidad</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Área
                </label>
                <select
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Ciencias Exactas">Ciencias Exactas</option>
                  <option value="Ciencias Naturales">Ciencias Naturales</option>
                  <option value="Ciencias Sociales">Ciencias Sociales</option>
                  <option value="Lengua y Literatura">Lengua y Literatura</option>
                  <option value="Idiomas">Idiomas</option>
                  <option value="Educación Física">Educación Física</option>
                  <option value="Educación Artística">Educación Artística</option>
                  <option value="Tecnología">Tecnología</option>
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
                  {editingAsignatura ? 'Actualizar' : 'Crear'}
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
            <h2 className="text-xl font-bold mb-4">Importar Asignaturas</h2>
            <p className="text-sm text-gray-600 mb-4">
              Formato: CÓDIGO,NOMBRE,TIPO,ÁREA (una asignatura por línea)
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Ejemplo: MAT101,Matemáticas Básicas,Básica,Ciencias Exactas
            </p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              placeholder="CÓDIGO,NOMBRE,TIPO,ÁREA
LEN101,Lengua y Literatura I,Básica,Lengua y Literatura
MAT101,Matemáticas I,Básica,Ciencias Exactas
CCNN101,Ciencias Naturales I,Básica,Ciencias Naturales"
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