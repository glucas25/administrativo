'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function TestConnection() {
  const [status, setStatus] = useState<any>({
    loading: true,
    connected: false,
    error: null,
    users: []
  })

  useEffect(() => {
    testConnection()
  }, [])

  async function testConnection() {
    try {
      console.log('Iniciando prueba de conexión...')
      
      // Test 1: Verificar que Supabase esté configurado
      if (!supabase) {
        throw new Error('Supabase client no está configurado')
      }

      // Test 2: Intentar query simple
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
      
      console.log('Respuesta de Supabase:', { data, error })

      if (error) {
        setStatus({
          loading: false,
          connected: false,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          users: []
        })
      } else {
        setStatus({
          loading: false,
          connected: true,
          error: null,
          users: data || [],
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
        })
      }

    } catch (error: any) {
      console.error('Error en testConnection:', error)
      setStatus({
        loading: false,
        connected: false,
        error: error.message || 'Error desconocido',
        users: []
      })
    }
  }

  if (status.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl">Probando conexión...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Test de Conexión Supabase</h1>
      
      <div className="max-w-4xl space-y-4">
        {/* Estado de Conexión */}
        <div className={`p-6 rounded-lg border-2 ${status.connected ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
          <h2 className="text-xl font-bold mb-2">Estado de Conexión:</h2>
          <p className="text-lg">
            {status.connected ? '✅ Conectado exitosamente' : '❌ No conectado'}
          </p>
          {status.supabaseUrl && (
            <p className="text-sm text-gray-600 mt-2">
              URL: <code className="bg-gray-200 px-2 py-1 rounded">{status.supabaseUrl}</code>
            </p>
          )}
        </div>

        {/* Mostrar Error si existe */}
        {status.error && (
          <div className="p-6 rounded-lg border-2 border-red-500 bg-red-50">
            <h2 className="text-xl font-bold text-red-700 mb-2">Error Detectado:</h2>
            <p className="text-red-600 font-medium">{status.error}</p>
            {status.code && (
              <p className="text-sm text-red-500 mt-2">Código: {status.code}</p>
            )}
            {status.hint && (
              <p className="text-sm text-red-500 mt-1">Sugerencia: {status.hint}</p>
            )}
            {status.details && (
              <div className="mt-4">
                <p className="text-sm font-medium text-red-700">Detalles:</p>
                <pre className="mt-2 p-3 bg-red-100 rounded text-xs overflow-auto">
                  {JSON.stringify(status.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Mostrar usuarios si hay conexión */}
        {status.connected && status.users && status.users.length > 0 && (
          <div className="p-6 rounded-lg border-2 border-blue-500 bg-blue-50">
            <h2 className="text-xl font-bold mb-4">Usuarios en la Base de Datos:</h2>
            <div className="space-y-2">
              {status.users.map((user: any) => (
                <div key={user.id} className="p-3 bg-white rounded shadow">
                  <p className="font-medium">{user.nombre_completo}</p>
                  <p className="text-sm text-gray-600">{user.correo}</p>
                  <p className="text-sm text-gray-500">Rol: {user.rol}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Si no hay usuarios pero hay conexión */}
        {status.connected && (!status.users || status.users.length === 0) && (
          <div className="p-6 rounded-lg border-2 border-yellow-500 bg-yellow-50">
            <h2 className="text-xl font-bold text-yellow-700">⚠️ Advertencia</h2>
            <p className="text-yellow-600 mt-2">
              La conexión es exitosa pero no hay usuarios en la base de datos.
            </p>
            <p className="text-sm text-yellow-600 mt-1">
              Ejecuta el script SQL para crear el usuario inicial.
            </p>
          </div>
        )}

        {/* Información de Variables de Entorno */}
        <div className="p-6 rounded-lg border-2 border-gray-300 bg-gray-50">
          <h2 className="text-xl font-bold mb-2">Variables de Entorno:</h2>
          <div className="space-y-2 text-sm">
            <p>
              NEXT_PUBLIC_SUPABASE_URL: {' '}
              <code className="bg-gray-200 px-2 py-1 rounded">
                {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configurada' : '❌ No configurada'}
              </code>
            </p>
            <p>
              NEXT_PUBLIC_SUPABASE_ANON_KEY: {' '}
              <code className="bg-gray-200 px-2 py-1 rounded">
                {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ No configurada'}
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}