import { supabase } from '@/lib/supabase/client'

// Iniciar sesión usando Edge Function
export async function iniciarSesion(correo: string, password: string) {
  try {
    const { data, error } = await supabase.functions.invoke('login-completo', {
      body: JSON.stringify({ correo, password }),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (error) {
      console.error('Error al invocar login-completo:', error)
      return { success: false, error: error.message || error }
    }
    if (!data.success) {
      if (data.needsProfile) {
        return {
          success: false,
          needsProfile: true,
          auth_user: data.auth_user,
          error: data.error
        }
      }
      return { success: false, error: data.error }
    }
    const { session, user } = data
    localStorage.setItem('supabase_session', JSON.stringify(session))
    localStorage.setItem('user_data', JSON.stringify(user))
    return { success: true, session, user }
  } catch (error: any) {
    console.error('Error inesperado en iniciarSesion:', error)
    const fetchFail =
      typeof error?.message === 'string' &&
      error.message.includes('Failed to send a request to the Edge Function')
    return {
      success: false,
      error: fetchFail
        ? 'No se pudo contactar al servidor de autenticación'
        : error.message || error
    }
  }
}

// Completar perfil usando Edge Function
export async function completarPerfil(datos: any) {
  try {
    const session = JSON.parse(localStorage.getItem('supabase_session') || 'null')
    if (!session || !session.access_token) {
      return { success: false, error: 'No hay sesión activa' }
    }
    const { data, error } = await supabase.functions.invoke('completar-perfil-usuario', {
      body: JSON.stringify(datos),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      }
    })
    if (error) {
      console.error('Error al invocar completar-perfil-usuario:', error)
      return { success: false, error: error.message || error }
    }
    if (!data.success) return { success: false, error: data.error }
    localStorage.setItem('user_data', JSON.stringify(data.user))
    return { success: true, user: data.user }
  } catch (error: any) {
    console.error('Error inesperado en completarPerfil:', error)
    return { success: false, error: error.message || error }
  }
}

// Verificar sesión usando Edge Function
export async function verificarSesion() {
  try {
    const sessionString = localStorage.getItem('supabase_session')
    if (!sessionString) return { success: false, error: 'No hay sesión activa' }
    const session = JSON.parse(sessionString)
    if (!session || !session.access_token) return { success: false, error: 'Sesión inválida' }
    try {
      const { data, error } = await supabase.functions.invoke('verificar-sesion', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
      if (error) {
        console.error('Error al invocar verificar-sesion:', error)
        return { success: false, error: error.message || error }
      }
      if (!data.success) {
        if (data.needsProfile) {
          return {
            success: false,
            needsProfile: true,
            auth_user: data.auth_user,
            error: data.error
          }
        }
        return { success: false, error: data.error }
      }
      localStorage.setItem('supabase_session', JSON.stringify(data.session))
      localStorage.setItem('user_data', JSON.stringify(data.user))
      return { success: true, session: data.session, user: data.user }
    } catch (functionError) {
      console.error('Error al invocar Edge Function:', functionError)
      // Plan B: Intentar obtener la sesión directamente de Supabase Auth
      const { data: { session: currentSession, user }, error: authError } = await supabase.auth.getSession()
      if (authError || !currentSession) {
        console.error('Error al obtener sesión de respaldo:', authError)
        return { success: false, error: authError || 'No se pudo obtener la sesión' }
      }
      // Intentar obtener datos del usuario directamente
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single()
      if (userError || !userData) {
        console.error('Error al obtener datos del usuario:', userError)
        return {
          success: false,
          needsProfile: true,
          auth_user: user,
          error: userError || 'No se encontraron datos del usuario'
        }
      }
      // Actualizar datos locales
      localStorage.setItem('supabase_session', JSON.stringify(currentSession))
      localStorage.setItem('user_data', JSON.stringify(userData))
      return {
        success: true,
        session: currentSession,
        user: userData
      }
    }
  } catch (error: any) {
    console.error('Error inesperado en verificarSesion:', error)
    return { success: false, error: error.message || error }
  }
}

// Cerrar sesión
export async function cerrarSesion() {
  try {
    await supabase.auth.signOut()
    localStorage.removeItem('supabase_session')
    localStorage.removeItem('user_data')
    window.location.href = '/login'
    return { success: true }
  } catch (error: any) {
    console.error('Error inesperado en cerrarSesion:', error)
    return { success: false, error: error.message || error }
  }
}

// Proteger ruta
export async function protegerRuta(rolRequerido: string | null = null) {
  const sessionString = localStorage.getItem('supabase_session')
  const userDataString = localStorage.getItem('user_data')
  if (!sessionString || !userDataString) {
    window.location.href = '/login'
    return false
  }
  try {
    const userData = JSON.parse(userDataString)
    if (rolRequerido && userData.rol !== rolRequerido) {
      window.location.href = '/acceso-denegado'
      return false
    }
    const result = await verificarSesion()
    if (!result.success) {
      window.location.href = '/login'
      return false
    }
    if (result.needsProfile) {
      window.location.href = '/completar-perfil'
      return false
    }
    return true
  } catch (error) {
    window.location.href = '/login'
    return false
  }
} 