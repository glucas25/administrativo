// Script para verificar datos en la base de datos
// Ejecutar: node scripts/verificar-datos.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarDatos() {
  try {
    console.log('🔍 Verificando datos en la base de datos...\n');
    
    // 1. Verificar documentos
    console.log('1. Verificando tabla documentos:');
    const { data: documentos, error: docError } = await supabase
      .from('documentos')
      .select('id, estado, docente_id, fecha_subida')
      .limit(10);
    
    if (docError) {
      console.error('❌ Error obteniendo documentos:', docError);
    } else {
      console.log(`✅ Documentos encontrados: ${documentos?.length || 0}`);
      console.log('📋 Ejemplos:', documentos?.slice(0, 3));
    }
    
    // 2. Verificar usuarios_completos
    console.log('\n2. Verificando tabla usuarios_completos:');
    const { data: usuarios, error: userError } = await supabase
      .from('usuarios_completos')
      .select('id, nombre_completo, apellidos, nombres, rol')
      .limit(10);
    
    if (userError) {
      console.error('❌ Error obteniendo usuarios:', userError);
    } else {
      console.log(`✅ Usuarios encontrados: ${usuarios?.length || 0}`);
      console.log('📋 Ejemplos:', usuarios?.slice(0, 3));
    }
    
    // 3. Verificar si existe la vista
    console.log('\n3. Verificando vista vista_documentos_completa:');
    try {
      const { data: vistaData, error: vistaError } = await supabase
        .from('vista_documentos_completa')
        .select('*')
        .limit(1);
      
      if (vistaError) {
        console.log('❌ Vista no existe o tiene errores:', vistaError.message);
      } else {
        console.log('✅ Vista existe y funciona');
        console.log('📋 Datos de la vista:', vistaData);
      }
    } catch (vistaError) {
      console.log('❌ Error accediendo a la vista:', vistaError.message);
    }
    
    // 4. Verificar relaciones
    console.log('\n4. Verificando relaciones:');
    if (documentos && usuarios) {
      const docentesConDocumentos = new Set(documentos.map(d => d.docente_id));
      const usuariosExistentes = new Set(usuarios.map(u => u.id));
      
      console.log(`📊 Docentes con documentos: ${docentesConDocumentos.size}`);
      console.log(`📊 Usuarios existentes: ${usuariosExistentes.size}`);
      
      const docentesSinUsuario = Array.from(docentesConDocumentos).filter(id => !usuariosExistentes.has(id));
      if (docentesSinUsuario.length > 0) {
        console.log('⚠️ Docentes sin usuario correspondiente:', docentesSinUsuario);
      } else {
        console.log('✅ Todas las relaciones están correctas');
      }
    }
    
    // 5. Generar reporte de prueba
    console.log('\n5. Generando reporte de prueba:');
    if (documentos && usuarios) {
      const usuariosMap = new Map();
      usuarios.forEach(u => usuariosMap.set(u.id, u));
      
             const reporte = {};
      
      documentos.forEach(doc => {
        const usuario = usuariosMap.get(doc.docente_id);
        const nombre = usuario?.nombre_completo || usuario?.apellidos || 'Sin nombre';
        
        if (!reporte[nombre]) {
          reporte[nombre] = {
            docente: nombre,
            entregados: 0,
            pendientes: 0,
            observados: 0,
            aprobados: 0
          };
        }
        
        reporte[nombre].entregados++;
        if (doc.estado === 'APROBADO') reporte[nombre].aprobados++;
        else if (doc.estado === 'OBSERVADO') reporte[nombre].observados++;
        else if (doc.estado === 'ENVIADO' || doc.estado === 'EN_REVISION') reporte[nombre].pendientes++;
      });
      
      console.log('📊 Reporte generado:', Object.values(reporte));
    }
    
  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

// Ejecutar el script
verificarDatos().then(() => {
  console.log('\n🏁 Verificación completada');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
}); 