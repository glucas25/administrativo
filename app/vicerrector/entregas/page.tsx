'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { EntregaProgramada, TipoDocumento, PeriodoAcademico } from '@/types/database'
import toast from 'react-hot-toast'

export default function EntregasProgramadasPage() {
  const router = useRouter()
  const [entregas, setEntregas] = useState<EntregaProgramada[]>([])
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])
  const [periodos, setPeriodos] = useState<PeriodoAcademico[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEntrega, setEditingEntrega] = useState<EntregaProgramada | null>(null)
  const [formData, setFormData] = useState({
    tipo_documento_id: '',
    periodo_id: '',
    titulo: '',
    descripcion: '',
    fecha_inicio: '',
    fecha_limite: '',
    es_obligatorio: false,
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
      .rpc('obtener_perfil_usuario', { p_user_id: user.id })

    const rol = (userData && userData[0]?.rol) ? userData[0].rol.toLowerCase().trim() : '';
    if (rol !== 'vicerrector') {
      router.push('/docente')
    }
  }

  const loadData = async () => {
    try {
      const { data: entregasData } = await supabase
        .from('entregas_programadas')
        .select(`*, tipo_documento:tipos_documento (nombre), periodo:periodos_academicos (nombre)`)
        .order('fecha_limite', { ascending: false })
      setEntregas(entregasData || [])

      const { data: tipos } = await supabase
        .from('tipos_documento')
        .select('*')
        .eq('activo', true)
        .order('nombre')
      setTiposDocumento(tipos || [])

      const { data: periodosData } = await supabase
        .from('periodos_academicos')
        .select('*')
        .order('fecha_inicio', { ascending: false })
      setPeriodos(periodosData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar entregas')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        tipo_documento_id: formData.tipo_documento_id ? parseInt(formData.tipo_documento_id) : null,
        periodo_id: formData.periodo_id ? parseInt(formData.periodo_id) : null,
        titulo: formData.titulo,
        descripcion: formData.descripcion,
        fecha_inicio: formData.fecha_inicio,
        fecha_limite: formData.fecha_limite,
        es_obligatorio: formData.es_obligatorio,
        activo: true,
      }

      if (editingEntrega) {
        const { error } = await supabase
          .from('entregas_programadas')
          .update(payload)
          .eq('id', editingEntrega.id)
        if (error) throw error
        toast.success('Entrega actualizada')
      } else {
        const { error } = await supabase
          .from('entregas_programadas')
          .insert([payload])
        if (error) throw error
        toast.success('Entrega creada')
      }

      setShowModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al guardar')
    }
  }

  const handleEdit = (entrega: EntregaProgramada) => {
    setEditingEntrega(entrega)
    setFormData({
      tipo_documento_id: entrega.tipo_documento_id.toString(),
      periodo_id: entrega.periodo_id.toString(),
      titulo: entrega.titulo,
      descripcion: entrega.descripcion || '',
      fecha_inicio: entrega.fecha_inicio,
      fecha_limite: entrega.fecha_limite,
      es_obligatorio: entrega.es_obligatorio,
    })
    setShowModal(true)
  }

  const handleDelete = async (entrega: EntregaProgramada) => {
    if (!confirm(`¿Eliminar entrega "${entrega.titulo}"?`)) return
    try {
      const { error } = await supabase
        .from('entregas_programadas')
        .delete()
        .eq('id', entrega.id)
      if (error) throw error
      toast.success('Entrega eliminada')
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al eliminar')
    }
  }

  const toggleActivo = async (entrega: EntregaProgramada) => {
    try {
      const { error } = await supabase
        .from('entregas_programadas')
        .update({ activo: !entrega.activo })
        .eq('id', entrega.id)
      if (error) throw error
      toast.success(`Entrega ${entrega.activo ? 'desactivada' : 'activada'}`)
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cambiar estado')
    }
  }

  const resetForm = () => {
    setFormData({
      tipo_documento_id: '',
      periodo_id: '',
      titulo: '',
      descripcion: '',
      fecha_inicio: '',
      fecha_limite: '',
      es_obligatorio: false,
    })
    setEditingEntrega(null)
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
              <h1 className="text-2xl font-bold">Entregas Programadas</h1>
              <button
                onClick={() => router.push('/vicerrector')}
                className="text-purple-200 hover:text-white text-sm mt-1"
              >
                ← Volver al dashboard
              </button>
            </div>
            <button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
              className="bg-white text-purple-700 px-4 py-2 rounded hover:bg-purple-50"
            >
              ➕ Nueva Entrega
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo Documento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Título
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Período
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Límite
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Obligatorio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entregas.map((entrega) => (
                <tr key={entrega.id} className={!entrega.activo ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entrega.tipo_documento?.nombre || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entrega.titulo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entrega.periodo?.nombre || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(entrega.fecha_inicio).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(entrega.fecha_limite).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      entrega.es_obligatorio ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {entrega.es_obligatorio ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleActivo(entrega)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        entrega.activo ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          entrega.activo ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(entrega)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(entrega)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entregas.length === 0 && (
            <div className="p-8 text-center text-gray-500">No hay entregas programadas</div>
          )}
        </div>
      </main>

      {/* Modal de Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black opacity-30" onClick={resetForm}></div>

            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingEntrega ? 'Editar Entrega Programada' : 'Nueva Entrega Programada'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Documento *
                  </label>
                  <select
                    value={formData.tipo_documento_id}
                    onChange={(e) => setFormData({ ...formData, tipo_documento_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    required
                  >
                    <option value="">Seleccione...</option>
                    {tiposDocumento.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Período Académico *
                  </label>
                  <select
                    value={formData.periodo_id}
                    onChange={(e) => setFormData({ ...formData, periodo_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    required
                  >
                    <option value="">Seleccione...</option>
                    {periodos.map((periodo) => (
                      <option key={periodo.id} value={periodo.id}>
                        {periodo.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                  <input
                    type="text"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inicio *</label>
                    <input
                      type="date"
                      value={formData.fecha_inicio}
                      onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Límite *</label>
                    <input
                      type="date"
                      value={formData.fecha_limite}
                      onChange={(e) => setFormData({ ...formData, fecha_limite: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.es_obligatorio}
                    onChange={(e) => setFormData({ ...formData, es_obligatorio: e.target.checked })}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Entrega obligatoria</span>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    {editingEntrega ? 'Guardar Cambios' : 'Crear Entrega'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
