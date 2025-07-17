-- Script para crear la vista vista_documentos_completa
-- Ejecutar en Supabase SQL Editor

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

-- Crear índices para mejorar el rendimiento de la vista
CREATE INDEX IF NOT EXISTS idx_vista_documentos_completa_docente_id ON documentos(docente_id);
CREATE INDEX IF NOT EXISTS idx_vista_documentos_completa_estado ON documentos(estado);
CREATE INDEX IF NOT EXISTS idx_vista_documentos_completa_fecha_subida ON documentos(fecha_subida);

-- Comentarios para documentación
COMMENT ON VIEW vista_documentos_completa IS 'Vista completa de documentos con información de docente, tipo, entrega, curso, asignatura y etapa';
COMMENT ON COLUMN vista_documentos_completa.docente_nombre_completo IS 'Nombre completo del docente';
COMMENT ON COLUMN vista_documentos_completa.tipo_documento_nombre IS 'Nombre del tipo de documento';
COMMENT ON COLUMN vista_documentos_completa.entrega_titulo IS 'Título de la entrega programada';
COMMENT ON COLUMN vista_documentos_completa.curso_nombre IS 'Nombre del curso';
COMMENT ON COLUMN vista_documentos_completa.asignatura_nombre IS 'Nombre de la asignatura';
COMMENT ON COLUMN vista_documentos_completa.etapa_nombre IS 'Nombre de la etapa académica'; 