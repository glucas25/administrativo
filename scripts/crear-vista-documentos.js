// Script para crear la vista vista_documentos_completa
// Ejecutar: node scripts/crear-vista-documentos.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Faltan variables de entorno');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function crearVistaDocumentos() {
  try {
    console.log('🔄 Creando vista vista_documentos_completa...');
    
    const sql = `
      -- Crear vista para documentos con información completa
      CREATE OR REPLACE VIEW vista_documentos_completa AS
      SELECT 
        d.*,
        uc.nombre_completo as docente_nombre_completo,
        uc.apellidos as docente_apellidos,
        uc.nombres as docente_nombres,
        td.nombre as tipo_documento_nombre,
        ep.titulo as entrega_titulo,
        ep.fecha_limite as entrega_fecha_limite,
        c.curso as curso_nombre,
        c.paralelo as curso_paralelo,
        c.jornada as curso_jornada,
        a.nombre as asignatura_nombre,
        e.nombre as etapa_nombre,
        d.observaciones_internas
      FROM documentos d
      LEFT JOIN usuarios_completos uc ON d.docente_id = uc.id
      LEFT JOIN tipos_documento td ON d.tipo_documento_id = td.id
      LEFT JOIN entregas_programadas ep ON d.entrega_id = ep.id
      LEFT JOIN curso_asignaturas ca ON d.curso_asignatura_id = ca.id
      LEFT JOIN cursos c ON ca.curso_id = c.id
      LEFT JOIN asignaturas a ON d.asignatura_id = a.id
      LEFT JOIN etapas e ON d.etapa_id = e.id;
    `;
    
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Error creando la vista:', error);
      return;
    }
    
    console.log('✅ Vista vista_documentos_completa creada exitosamente');
    
    // Verificar que la vista se creó correctamente
    const { data: testData, error: testError } = await supabase
      .from('vista_documentos_completa')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('❌ Error verificando la vista:', testError);
    } else {
      console.log('✅ Vista verificada correctamente');
      console.log('📊 Datos de prueba:', testData);
    }
    
  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

// Ejecutar el script
crearVistaDocumentos().then(() => {
  console.log('🏁 Script completado');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
}); 