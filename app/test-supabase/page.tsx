'use client'

import { useEffect, useState } from 'react'

export default function TestSupabase() {
  const [result, setResult] = useState<any>({ loading: true })

  useEffect(() => {
    testSupabase()
  }, [])

  async function testSupabase() {
    try {
      // Hacer una petición directa a Supabase
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/usuarios?select=*`,
        {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          }
        }
      )

      const data = await response.json()
      
      setResult({
        loading: false,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        data: data
      })

    } catch (error: any) {
      setResult({
        loading: false,
        error: error.message
      })
    }
  }

  if (result.loading) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Directo Supabase</h1>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-100 rounded">
          <p><strong>Status:</strong> {result.status}</p>
          <p><strong>Status Text:</strong> {result.statusText}</p>
          <p><strong>OK:</strong> {result.ok ? 'Sí' : 'No'}</p>
        </div>

        {result.error && (
          <div className="p-4 bg-red-100 rounded">
            <p className="text-red-700"><strong>Error:</strong> {result.error}</p>
          </div>
        )}

        <div className="p-4 bg-blue-100 rounded">
          <p className="font-bold mb-2">Respuesta:</p>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}