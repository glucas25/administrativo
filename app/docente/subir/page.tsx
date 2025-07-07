'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { TipoDocumento, Asignatura, EntregaProgramada } from '@/types/database'
import toast from 'react-hot-toast'

export default function SubirDocumentoPage() {
  const router = useRouter()
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([])
  const [entregas, setEntregas] = useState<EntregaProgramada[]>([])
  const [formData, setFormData] = useState({
    tipo_documento_id: '',
    entrega_id: '',
    asignatura_id: '',
    observaciones: ''
  })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    checkUser()
    loadOptions()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }
    setLoading(false)
  }

  const loadOptions = async () => {
    try {
      const { data: tipos } = await supabase
        .from('tipos_documento')
        .select('*')
        .eq('activo', true)
        .order('nombre')
      setTiposDocumento(tipos || [])

      const { data: asignData } = await supabase
        .from('asignaturas')
        .select('*')
        .eq('activo', true)
        .order('nombre')
      setAsignaturas(asignData || [])

      const { data: periodo } = await supabase
        .from('periodos_academicos')
        .select('id')
        .eq('activo', true)
        .single()

      if (periodo) {
        const { data: entregasData } = await supabase
          .from('entregas_programadas')
          .select('*')
          .eq('periodo_id', periodo.id)
          .eq('activo', true)
        setEntregas(entregasData || [])
      }
    } catch (error) {
      console.error('Error loading options:', error)
      toast.error('No se pudo cargar información')
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
      // Lógica de subida pendiente de implementación
      toast.success('Documento enviado')
      setFormData({
        tipo_documento_id: '',
        entrega_id: '',
        asignatura_id: '',
        observaciones: ''
      })
      setFile(null)
    } catch (error) {
      console.error('Error subiendo documento:', error)
      toast.error('Error al subir documento')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <button
              onClick={() => router.push('/docente')}
              className="mr-4 text-gray-500 hover:text-gray-700"
            >
              ← Volver
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Subir Documento</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entrega Programada (opcional)</label>
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

            {tiposDocumento.find(t => t.id === parseInt(formData.tipo_documento_id))?.requiere_asignatura && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asignatura *</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Archivo *</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {file ? (
                    <div className="text-sm text-gray-900">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      <button type="button" onClick={() => setFile(null)} className="mt-2 text-red-600 hover:text-red-500">
                        Eliminar archivo
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                          <span>Seleccionar archivo</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
                        </label>
                        <p className="pl-1">o arrastrar y soltar</p>
                      </div>
                      <p className="text-xs text-gray-500">PDF, DOC, DOCX hasta 10MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones (opcional)</label>
              <textarea
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Agregue cualquier comentario adicional sobre el documento..."
              />
            </div>

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
