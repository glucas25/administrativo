-- Agrega la columna curso_asignatura_id a la tabla documentos
ALTER TABLE documentos
ADD COLUMN curso_asignatura_id integer;

-- (Opcional) Si quieres crear el índice para búsquedas rápidas:
CREATE INDEX idx_documentos_curso_asignatura_id ON documentos(curso_asignatura_id); 