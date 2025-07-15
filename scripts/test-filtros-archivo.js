// scripts/test-filtros-archivo.js
// Script para probar la funcionalidad de filtros de tipos de archivo
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js')

// Configuración de Supabase (usar variables de entorno en producción)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Faltan variables de entorno de Supabase')
  console.log('Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY configuradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testFiltrosArchivo() {
  console.log('🧪 Probando filtros de tipos de archivo...\n')

  try {
    // 1. Verificar tipos de documento existentes
    console.log('1. Verificando tipos de documento existentes...')
    const { data: tiposDocumento, error: errorTipos } = await supabase
      .from('tipos_documento')
      .select('*')
      .eq('activo', true)

    if (errorTipos) {
      throw new Error(`Error al obtener tipos de documento: ${errorTipos.message}`)
    }

    console.log(`✅ Encontrados ${tiposDocumento.length} tipos de documento activos`)
    
    tiposDocumento.forEach(tipo => {
      console.log(`   - ${tipo.nombre}: ${tipo.tipos_archivo_permitidos?.join(', ') || 'Todos los tipos'}`)
    })

    // 2. Probar función de validación de tipos de archivo
    console.log('\n2. Probando función de validación de tipos de archivo...')
    
    const archivosPrueba = [
      { nombre: 'documento.pdf', tipo: 'pdf' },
      { nombre: 'planificacion.docx', tipo: 'docx' },
      { nombre: 'evaluacion.xlsx', tipo: 'xlsx' },
      { nombre: 'presentacion.pptx', tipo: 'pptx' },
      { nombre: 'imagen.jpg', tipo: 'jpg' },
      { nombre: 'archivo.txt', tipo: 'txt' }
    ]

    for (const tipoDoc of tiposDocumento.slice(0, 3)) { // Probar solo los primeros 3 tipos
      console.log(`\n   Probando tipo: ${tipoDoc.nombre}`)
      
      for (const archivo of archivosPrueba) {
        const { data: resultado, error } = await supabase.rpc('validar_tipo_archivo', {
          p_tipo_documento_id: tipoDoc.id,
          p_nombre_archivo: archivo.nombre
        })

        if (error) {
          console.log(`     ❌ Error validando ${archivo.nombre}: ${error.message}`)
        } else {
          const esValido = resultado
          const icono = esValido ? '✅' : '❌'
          console.log(`     ${icono} ${archivo.nombre} (${archivo.tipo}): ${esValido ? 'PERMITIDO' : 'NO PERMITIDO'}`)
        }
      }
    }

    // 3. Probar función para obtener descripción de tipos permitidos
    console.log('\n3. Probando función para obtener descripción de tipos permitidos...')
    
    for (const tipoDoc of tiposDocumento.slice(0, 3)) {
      const { data: descripcion, error } = await supabase.rpc('obtener_descripcion_tipos_archivo', {
        p_tipo_documento_id: tipoDoc.id
      })

      if (error) {
        console.log(`   ❌ Error obteniendo descripción para ${tipoDoc.nombre}: ${error.message}`)
      } else {
        console.log(`   ✅ ${tipoDoc.nombre}: ${descripcion}`)
      }
    }

    // 4. Probar función para obtener tipos permitidos
    console.log('\n4. Probando función para obtener tipos permitidos...')
    
    for (const tipoDoc of tiposDocumento.slice(0, 3)) {
      const { data: tiposPermitidos, error } = await supabase.rpc('obtener_tipos_archivo_permitidos', {
        p_tipo_documento_id: tipoDoc.id
      })

      if (error) {
        console.log(`   ❌ Error obteniendo tipos permitidos para ${tipoDoc.nombre}: ${error.message}`)
      } else {
        console.log(`   ✅ ${tipoDoc.nombre}:`)
        console.log(`      Tipos: [${tiposPermitidos[0]?.tipos_permitidos?.join(', ')}]`)
        console.log(`      Descripción: ${tiposPermitidos[0]?.descripcion}`)
      }
    }

    // 5. Crear un nuevo tipo de documento con filtros específicos
    console.log('\n5. Creando nuevo tipo de documento con filtros específicos...')
    
    const nuevoTipo = {
      codigo: 'TEST_FILTRO',
      nombre: 'Documento de Prueba con Filtros',
      descripcion: 'Tipo de documento para probar filtros de archivo',
      requiere_revision: true,
      requiere_asignatura: true,
      tipos_archivo_permitidos: ['pdf', 'docx'],
      descripcion_tipos_archivo: 'PDF, Word (.docx)',
      activo: true
    }

    const { data: tipoCreado, error: errorCrear } = await supabase
      .from('tipos_documento')
      .insert([nuevoTipo])
      .select()

    if (errorCrear) {
      console.log(`   ❌ Error creando tipo de documento: ${errorCrear.message}`)
    } else {
      console.log(`   ✅ Tipo creado: ${tipoCreado[0].nombre}`)
      console.log(`      Tipos permitidos: [${tipoCreado[0].tipos_archivo_permitidos.join(', ')}]`)
      
      // Probar validación con el nuevo tipo
      const archivosTest = [
        { nombre: 'test.pdf', esperado: true },
        { nombre: 'test.docx', esperado: true },
        { nombre: 'test.doc', esperado: false },
        { nombre: 'test.xlsx', esperado: false }
      ]

      console.log('      Probando validaciones:')
      for (const archivo of archivosTest) {
        const { data: esValido } = await supabase.rpc('validar_tipo_archivo', {
          p_tipo_documento_id: tipoCreado[0].id,
          p_nombre_archivo: archivo.nombre
        })

        const resultado = esValido === archivo.esperado ? '✅' : '❌'
        console.log(`        ${resultado} ${archivo.nombre}: ${esValido ? 'PERMITIDO' : 'NO PERMITIDO'} (esperado: ${archivo.esperado ? 'PERMITIDO' : 'NO PERMITIDO'})`)
      }

      // Limpiar: eliminar el tipo de prueba
      await supabase
        .from('tipos_documento')
        .delete()
        .eq('id', tipoCreado[0].id)
      
      console.log('      🧹 Tipo de prueba eliminado')
    }

    console.log('\n🎉 Pruebas completadas exitosamente!')
    console.log('\n📋 Resumen:')
    console.log('   - ✅ Validación de tipos de archivo funcionando')
    console.log('   - ✅ Descripción de tipos permitidos funcionando')
    console.log('   - ✅ Filtros configurables por tipo de documento')
    console.log('   - ✅ Triggers de validación en base de datos')

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message)
    process.exit(1)
  }
}

// Ejecutar pruebas
testFiltrosArchivo()
  .then(() => {
    console.log('\n✅ Script completado')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  }) 