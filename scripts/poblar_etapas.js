// Script para poblar etapas en periodos académicos existentes
// Ejecutar con: node scripts/poblar_etapas.js

const { createClient } = require('@supabase/supabase-js')

// Configurar Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Faltan variables de entorno para Supabase')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function poblarEtapas() {
  try {
    console.log('Iniciando poblamiento de etapas...')

    // 1. Obtener todos los periodos académicos activos
    const { data: periodos, error: periodosError } = await supabase
      .from('periodos_academicos')
      .select('id, codigo, nombre')
      .eq('activo', true)

    if (periodosError) {
      throw new Error(`Error obteniendo periodos: ${periodosError.message}`)
    }

    console.log(`Encontrados ${periodos.length} periodos académicos`)

    // 2. Para cada periodo, verificar si ya tiene etapas
    for (const periodo of periodos) {
      console.log(`\nProcesando periodo: ${periodo.nombre} (${periodo.codigo})`)

      // Verificar si ya tiene etapas
      const { data: etapasExistentes, error: etapasError } = await supabase
        .from('etapas')
        .select('id, nombre')
        .eq('periodo_id', periodo.id)

      if (etapasError) {
        console.error(`Error verificando etapas para periodo ${periodo.id}:`, etapasError)
        continue
      }

      if (etapasExistentes && etapasExistentes.length > 0) {
        console.log(`  ✅ Periodo ${periodo.nombre} ya tiene ${etapasExistentes.length} etapas configuradas`)
        continue
      }

      // 3. Crear etapas para este periodo
      const etapas = [
        { nombre: 'Diagnóstico', orden: 0, periodo_id: periodo.id },
        { nombre: 'Trimestre 1', orden: 1, periodo_id: periodo.id },
        { nombre: 'Trimestre 2', orden: 2, periodo_id: periodo.id },
        { nombre: 'Trimestre 3', orden: 3, periodo_id: periodo.id },
        { nombre: 'Supletorio', orden: 4, periodo_id: periodo.id }
      ]

      const { data: etapasCreadas, error: crearError } = await supabase
        .from('etapas')
        .insert(etapas)
        .select('id, nombre, orden')

      if (crearError) {
        console.error(`  ❌ Error creando etapas para periodo ${periodo.id}:`, crearError)
        continue
      }

      console.log(`  ✅ Creadas ${etapasCreadas.length} etapas para periodo ${periodo.nombre}:`)
      etapasCreadas.forEach(etapa => {
        console.log(`    - ${etapa.nombre} (orden: ${etapa.orden})`)
      })
    }

    console.log('\n✅ Proceso completado exitosamente')

    // 4. Mostrar resumen final
    const { data: resumen, error: resumenError } = await supabase
      .from('etapas')
      .select(`
        id,
        nombre,
        orden,
        periodo_id,
        periodos_academicos (
          codigo,
          nombre
        )
      `)
      .order('periodo_id', { ascending: true })
      .order('orden', { ascending: true })

    if (!resumenError && resumen) {
      console.log('\n📊 Resumen de etapas por periodo:')
      const etapasPorPeriodo = resumen.reduce((acc, etapa) => {
        const periodoKey = `${etapa.periodos_academicos.codigo} - ${etapa.periodos_academicos.nombre}`
        if (!acc[periodoKey]) acc[periodoKey] = []
        acc[periodoKey].push(etapa)
        return acc
      }, {})

      Object.entries(etapasPorPeriodo).forEach(([periodo, etapas]) => {
        console.log(`\n${periodo}:`)
        etapas.forEach(etapa => {
          console.log(`  - ${etapa.nombre} (orden: ${etapa.orden})`)
        })
      })
    }

  } catch (error) {
    console.error('❌ Error en el proceso:', error)
    process.exit(1)
  }
}

// Ejecutar el script
poblarEtapas() 