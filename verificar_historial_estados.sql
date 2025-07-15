-- Script para verificar y optimizar la tabla historial_estados
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar que la tabla existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'historial_estados'
) as tabla_existe;

-- 2. Verificar estructura de la tabla
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'historial_estados'
ORDER BY ordinal_position;

-- 3. Crear índices para mejor rendimiento (si no existen)
CREATE INDEX IF NOT EXISTS idx_historial_estados_documento_id ON historial_estados(documento_id);
CREATE INDEX IF NOT EXISTS idx_historial_estados_cambiado_por ON historial_estados(cambiado_por);
CREATE INDEX IF NOT EXISTS idx_historial_estados_fecha_cambio ON historial_estados(fecha_cambio);

-- 4. Verificar datos existentes
SELECT 
  COUNT(*) as total_registros,
  COUNT(DISTINCT documento_id) as documentos_con_historial,
  MIN(fecha_cambio) as fecha_mas_antigua,
  MAX(fecha_cambio) as fecha_mas_reciente
FROM historial_estados;

-- 5. Verificar estados más comunes
SELECT 
  estado_nuevo,
  COUNT(*) as cantidad
FROM historial_estados
GROUP BY estado_nuevo
ORDER BY cantidad DESC;

-- 6. Verificar documentos con comentarios
SELECT 
  COUNT(*) as documentos_con_comentarios
FROM documentos 
WHERE observaciones IS NOT NULL AND observaciones != '';

-- 7. Función para obtener historial de un documento
CREATE OR REPLACE FUNCTION obtener_historial_documento(p_documento_id uuid)
RETURNS TABLE (
  estado_anterior varchar,
  estado_nuevo varchar,
  fecha_cambio timestamp,
  comentario text,
  cambiado_por_nombre text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.estado_anterior,
    h.estado_nuevo,
    h.fecha_cambio,
    h.comentario,
    CONCAT(pd.apellidos, ' ', pd.nombres) as cambiado_por_nombre
  FROM historial_estados h
  LEFT JOIN perfiles_docentes pd ON h.cambiado_por = pd.user_id
  WHERE h.documento_id = p_documento_id
  ORDER BY h.fecha_cambio DESC;
END;
$$ LANGUAGE plpgsql;

-- 8. Vista para documentos con historial completo
CREATE OR REPLACE VIEW documentos_con_historial AS
SELECT 
  d.*,
  pd.apellidos as docente_apellidos,
  pd.nombres as docente_nombres,
  td.nombre as tipo_documento_nombre,
  a.nombre as asignatura_nombre,
  e.nombre as etapa_nombre,
  c.curso as curso_nombre,
  c.paralelo as curso_paralelo,
  c.jornada as curso_jornada,
  COUNT(h.id) as cambios_estado
FROM documentos d
LEFT JOIN perfiles_docentes pd ON d.docente_id = pd.user_id
LEFT JOIN tipos_documento td ON d.tipo_documento_id = td.id
LEFT JOIN asignaturas a ON d.asignatura_id = a.id
LEFT JOIN etapas e ON d.etapa_id = e.id
LEFT JOIN cursos c ON d.curso_asignatura_id = c.id
LEFT JOIN historial_estados h ON d.id = h.documento_id
GROUP BY d.id, pd.apellidos, pd.nombres, td.nombre, a.nombre, e.nombre, c.curso, c.paralelo, c.jornada;

-- 9. Comentarios para documentación
COMMENT ON TABLE historial_estados IS 'Registro de cambios de estado de documentos con comentarios';
COMMENT ON COLUMN historial_estados.comentario IS 'Comentario del vicerrector al cambiar el estado';
COMMENT ON COLUMN historial_estados.cambiado_por IS 'Usuario que realizó el cambio de estado'; 