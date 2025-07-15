import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxeqczbdapzcgfonyptg.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4ZXFjemJkYXB6Y2dmb255cHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMzI4MTQsImV4cCI6MjA2NTcwODgxNH0.EnYSAwr0GDXr0ueROl8r8dnKoqTZt74Zr9fOv8nPuWs'

// Log automático para depuración
if (typeof window !== 'undefined') {
  console.log('[SUPABASE] URL:', supabaseUrl)
  console.log('[SUPABASE] ANON KEY:', supabaseAnonKey.slice(0, 10) + '...')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Exponer supabase en window para depuración
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}
