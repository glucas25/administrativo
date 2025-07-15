'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface TipoDocumento {
  id: number
  codigo: string
  nombre: string
  descripcion?: string
  requiere_revision: boolean
  requiere_asignatura: boolean
  tipos_archivo_permitidos?: string[]
  descripcion_tipos_archivo?: string
  activo: boolean
}

interface Asignatura {
  id: number
  codigo: string
  nombre: string
  activo: boolean
}

interface EntregaProgramada {
  id: number
  titulo: string
  descripcion?: string
  fecha_limite: string
  tipo_documento_id: number
  tipo_documento?: TipoDocumento
}

export default function SubirDocumentoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([])
  const [entregas, setEntregas] = useState<EntregaProgramada[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    tipo_documento_id: '',
    entrega_id: '',
    asignatura_id: '',
    observaciones: ''
  })

  useEffect(() => {
    checkAuth()
    loadOptions()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }
    // Validar rol
    const { data: userData } = await supabase.rpc('obtener_perfil_usuario', { p_user_id: user.id })
    const rol = (userData && userData[0]?.rol) ? userData[0].rol.toLowerCase().trim() : '';
    if (rol !== 'docente') {
      router.push('/vicerrector')
    }
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
          .select(`
            *,
            tipo_documento:tipos_documento(*)
          `)
          .eq('periodo_id', periodo.id)
          .eq('activo', true)
        setEntregas(entregasData || [])
      }
    } catch (error) {
      console.error('Error loading options:', error)
      toast.error('No se pudo cargar información')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    setFile(selected)
    
    // Validar tipo de archivo si se ha seleccionado un tipo de documento
    if (selected && formData.tipo_documento_id) {
      validateFileType(selected, parseInt(formData.tipo_documento_id))
    }
  }

  const validateFileType = (file: File, tipoDocumentoId: number) => {
    const tipoDocumento = tiposDocumento.find(t => t.id === tipoDocumentoId)
    if (!tipoDocumento || !tipoDocumento.tipos_archivo_permitidos) {
      return true // Si no hay restricciones, permitir
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension) {
      toast.error('Archivo sin extensión válida')
      setFile(null)
      return false
    }

    if (!tipoDocumento.tipos_archivo_permitidos.includes(extension)) {
      toast.error(`Tipo de archivo no permitido. Tipos permitidos: ${tipoDocumento.descripcion_tipos_archivo || tipoDocumento.tipos_archivo_permitidos.join(', ')}`)
      setFile(null)
      return false
    }

    return true
  }

  const handleTipoDocumentoChange = (tipoDocumentoId: string) => {
    setFormData({ ...formData, tipo_documento_id: tipoDocumentoId })
    
    // Si ya hay un archivo seleccionado, validarlo
    if (file && tipoDocumentoId) {
      validateFileType(file, parseInt(tipoDocumentoId))
    }
  }

  const getTiposArchivoPermitidos = (tipoDocumentoId: number) => {
    const tipoDocumento = tiposDocumento.find(t => t.id === tipoDocumentoId)
    if (!tipoDocumento || !tipoDocumento.tipos_archivo_permitidos) {
      return 'Todos los tipos de archivo'
    }
    return tipoDocumento.descripcion_tipos_archivo || tipoDocumento.tipos_archivo_permitidos.join(', ')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast.error('Seleccione un archivo')
      return
    }

    if (!formData.tipo_documento_id) {
      toast.error('Seleccione un tipo de documento')
      return
    }

    // Validar tipo de archivo
    if (!validateFileType(file, parseInt(formData.tipo_documento_id))) {
      return
    }

    setUploading(true)
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('tipo_documento_id', formData.tipo_documento_id);
      if (formData.entrega_id) formDataUpload.append('entrega_id', formData.entrega_id);
      if (formData.asignatura_id) formDataUpload.append('asignatura_id', formData.asignatura_id);
      if (formData.observaciones) formDataUpload.append('observaciones', formData.observaciones);
      // Obtener usuario y periodo activo
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');
      formDataUpload.append('docente_id', user.id);
      const { data: periodo } = await supabase.from('periodos_academicos').select('id').eq('activo', true).single();
      if (!periodo) throw new Error('No hay periodo activo');
      formDataUpload.append('periodo_id', periodo.id);
      const uploadRes = await fetch('/api/documentos/upload', {
        method: 'POST',
        body: formDataUpload
      });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.success) {
        throw new Error(uploadJson.error || 'Error subiendo archivo');
      }
      toast.success('Documento subido y registrado correctamente');
      setFormData({
        tipo_documento_id: '',
        entrega_id: '',
        asignatura_id: '',
        observaciones: ''
      });
      setFile(null);
    } catch (error) {
      console.error('Error subiendo documento:', error);
      toast.error('Error al subir documento');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-purple-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold">Subir Documento</h1>
              <button
                onClick={() => router.push('/docente')}
                className="text-purple-200 hover:text-white text-sm mt-1"
              >
                ← Volver al dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Subir Nuevo Documento</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo de Documento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Documento *
              </label>
              <select
                value={formData.tipo_documento_id}
                onChange={(e) => handleTipoDocumentoChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                required
              >
                <option value="">Seleccione un tipo de documento</option>
                {tiposDocumento.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
              {formData.tipo_documento_id && (
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Tipos de archivo permitidos:</strong> {getTiposArchivoPermitidos(parseInt(formData.tipo_documento_id))}
                </div>
              )}
            </div>

            {/* Entrega Programada (Opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entrega Programada (Opcional)
              </label>
              <select
                value={formData.entrega_id}
                onChange={(e) => setFormData({...formData, entrega_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Sin entrega programada</option>
                {entregas.map((entrega) => (
                  <option key={entrega.id} value={entrega.id}>
                    {entrega.titulo} - {entrega.tipo_documento?.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Asignatura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asignatura *
              </label>
              <select
                value={formData.asignatura_id}
                onChange={(e) => setFormData({...formData, asignatura_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                required
              >
                <option value="">Seleccione una asignatura</option>
                {asignaturas.map((asignatura) => (
                  <option key={asignatura.id} value={asignatura.id}>
                    {asignatura.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Archivo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo *
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.zip,.rar"
                required
              />
              {file && (
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Archivo seleccionado:</strong> {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
              {formData.tipo_documento_id && file && (
                <div className="mt-2 text-sm text-green-600">
                  ✓ Tipo de archivo válido para este documento
                </div>
              )}
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones (Opcional)
              </label>
              <textarea
                value={formData.observaciones}
                onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                rows={3}
                placeholder="Observaciones adicionales sobre el documento..."
              />
            </div>

            {/* Botón de envío */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={uploading}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {uploading ? 'Subiendo...' : 'Subir Documento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
