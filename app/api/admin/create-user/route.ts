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

    // Verificar que el correo o la cédula no estén registrados en la base
    // de datos y en auth.users
    const orConditions = [`correo.eq.${email}`]
    if (cedula) {
      orConditions.push(`cedula.eq.${cedula}`)
    }

    const { count: dbCount } = await supabaseAdmin
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .or(orConditions.join(','))

    // Buscar usuario por email en Auth (listUsers solo acepta paginación, así que hay que filtrar manualmente)
    const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      return NextResponse.json(
        { success: false, error: listError.message },
        { status: 500 }
      )
    }
    const authUser = usersList?.users?.find(u => u.email === email)

    if ((dbCount && dbCount > 0) || authUser) {
      return NextResponse.json(
        { success: false, error: 'Correo o cédula ya registrados' },
        { status: 409 }
      )
    }

    // Crear usuario en auth.users
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password
    })

    if (createError) {
      // Imprime el error completo, no solo el mensaje
      console.error('Error creating auth user:', createError, JSON.stringify(createError));
      return NextResponse.json(
        { success: false, error: createError.message || JSON.stringify(createError) },
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

    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: authData.user.id,
        correo: email,
        apellidos,
        nombres,
        cedula: cedula || null,
        area: area || null,
        titulo: titulo || null,
        rol: 'docente',
        activo: true
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('Error creating user record:', dbError)
      // Eliminar usuario de auth si falla
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

      const friendly =
        dbError.code === '23505'
          ? 'Correo o c\u00e9dula ya registrados'
          : dbError.message

      return NextResponse.json(
        { success: false, error: friendly },
        { status: 500 }
      )
    }

    console.log('User created successfully')

    return NextResponse.json({
      success: true,
      user: {
        id: dbUser?.id || authData.user.id,
        email: authData.user.email,
        nombre_completo: `${apellidos} ${nombres}`.trim()
      }
    })

  } catch (error) {
    // Esto imprimirá el error real en la consola del servidor
    console.error('Unexpected error:', error)
    // Esto enviará el mensaje real al frontend (solo hazlo en desarrollo)
    return NextResponse.json(
      { success: false, error: error?.message || JSON.stringify(error) || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
