'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface TipoDocumento {
  id: number
  codigo: string
  nombre: string
  descripcion: string
  requiere_revision: boolean
  requiere_asignatura: boolean
  activo: boolean
  fecha_creacion: string
}

export default function TiposDocumentoPage() {
  const [tipos, setTipos] = useState<TipoDocumento[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTipo, setEditingTipo] = useState<TipoDocumento | null>(null)
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    requiere_revision: true,
    requiere_asignatura: true
  })

  useEffect(() => {
    loadTiposDocumento()
  }, [])

  async function loadTiposDocumento() {
    try {
      const { data, error } = await supabase
        .from('tipos_documento')
        .select('*')
        .order('nombre', { ascending: true })

      if (error) throw error
      setTipos(data || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar tipos de documento')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      if (editingTipo) {
        // Actualizar
        const { error } = await supabase
          .from('tipos_documento')
          .update({
            codigo: formData.codigo,
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            requiere_revision: formData.requiere_revision,
            requiere_asignatura: formData.requiere_asignatura
          })
          .eq('id', editingTipo.id)

        if (error) throw error
        toast.success('Tipo de documento actualizado')
      } else {
        // Crear nuevo
        const { error } = await supabase
          .from('tipos_documento')
          .insert([{
            ...formData,
            activo: true
          }])

        if (error) throw error
        toast.success('Tipo de documento creado')
      }

      resetForm()
      loadTiposDocumento()
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar')
    }
  }

  async function toggleActivo(tipo: TipoDocumento) {
    try {
      const { error } = await supabase
        .from('tipos_documento')
        .update({ activo: !tipo.activo })
        .eq('id', tipo.id)

      if (error) throw error
      toast.success(tipo.activo ? 'Tipo desactivado' : 'Tipo activado')
      loadTiposDocumento()
    } catch (error) {
      toast.error('Error al cambiar estado')
    }
  }

  async function deleteTipo(tipo: TipoDocumento) {
    if (!confirm(`¿Está seguro de eliminar el tipo "${tipo.nombre}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('tipos_documento')
        .delete()
        .eq('id', tipo.id)

      if (error) throw error
      toast.success('Tipo de documento eliminado')
      loadTiposDocumento()
    } catch (error: any) {
      if (error.code === '23503') {
        toast.error('No se puede eliminar: Este tipo tiene documentos asociados')
      } else {
        toast.error('Error al eliminar')
      }
    }
  }

  function resetForm() {
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      requiere_revision: true,
      requiere_asignatura: true
    })
    setEditingTipo(null)
    setShowModal(false)
  }

  function editTipo(tipo: TipoDocumento) {
    setEditingTipo(tipo)
    setFormData({
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion || '',
      requiere_revision: tipo.requiere_revision,
      requiere_asignatura: tipo.requiere_asignatura
    })
    setShowModal(true)
  }

  if (loading) {
    return <div className="animate-pulse">Cargando tipos de documento...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tipos de Documento</h1>
          <p className="mt-2 text-gray-600">Gestiona los tipos de documento que los docentes pueden subir</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center space-x-2"
        >
          <span>➕</span>
          <span>Nuevo Tipo</span>
        </button>
      </div>

      {/* Lista de tipos */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {tipos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg mb-4">No hay tipos de documento creados</p>
            <p>Crea el primer tipo de documento para empezar</p>
          </div>
        ) : (
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
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Opciones
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
              {tipos.map((tipo) => (
                <tr key={tipo.id} className={!tipo.activo ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {tipo.codigo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tipo.nombre}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {tipo.descripcion || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col space-y-1">
                      <span className={`inline-flex px-2 py-1 text-xs rounded ${
                        tipo.requiere_revision ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tipo.requiere_revision ? '✓ Requiere revisión' : '✗ Sin revisión'}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs rounded ${
                        tipo.requiere_asignatura ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tipo.requiere_asignatura ? '✓ Con asignatura' : '✗ Sin asignatura'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleActivo(tipo)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        tipo.activo ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        tipo.activo ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => editTipo(tipo)}
                      className="text-purple-600 hover:text-purple-900 mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteTipo(tipo)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de formulario */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black opacity-30" onClick={resetForm}></div>
            
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingTipo ? 'Editar Tipo de Documento' : 'Nuevo Tipo de Documento'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({...formData, codigo: e.target.value.toUpperCase()})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    placeholder="Ej: PLAN_DIAG"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Ej: Planificación de Diagnóstico"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    rows={3}
                    placeholder="Descripción del tipo de documento..."
                  />
                </div>

                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.requiere_revision}
                      onChange={(e) => setFormData({...formData, requiere_revision: e.target.checked})}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Requiere revisión del vicerrector
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.requiere_asignatura}
                      onChange={(e) => setFormData({...formData, requiere_asignatura: e.target.checked})}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Requiere especificar asignatura
                    </span>
                  </label>
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
                    {editingTipo ? 'Guardar Cambios' : 'Crear Tipo'}
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
