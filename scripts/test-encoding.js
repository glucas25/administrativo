const { 
  generateStandardCode, 
  generateDescriptiveName, 
  generateUniqueFileName,
  decodeFileName,
  isValidEncodedFileName,
  getReadableInfoFromCode
} = require('../lib/googledrive/client.ts')

// Simular metadatos de ejemplo
const metadatosEjemplo = [
  {
    docente_id: 'user123',
    docente_nombre: 'Juan Pérez',
    periodo_id: 1,
    periodo_nombre: 'Periodo 2024-2025',
    etapa_id: 1,
    etapa_nombre: 'Diagnóstico',
    asignatura_id: 1,
    asignatura_nombre: 'Matemáticas',
    tipo_documento_id: 1,
    tipo_documento_nombre: 'Plan Anual'
  },
  {
    docente_id: 'user456',
    docente_nombre: 'María García',
    periodo_id: 1,
    periodo_nombre: 'Periodo 2024-2025',
    etapa_id: 2,
    etapa_nombre: 'Trimestre 1',
    asignatura_id: 2,
    asignatura_nombre: 'Física',
    tipo_documento_id: 2,
    tipo_documento_nombre: 'Evaluación'
  },
  {
    docente_id: 'user789',
    docente_nombre: 'Carlos López',
    periodo_id: 1,
    periodo_nombre: 'Periodo 2024-2025',
    etapa_id: 3,
    etapa_nombre: 'Trimestre 2',
    asignatura_id: 3,
    asignatura_nombre: 'Historia',
    tipo_documento_id: 3,
    tipo_documento_nombre: 'Informe'
  }
]

function testEncoding() {
  console.log('🧪 Probando Sistema de Codificación de Nombres de Archivos\n')
  
  metadatosEjemplo.forEach((metadata, index) => {
    console.log(`📄 Ejemplo ${index + 1}:`)
    console.log(`   Docente: ${metadata.docente_nombre}`)
    console.log(`   Asignatura: ${metadata.asignatura_nombre}`)
    console.log(`   Tipo: ${metadata.tipo_documento_nombre}`)
    console.log(`   Etapa: ${metadata.etapa_nombre}`)
    console.log(`   Periodo: ${metadata.periodo_nombre}`)
    
    // Generar código estándar
    const codigo = generateStandardCode(metadata)
    console.log(`   📋 Código: ${codigo}`)
    
    // Generar nombre descriptivo
    const nombreDescriptivo = generateDescriptiveName(metadata)
    console.log(`   📝 Nombre descriptivo: ${nombreDescriptivo}`)
    
    // Generar nombre completo
    const nombreCompleto = generateUniqueFileName('documento_ejemplo.pdf', metadata)
    console.log(`   📁 Nombre final: ${nombreCompleto}`)
    
    // Decodificar para verificar
    const decodificado = decodeFileName(nombreCompleto)
    console.log(`   🔍 Decodificado:`)
    console.log(`      - Código: ${decodificado.codigo}`)
    console.log(`      - Tipo: ${decodificado.tipoDocumento}`)
    console.log(`      - Etapa: ${decodificado.etapa}`)
    console.log(`      - Asignatura: ${decodificado.asignatura}`)
    console.log(`      - Periodo: ${decodificado.periodo}`)
    console.log(`      - Docente: ${decodificado.docente}`)
    
    // Obtener información legible
    const infoLegible = getReadableInfoFromCode(codigo)
    console.log(`   📖 Información legible:`)
    console.log(`      - Tipo: ${infoLegible.tipoDocumento}`)
    console.log(`      - Etapa: ${infoLegible.etapa}`)
    console.log(`      - Asignatura: ${infoLegible.asignatura}`)
    console.log(`      - Periodo: ${infoLegible.periodo}`)
    console.log(`      - Docente: ${infoLegible.docente}`)
    
    // Validar formato
    const esValido = isValidEncodedFileName(nombreCompleto)
    console.log(`   ✅ Formato válido: ${esValido}`)
    
    console.log('\n' + '─'.repeat(80) + '\n')
  })
  
  // Probar con nombres de archivos existentes (simulados)
  console.log('🔍 Probando con nombres de archivos existentes:\n')
  
  const nombresExistentes = [
    'PA-DIAG-MAT-2024-JP_Matemáticas_Plan_Anual_Diagnóstico_2024-12-15T10-30-00.pdf',
    'EV-T1-FIS-2024-MG_Física_Evaluación_Trimestre_1_2024-12-15T11-45-00.pdf',
    'INF-T2-HIS-2024-CL_Historia_Informe_Trimestre_2_2024-12-15T14-20-00.pdf',
    'documento_sin_codificar.pdf', // Este no debería ser válido
    'PA-DIAG-MAT-2024-JP_archivo_mal_formato.pdf' // Este tampoco
  ]
  
  nombresExistentes.forEach((nombre, index) => {
    console.log(`📄 Archivo ${index + 1}: ${nombre}`)
    
    const esValido = isValidEncodedFileName(nombre)
    console.log(`   ✅ Formato válido: ${esValido}`)
    
    if (esValido) {
      const decodificado = decodeFileName(nombre)
      const infoLegible = getReadableInfoFromCode(decodificado.codigo)
      
      console.log(`   📋 Información:`)
      console.log(`      - Tipo: ${infoLegible.tipoDocumento}`)
      console.log(`      - Etapa: ${infoLegible.etapa}`)
      console.log(`      - Asignatura: ${infoLegible.asignatura}`)
      console.log(`      - Docente: ${infoLegible.docente}`)
      console.log(`      - Timestamp: ${decodificado.timestamp}`)
    } else {
      console.log(`   ❌ No sigue el formato estándar`)
    }
    
    console.log('')
  })
  
  console.log('✅ Pruebas completadas')
}

// Ejecutar pruebas
if (require.main === module) {
  testEncoding()
}

module.exports = { testEncoding } 