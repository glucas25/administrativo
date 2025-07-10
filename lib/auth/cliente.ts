import { supabase } from '@/lib/supabase/client'

// Función de prueba para verificar comunicación con Edge Functions
export async function testEdgeFunction() {
  try {
    console.log('Probando comunicación con Edge Function...')
    // Generar un email único para cada prueba
    const uniqueEmail = `test_${Date.now()}@test.com`
    // Usar la función crear_usuario_completo SOLO para pruebas/registro
    const { data, error } = await supabase.rpc('crear_usuario_completo', {
      p_email: uniqueEmail,
      p_password: '123456',
      p_cedula: '1234567890',
      p_apellidos: 'User',
      p_nombres: 'Test',
      p_rol: 'docente'
    })
    console.log('Respuesta de test:', { data, error })
    return { success: !error, data, error }
  } catch (error: any) {
    console.error('Error en testEdgeFunction:', error)
    return { success: false, error: error.message || error }
  }
}

// Iniciar sesión usando Supabase Auth y funciones nuevas
export async function iniciarSesion(correo: string, password: string) {
  try {
    console.log('Iniciando sesión con:', { correo, password: '***' })
    // Login directo con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: correo,
      password: password
    })
    if (authError || !authData?.user) {
      console.error('Error al iniciar sesión:', authError)
      return { success: false, error: authError?.message || 'Credenciales incorrectas' }
    }
    // Actualizar último acceso
    await supabase.rpc('actualizar_ultimo_acceso', { p_user_id: authData.user.id })
    // Obtener perfil completo
    let userData = null
    try {
      const { data: perfil, error: perfilError } = await supabase.rpc('obtener_perfil_usuario', { p_user_id: authData.user.id })
      if (!perfilError && perfil && perfil.length > 0) {
        userData = perfil[0]
      } else {
        userData = authData.user
      }
    } catch (e) {
      userData = authData.user
    }
    // Guardar sesión y datos de usuario
    localStorage.setItem('supabase_session', JSON.stringify(authData.session))
    localStorage.setItem('user_data', JSON.stringify(userData))
    return { success: true, session: authData.session, user: userData }
  } catch (error: any) {
    console.error('Error inesperado en iniciarSesion:', error)
    return { success: false, error: error?.message || String(error) }
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
      const { data: { session: currentSession }, error: authError } = await supabase.auth.getSession()
      if (authError || !currentSession) {
        console.error('Error al obtener sesión de respaldo:', authError)
        return { success: false, error: authError || 'No se pudo obtener la sesión' }
      }
      // Intentar obtener datos del usuario directamente usando la función obtener_datos_usuario_completos
      const userId = currentSession.user.id
      const { data: userData, error: userError } = await supabase
        .rpc('obtener_datos_usuario_completos', { p_user_id: userId })
      if (userError || !userData || userData.length === 0) {
        console.error('Error al obtener datos del usuario:', userError)
        return {
          success: false,
          needsProfile: true,
          auth_user: currentSession.user,
          error: userError || 'No se encontraron datos del usuario'
        }
      }
      // Actualizar datos locales
      localStorage.setItem('supabase_session', JSON.stringify(currentSession))
      localStorage.setItem('user_data', JSON.stringify(userData[0]))
      return {
        success: true,
        session: currentSession,
        user: userData[0]
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
    return { success: false, error: error?.message || String(error) }
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