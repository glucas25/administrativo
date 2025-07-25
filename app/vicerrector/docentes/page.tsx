// app/vicerrector/docentes/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Usuario } from '@/types/database'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Docente extends Usuario {}

export default function DocentesPage() {
  const router = useRouter()
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingDocente, setEditingDocente] = useState<Docente | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    correo: '',
    password: '',
    cedula: '',
    apellidos: '',
    nombres: ''
  })

  useEffect(() => {
    checkAuth()
    loadDocentes()
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

  async function loadDocentes() {
    try {
      // Obtener docentes desde la vista usuarios_completos
      const { data, error } = await supabase
        .from('usuarios_completos')
        .select('*')
        .eq('rol', 'docente')

      if (error) throw error

      const processed = (data || []).map((d: any) => ({
        ...d,
        nombre_completo: d.nombre_completo || `${d.apellidos ?? ''} ${d.nombres ?? ''}`.trim()
      }))

      setDocentes(processed)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar docentes')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingDocente) {
        // Buscar usuario por correo
        const { data: existingUser, error: userError } = await supabase
          .from('usuarios_completos')
          .select('id, rol')
          .eq('correo', formData.correo)
          .maybeSingle();
        if (userError) throw userError;

        // Si existe otro usuario con ese correo y no es el que estamos editando
        if (existingUser && existingUser.id !== editingDocente.id && existingUser.rol === 'docente') {
          toast.error('Ya existe un docente con este correo');
          setSubmitting(false);
          return;
        }

        // Actualizar el perfil
        const { error: perfilError } = await supabase
          .from('perfiles_docentes')
          .update({
            cedula: formData.cedula || null,
            apellidos: formData.apellidos,
            nombres: formData.nombres,
            rol: 'docente',
            activo: true
          })
          .eq('user_id', editingDocente.id);

        if (perfilError) {
          toast.error('Error al guardar cambios: ' + perfilError.message);
          setSubmitting(false);
          return;
        }
        toast.success('Docente actualizado correctamente');
        resetForm();
        loadDocentes();
        setSubmitting(false);
        return;
      }
      // 1. Buscar usuario por correo
      const { data: existingUser, error: userError } = await supabase
        .from('usuarios_completos')
        .select('id, rol')
        .eq('correo', formData.correo)
        .maybeSingle();
      if (userError) throw userError;

      if (!existingUser) {
        // 2. No existe: crear usuario con Supabase Auth
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.correo,
          password: formData.password
        });
        if (signUpError) {
          toast.error('Error al crear usuario: ' + signUpError.message);
          setSubmitting(false);
          return;
        }
        // 3. Completar perfil en perfiles_docentes
        const userId = signUpData?.user?.id;
        if (userId) {
          const { error: perfilError } = await supabase
            .from('perfiles_docentes')
            .update({
              cedula: formData.cedula || null,
              apellidos: formData.apellidos,
              nombres: formData.nombres,
              rol: 'docente',
              activo: true
            })
            .eq('user_id', userId);
          if (perfilError) {
            toast.error('Usuario creado, pero error al completar perfil: ' + perfilError.message);
            setSubmitting(false);
            return;
          }
        }
        toast.success('Docente creado exitosamente');
      } else if (existingUser.rol === 'docente') {
        // 4. Ya es docente
        toast.error('Ya existe un docente con este correo');
        setSubmitting(false);
        return;
      } else {
        // 5. Existe pero no es docente: actualizar perfil
        const { error: perfilError } = await supabase
          .from('perfiles_docentes')
          .update({
            cedula: formData.cedula || null,
            apellidos: formData.apellidos,
            nombres: formData.nombres,
            rol: 'docente',
            activo: true
          })
          .eq('user_id', existingUser.id);
        if (perfilError) {
          toast.error('Error al asignar rol docente: ' + perfilError.message);
          setSubmitting(false);
          return;
        }
        toast.success('Rol docente asignado exitosamente');
      }
      resetForm();
      loadDocentes();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar docente');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleDocenteActivo(docente: Docente) {
    try {
      const { error } = await supabase
        .from('perfiles_docentes')
        .update({ activo: !docente.activo })
        .eq('user_id', docente.id)

      if (error) throw error
      toast.success(docente.activo ? 'Docente desactivado' : 'Docente activado')
      loadDocentes()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cambiar estado')
    }
  }

  async function deleteDocente(docente: Docente) {
    if (!confirm(`¿Está seguro de eliminar al docente "${docente.apellidos} ${docente.nombres}"?`)) {
      return
    }

    try {
      // Primero verificar si tiene documentos asociados
      const { count } = await supabase
        .from('documentos')
        .select('*', { count: 'exact', head: true })
        .eq('docente_id', docente.id)

      if (count && count > 0) {
        toast.error('No se puede eliminar el docente porque tiene documentos asociados')
        return
      }

      // Eliminar de perfiles_docentes
      const { error } = await supabase
        .from('perfiles_docentes')
        .delete()
        .eq('user_id', docente.id)

      if (error) throw error
      
      toast.success('Docente eliminado correctamente')
      loadDocentes()
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error al eliminar docente')
    }
  }

  function resetForm() {
    setFormData({
      correo: '',
      password: '',
      cedula: '',
      apellidos: '',
      nombres: ''
    })
    setEditingDocente(null)
    setShowModal(false)
  }

  function editDocente(docente: Docente) {
    setEditingDocente(docente)
    setFormData({
      correo: docente.correo || '',
      password: '',
      cedula: docente.cedula || '',
      apellidos: docente.apellidos || '',
      nombres: docente.nombres || ''
    })
    setShowModal(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Gestión de Docentes
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
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              ➕ Nuevo Docente
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Docentes</p>
            <p className="text-2xl font-bold">{docentes.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Activos</p>
            <p className="text-2xl font-bold text-green-600">
              {docentes.filter(d => d.activo).length}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Inactivos</p>
            <p className="text-2xl font-bold text-gray-600">
              {docentes.filter(d => !d.activo).length}
            </p>
          </div>
        </div>

        {/* Lista de docentes */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {docentes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg mb-4">No hay docentes registrados</p>
              <p>Crea el primer docente para empezar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Apellidos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombres
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Correo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cédula
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
                  {docentes.map((docente) => (
                    <tr key={docente.id} className={!docente.activo ? 'bg-gray-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {docente.apellidos}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {docente.nombres}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {docente.correo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {docente.cedula || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleDocenteActivo(docente)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            docente.activo ? 'bg-green-600' : 'bg-gray-200'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            docente.activo ? 'translate-x-6' : 'translate-x-1'
                          }`}/>
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => editDocente(docente)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteDocente(docente)}
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
          )}
        </div>
      </main>

      {/* Modal de formulario docente */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black bg-opacity-30" 
              onClick={() => !submitting && resetForm()}
            ></div>
            
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingDocente ? 'Editar Docente' : 'Nuevo Docente'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellidos *
                    </label>
                    <input 
                      type="text" 
                      value={formData.apellidos} 
                      onChange={(e) => setFormData({...formData, apellidos: e.target.value})} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" 
                      required 
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombres *
                    </label>
                    <input 
                      type="text" 
                      value={formData.nombres} 
                      onChange={(e) => setFormData({...formData, nombres: e.target.value})} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" 
                      required 
                      disabled={submitting}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correo Electrónico *
                  </label>
                  <input 
                    type="email" 
                    value={formData.correo} 
                    onChange={(e) => setFormData({...formData, correo: e.target.value})} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" 
                    required 
                    disabled={submitting}
                  />
                </div>
                
                {!editingDocente && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña *
                    </label>
                    <input 
                      type="password" 
                      value={formData.password} 
                      onChange={(e) => setFormData({...formData, password: e.target.value})} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" 
                      required={!editingDocente} 
                      minLength={6}
                      disabled={submitting}
                    />
                    <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cédula
                  </label>
                  <input 
                    type="text" 
                    value={formData.cedula} 
                    onChange={(e) => setFormData({...formData, cedula: e.target.value})} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" 
                    disabled={submitting}
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button 
                    type="button" 
                    onClick={resetForm} 
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center"
                    disabled={submitting}
                  >
                    {submitting && (
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {editingDocente ? 'Guardar Cambios' : 'Crear Docente'}
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
