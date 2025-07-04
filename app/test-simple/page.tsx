'use client'

export default function TestSimple() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Simple de Variables</h1>
      <p>URL: {supabaseUrl || 'NO DEFINIDA'}</p>
      <p>Key existe: {supabaseKey ? 'SÍ' : 'NO'}</p>
      <p>Longitud de key: {supabaseKey?.length || 0}</p>
    </div>
  )
}