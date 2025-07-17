-- Script completo para verificar y crear la vista vista_documentos_completa
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar si la vista existe
SELECT 
  'Vista actual:' as info,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'vista_documentos_completa';

-- 2. Verificar las tablas relacionadas
SELECT 
  'Tablas relacionadas:' as info,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name IN ('documentos', 'usuarios_completos', 'tipos_documento', 'entregas_programadas', 'curso_asignaturas', 'cursos', 'asignaturas', 'etapas')
ORDER BY table_name;

-- 3. Verificar estructura de la tabla documentos
SELECT 
  'Estructura documentos:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'documentos'
ORDER BY ordinal_position;

-- 4. Verificar estructura de usuarios_completos
SELECT 
  'Estructura usuarios_completos:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'usuarios_completos'
ORDER BY ordinal_position;

-- 5. Crear la vista (si no existe o reemplazar si existe)
DROP VIEW IF EXISTS vista_documentos_completa;

CREATE VIEW vista_documentos_completa AS
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

-- 6. Verificar que la vista se creó correctamente
SELECT 
  'Vista creada:' as info,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'vista_documentos_completa';

-- 7. Probar la vista con datos de prueba
SELECT 
  'Datos de prueba:' as info,
  COUNT(*) as total_documentos,
  COUNT(DISTINCT docente_id) as total_docentes
FROM vista_documentos_completa;

-- 8. Mostrar algunos registros de ejemplo
SELECT 
  id,
  docente_nombre_completo,
  docente_apellidos,
  docente_nombres,
  tipo_documento_nombre,
  estado,
  fecha_subida
FROM vista_documentos_completa 
LIMIT 5; 