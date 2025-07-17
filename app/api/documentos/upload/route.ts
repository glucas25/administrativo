import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let valorEntrega = null;
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const docenteId = formData.get('docente_id') as string
    const periodoId = formData.get('periodo_id') as string
    const etapaId = formData.get('etapa_id') as string
    const asignaturaId = formData.get('asignatura_id') as string
    const tipoDocumentoId = formData.get('tipo_documento_id') as string
    const entregaId = formData.get('entrega_id') as string | null
    const observaciones = formData.get('observaciones') as string | null
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No se proporcionó archivo' }, { status: 400 })
    }
    if (!docenteId || !periodoId || !tipoDocumentoId) {
      return NextResponse.json({ success: false, error: 'Faltan datos requeridos' }, { status: 400 })
    }
    
    // Convertir archivo a buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileSizeMB = buffer.length / (1024 * 1024)

    // Validar tamaño máximo (10 MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'El archivo supera el tamaño máximo permitido (10 MB)' }, { status: 400 })
    }

    // Obtener metadatos para organización
    let metadata: any = {
      docente_id: docenteId,
      periodo_id: parseInt(periodoId),
      tipo_documento_id: parseInt(tipoDocumentoId),
      etapa_id: etapaId ? parseInt(etapaId) : undefined,
      asignatura_id: asignaturaId ? parseInt(asignaturaId) : undefined
    }
    let docente_nombres = ''
    let docente_apellidos = ''
    try {
      const { data: docenteData } = await supabaseAdmin
        .rpc('obtener_perfil_usuario', { p_user_id: docenteId })
      if (docenteData && docenteData.length > 0) {
        const docente = docenteData[0]
        docente_nombres = docente.nombres || ''
        docente_apellidos = docente.apellidos || ''
        metadata.docente_nombre = `${docente.apellidos || ''} ${docente.nombres || ''}`.trim()
      }
      const { data: periodoData } = await supabaseAdmin
        .from('periodos_academicos')
        .select('nombre')
        .eq('id', periodoId)
        .single()
      if (periodoData) {
        metadata.periodo_nombre = periodoData.nombre
      }
      if (etapaId) {
        const { data: etapaData } = await supabaseAdmin
          .from('etapas')
          .select('nombre')
          .eq('id', etapaId)
          .single()
        if (etapaData) {
          metadata.etapa_nombre = etapaData.nombre
        }
      }
      if (asignaturaId) {
        const { data: asignaturaData } = await supabaseAdmin
          .from('asignaturas')
          .select('nombre, codigo')
          .eq('id', asignaturaId)
          .single()
        if (asignaturaData) {
          metadata.asignatura_nombre = asignaturaData.nombre
          metadata.asignatura_codigo = asignaturaData.codigo
        }
      }
      // Cambiar: obtener también el código de tipo de documento
      const { data: tipoDocumentoData } = await supabaseAdmin
        .from('tipos_documento')
        .select('nombre, codigo')
        .eq('id', tipoDocumentoId)
        .single()
      if (tipoDocumentoData) {
        metadata.tipo_documento_nombre = tipoDocumentoData.nombre
        metadata.tipo_documento_codigo = tipoDocumentoData.codigo
      }
    } catch (error) {
      console.error('Error obteniendo metadatos:', error)
    }
    // Obtener curso_asignatura_id del formData y extraer metadatos correctos
    let curso_asignatura_id: number | null = null;
    let curso = '';
    let paralelo = '';
    let subnivel = '';
    let asignatura_nombre = '';
    const cursoAsignaturaIdRaw = formData.get('curso_asignatura_id');
    console.log('curso_asignatura_id recibido:', cursoAsignaturaIdRaw);
    if (cursoAsignaturaIdRaw && !isNaN(Number(cursoAsignaturaIdRaw))) {
      curso_asignatura_id = Number(cursoAsignaturaIdRaw);
      // Consultar curso_asignaturas para obtener curso_id y asignatura_id
      const { data: cursoAsigData, error: cursoAsigError } = await supabaseAdmin
        .from('curso_asignaturas')
        .select('id, curso_id, asignatura_id')
        .eq('id', curso_asignatura_id)
        .single();
      console.log('cursoAsigData:', cursoAsigData, 'cursoAsigError:', cursoAsigError);
      if (cursoAsigError || !cursoAsigData) {
        return NextResponse.json({ success: false, error: 'No se encontró la relación curso_asignatura' }, { status: 400 });
      }
      // Consultar cursos
      const { data: cursoData, error: cursoError } = await supabaseAdmin
        .from('cursos')
        .select('subnivel, curso, paralelo')
        .eq('id', cursoAsigData.curso_id)
        .single();
      console.log('cursoData:', cursoData, 'cursoError:', cursoError);
      if (cursoError || !cursoData) {
        return NextResponse.json({ success: false, error: 'No se encontró el curso' }, { status: 400 });
      }
      subnivel = cursoData.subnivel || '';
      curso = cursoData.curso || '';
      paralelo = cursoData.paralelo || '';
      // Consultar asignatura
      const { data: asignaturaData, error: asignaturaError } = await supabaseAdmin
        .from('asignaturas')
        .select('nombre')
        .eq('id', cursoAsigData.asignatura_id)
        .single();
      console.log('asignaturaData:', asignaturaData, 'asignaturaError:', asignaturaError);
      if (asignaturaError || !asignaturaData) {
        return NextResponse.json({ success: false, error: 'No se encontró la asignatura' }, { status: 400 });
      }
      asignatura_nombre = asignaturaData.nombre || '';
    } else {
      return NextResponse.json({ success: false, error: 'curso_asignatura_id no proporcionado o inválido' }, { status: 400 });
    }
    // Actualizar metadatos para organización
    metadata.curso = curso;
    metadata.paralelo = paralelo;
    metadata.subnivel = subnivel;
    metadata.asignatura_nombre = asignatura_nombre;
    // También obtener el código de asignatura si está disponible
    if (asignatura_nombre && metadata.asignatura_codigo) {
      metadata.asignatura_codigo = metadata.asignatura_codigo;
    }
    // Generar nombre único para el archivo SIEMPRE con timestamp
    let uniqueFileName = generateUniqueFileName(file.name, {
      ...metadata,
      curso,
      paralelo,
      subnivel,
      docente_nombres,
      docente_apellidos
    });
    const timestamp = Date.now();
    const ext = uniqueFileName.includes('.') ? '.' + uniqueFileName.split('.').pop() : '';
    uniqueFileName = uniqueFileName.replace(ext, '') + `_${timestamp}` + ext;
    // Validar nombre de archivo para Storage
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(uniqueFileName)) {
      console.error('Invalid key:', uniqueFileName)
      return NextResponse.json({ success: false, error: `Nombre de archivo inválido: ${uniqueFileName}` }, { status: 400 })
    }
    // Verificar si ya existe un archivo con ese nombre en el bucket
    const { data: existingFile, error: listError } = await supabaseAdmin.storage
      .from('documentos')
      .list('', { search: String(uniqueFileName) })
    if (listError) {
      return NextResponse.json({ success: false, error: listError.message }, { status: 500 })
    }
    if (existingFile && existingFile.find(f => f.name === uniqueFileName)) {
      // Si ya existe, agregar timestamp al nombre
      const timestamp = Date.now()
      const ext = uniqueFileName.includes('.') ? '.' + uniqueFileName.split('.').pop() : ''
      uniqueFileName = uniqueFileName.replace(ext, '') + `_${timestamp}` + ext
    }
    // Subir archivo a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('documentos')
      .upload(uniqueFileName, buffer, {
        contentType: file.type,
        upsert: true // Permite reemplazar el archivo si ya existe
      })
    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 })
    }
    // Obtener URL pública (si el bucket es público) o firmada (si es privado)
    const { data: publicUrlData } = supabaseAdmin.storage.from('documentos').getPublicUrl(uniqueFileName)
    const publicUrl = publicUrlData?.publicUrl || null
    // Guardar metadatos en la base de datos
    const now = new Date().toISOString()

    // Calcular valor de entrega (A tiempo / Con atraso)
    let fechaLimite: string | null = null;
    if (entregaId) {
      const { data: entregaData } = await supabaseAdmin
        .from('entregas_programadas')
        .select('fecha_limite')
        .eq('id', entregaId)
        .single();
      fechaLimite = entregaData?.fecha_limite || null;
    }
    if (fechaLimite) {
      const fechaLimiteDate = new Date(fechaLimite);
      const fechaSubidaDate = new Date(now);
      if (fechaSubidaDate <= fechaLimiteDate) {
        valorEntrega = "A tiempo";
      } else {
        valorEntrega = "Con atraso";
      }
    } else {
      valorEntrega = null; // O "Pendiente"
    }
    // Leer observaciones_internas del formData
    const observaciones_internas = formData.get('observaciones_internas') as string | null;
    // Buscar si ya existe un documento para la misma entrega, curso_asignatura y docente
    const { data: existingDocs, error: existingError } = await supabaseAdmin
      .from('documentos')
      .select('id, docente_id, entrega_id, curso_asignatura_id, nombre_archivo')
      .eq('docente_id', docenteId)
      .eq('entrega_id', entregaId ? Number(entregaId) : null)
      .eq('curso_asignatura_id', curso_asignatura_id !== undefined && curso_asignatura_id !== null ? Number(curso_asignatura_id) : null)
      .order('fecha_subida', { ascending: false })
      .limit(1);

    if (existingError) {
      return NextResponse.json({ success: false, error: existingError.message }, { status: 500 });
    }

    // Solo actualizar si la combinación y el nombre de archivo son exactamente iguales
    if (
      existingDocs &&
      existingDocs.length > 0 &&
      existingDocs[0].docente_id == docenteId &&
      String(existingDocs[0].entrega_id) == String(entregaId ? Number(entregaId) : null) &&
      String(existingDocs[0].curso_asignatura_id) == String(curso_asignatura_id !== undefined && curso_asignatura_id !== null ? Number(curso_asignatura_id) : null) &&
      existingDocs[0].nombre_archivo === uniqueFileName
    ) {
      // Actualizar el documento existente
      const docId = existingDocs[0].id;
      const { error: updateError } = await supabaseAdmin
        .from('documentos')
        .update({
          nombre_archivo: uniqueFileName,
          nombre_original: file.name,
          tamaño_bytes: buffer.length,
          tipo_mime: file.type,
          link_onedrive: publicUrl,
          estado: 'ENVIADO',
          fecha_subida: now,
          fecha_ultima_modificacion: now,
          version: 1,
          observaciones: observaciones || null,
          observaciones_internas: observaciones_internas || null,
          metadata,
          entrega_id: entregaId ? Number(entregaId) : null,
          curso_asignatura_id: curso_asignatura_id !== undefined && curso_asignatura_id !== null ? Number(curso_asignatura_id) : null,
          asignatura_id: asignaturaId ? Number(asignaturaId) : null,
          tipo_documento_id: tipoDocumentoId ? Number(tipoDocumentoId) : null,
          etapa_id: etapaId ? Number(etapaId) : null,
          periodo_id: periodoId ? Number(periodoId) : null,
          entrega: valorEntrega
        })
        .eq('id', docId);

      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }
    } else {
      // Insertar nuevo documento
    const { data: docData, error: docError } = await supabaseAdmin.from('documentos').insert([
      {
        docente_id: docenteId,
        entrega_id: entregaId ? parseInt(entregaId) : null,
        tipo_documento_id: tipoDocumentoId ? parseInt(tipoDocumentoId) : null,
        periodo_id: periodoId ? parseInt(periodoId) : null,
        asignatura_id: asignaturaId ? parseInt(asignaturaId) : null,
        etapa_id: etapaId ? parseInt(etapaId) : null,
        curso_asignatura_id: curso_asignatura_id !== undefined && curso_asignatura_id !== null ? parseInt(curso_asignatura_id as any) : null,
        nombre_archivo: uniqueFileName,
        nombre_original: file.name,
        tamaño_bytes: buffer.length,
        tipo_mime: file.type,
        link_onedrive: publicUrl,
        onedrive_file_id: null,
        estado: 'ENVIADO',
        fecha_subida: now,
        fecha_ultima_modificacion: now,
        version: 1,
        observaciones: observaciones || null,
        observaciones_internas: observaciones_internas || null,
        metadata,
        entrega: valorEntrega
      }
      ]);
    if (docError) {
        return NextResponse.json({ success: false, error: docError.message }, { status: 500 });
      }
    }
    return NextResponse.json({
      success: true,
      name: uniqueFileName,
      size: buffer.length,
      mime: file.type,
      publicUrl
    })
  } catch (error: any) {
    console.error('Error subiendo archivo a Supabase Storage:', error)
    return NextResponse.json(
      { success: false, error: error.message || JSON.stringify(error) || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

function sanitizeFileNamePart(part: string): string {
  // Reemplaza tildes, espacios, caracteres especiales y limita longitud
  return part
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-zA-Z0-9_\-]/g, '_') // solo letras, números, guion y guion bajo
    .substring(0, 30) // máximo 30 caracteres por parte
}

function getCodigoTipoDocumento(nombre: string): string {
  // Puedes expandir este diccionario según los tipos existentes
  const codigos: Record<string, string> = {
    'Planificaciones': 'PLAN',
    'Plan': 'PLAN',
    'Informe': 'INF',
    'Proyecto': 'PROY',
    'Acta': 'ACTA',
    'Guía': 'GUIA',
    'Examen': 'EXAM',
    'Reportes': 'REP',
    'Listas': 'LIST',
    'Evaluaciones': 'EVAL',
    // ... agregar más según necesidad
  }
  return codigos[nombre.trim()] || nombre.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6)
}

function getCodigoEtapa(nombre: string): string {
  const codigos: Record<string, string> = {
    'Diagnóstico': 'DIAG',
    'Trimestre 1': 'TRIM1',
    'Trimestre 2': 'TRIM2',
    'Trimestre 3': 'TRIM3',
    'Supletorio': 'SUPL',
    // ... agregar más según necesidad
  }
  return codigos[nombre.trim()] || nombre.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6)
}

function getCodigoAsignatura(nombre: string): string {
  // Ejemplo: Matemáticas -> MAT, Lengua -> LEN
  const codigos: Record<string, string> = {
    'Matemática': 'MAT',
    'Lengua y Literatura': 'LEN',
    'Ciencias': 'CIE',
    'Historia': 'HIS',
    'Inglés': 'ING',
    'Física': 'FIS',
    'Química': 'QUI',
    'Biología': 'BIO',
    'Educación Física': 'EDF',
    // ... agregar más según necesidad
  }
  return codigos[nombre.trim()] || nombre.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6)
}

function getCodigoPeriodo(nombre: string): string {
  // Ejemplo: 2025-2026 -> 2025_2026
  return nombre.replace(/\s+/g, '').replace(/-/g, '_')
}

function getCodigoSubnivel(nombre: string): string {
  // Ejemplo: Básico Superior -> BS
  const codigos: Record<string, string> = {
    'Básico Superior': 'BS',
    'Básico Elemental': 'BE',
    'Inicial': 'INI',
    'Preparatoria': 'PRE',
    'Bachillerato': 'BACH',
    // ... agregar más según necesidad
  }
  return codigos[nombre.trim()] || nombre.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4)
}

function getCodigoCurso(curso: string, paralelo: string): string {
  // Ejemplo: curso=9, paralelo=A => 9A
  return `${curso}${paralelo}`.replace(/\s+/g, '')
}

function getCodigoNombre(nombre: string): string {
  // Solo primer nombre/apellido, sin tildes ni espacios
  return sanitizeFileNamePart(nombre.split(' ')[0] || '')
}

function getFechaLegible(): string {
  const now = new Date()
  const dia = String(now.getDate()).padStart(2, '0')
  const mes = String(now.getMonth() + 1).padStart(2, '0')
  const anio = now.getFullYear()
  return `${dia}-${mes}-${anio}`
}

function generateUniqueFileName(
  originalName: string,
  metadata: any
): string {
  const extension = originalName.split('.').pop() || ''
  // Usar el código directamente si está disponible
  const tipoDoc = sanitizeFileNamePart((metadata.tipo_documento_codigo || '')).toUpperCase()
  const etapa = sanitizeFileNamePart(getCodigoEtapa(metadata.etapa_nombre || '')).toUpperCase()
  // Eliminar el periodo de la codificación
  // const periodo = sanitizeFileNamePart(metadata.periodo_nombre || '').toUpperCase()
  const subnivel = sanitizeFileNamePart(getCodigoSubnivel(metadata.subnivel || '')).toUpperCase()
  const curso = sanitizeFileNamePart(getCodigoCurso(metadata.curso || '', metadata.paralelo || '')).toUpperCase()
  // Usar el código de asignatura si está disponible
  const asignatura = sanitizeFileNamePart((metadata.asignatura_codigo || '')).toUpperCase()
  const apellido = sanitizeFileNamePart(getCodigoNombre(metadata.docente_apellidos || '')).toUpperCase()
  const nombre = sanitizeFileNamePart(getCodigoNombre(metadata.docente_nombres || '')).toUpperCase()
  const fecha = sanitizeFileNamePart(getFechaLegible()).toUpperCase()
  // Unir partes (sin periodo)
  const parts = [tipoDoc, etapa, curso, asignatura, apellido, nombre, fecha]
  const baseName = parts.filter(Boolean).join('-')
  return `${baseName}.${extension}`
}

export async function GET() {
  return NextResponse.json({ error: 'Método no permitido' }, { status: 405 })
} 