// app/api/admin/create-user/route.ts - Versión simplificada
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('Create user API called')
  
  try {
    // Obtener el token de autorización del header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Token no proporcionado' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verificar el token y obtener el usuario
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.log('Invalid token or no user')
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    console.log('User authenticated:', user.email)

    // Verificar rol del usuario
    const { data: userData, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (userError || userData?.rol !== 'vicerrector') {
      console.log('User is not vicerrector')
      return NextResponse.json(
        { success: false, error: 'Solo el vicerrector puede crear usuarios' },
        { status: 403 }
      )
    }

    // Obtener datos del request
    const body = await request.json()
    const { email, password, cedula, apellidos, nombres, area, titulo } = body

    // Validar datos requeridos
    if (!email || !password || !apellidos || !nombres) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      )
    }

    console.log('Creating new user:', email)

    // Crear usuario en auth.users
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (createError) {
      console.error('Error creating auth user:', createError)
      return NextResponse.json(
        { success: false, error: createError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { success: false, error: 'No se pudo crear el usuario' },
        { status: 500 }
      )
    }

    // Crear registro en tabla usuarios
    const nombre_completo = `${apellidos} ${nombres}`.trim()
    
    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: authData.user.id,
        correo: email,
        nombre_completo,
        apellidos,
        nombres,
        cedula: cedula || null,
        area: area || null,
        titulo: titulo || null,
        rol: 'docente',
        activo: true
      })

    if (dbError) {
      console.error('Error creating user record:', dbError)
      // Eliminar usuario de auth si falla
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      )
    }

    console.log('User created successfully')

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        nombre_completo
      }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}