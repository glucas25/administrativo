'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function TestLogin() {
  const [email, setEmail] = useState('vicerrector@tuinstitucion.edu.ec')
  const [password, setPassword] = useState('password123')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      setResult({ data, error })
    } catch (err: any) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Login Directo</h1>
      
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block mb-1">Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div>
          <label className="block mb-1">Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <button
          onClick={handleLogin}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Probando...' : 'Probar Login'}
        </button>
        
        {result && (
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
