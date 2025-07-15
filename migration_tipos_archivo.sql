-- Migración para agregar filtros de tipos de archivo a tipos de documento
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar campo tipos_archivo_permitidos a tipos_documento
ALTER TABLE public.tipos_documento 
ADD COLUMN IF NOT EXISTS tipos_archivo_permitidos text[] DEFAULT ARRAY['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

-- 2. Agregar campo descripcion_tipos_archivo para mostrar información al docente
ALTER TABLE public.tipos_documento 
ADD COLUMN IF NOT EXISTS descripcion_tipos_archivo text DEFAULT 'PDF, Word, Excel, PowerPoint';

-- 3. Crear función para validar tipos de archivo
CREATE OR REPLACE FUNCTION validar_tipo_archivo(
  p_tipo_documento_id integer,
  p_nombre_archivo text
)
RETURNS boolean AS $$
DECLARE
  v_tipos_permitidos text[];
  v_extension text;
BEGIN
  -- Obtener tipos permitidos para el tipo de documento
  SELECT tipos_archivo_permitidos INTO v_tipos_permitidos
  FROM public.tipos_documento
  WHERE id = p_tipo_documento_id AND activo = true;
  
  -- Si no hay tipos permitidos, permitir todos
  IF v_tipos_permitidos IS NULL OR array_length(v_tipos_permitidos, 1) IS NULL THEN
    RETURN true;
  END IF;
  
  -- Extraer extensión del archivo
  v_extension := lower(split_part(p_nombre_archivo, '.', -1));
  
  -- Verificar si la extensión está permitida
  RETURN v_extension = ANY(v_tipos_permitidos);
END;
$$ LANGUAGE plpgsql;

-- 4. Crear función para obtener descripción de tipos permitidos
CREATE OR REPLACE FUNCTION obtener_descripcion_tipos_archivo(p_tipo_documento_id integer)
RETURNS text AS $$
DECLARE
  v_descripcion text;
BEGIN
  SELECT descripcion_tipos_archivo INTO v_descripcion
  FROM public.tipos_documento
  WHERE id = p_tipo_documento_id AND activo = true;
  
  RETURN COALESCE(v_descripcion, 'Todos los tipos de archivo');
END;
$$ LANGUAGE plpgsql;

-- 5. Actualizar tipos de documento existentes con configuraciones por defecto
UPDATE public.tipos_documento 
SET 
  tipos_archivo_permitidos = ARRAY['pdf', 'doc', 'docx'],
  descripcion_tipos_archivo = 'PDF, Word'
WHERE nombre ILIKE '%plan%' OR nombre ILIKE '%informe%' OR nombre ILIKE '%reporte%';

UPDATE public.tipos_documento 
SET 
  tipos_archivo_permitidos = ARRAY['pdf', 'doc', 'docx', 'xls', 'xlsx'],
  descripcion_tipos_archivo = 'PDF, Word, Excel'
WHERE nombre ILIKE '%evaluación%' OR nombre ILIKE '%examen%' OR nombre ILIKE '%control%';

UPDATE public.tipos_documento 
SET 
  tipos_archivo_permitidos = ARRAY['pdf', 'doc', 'docx', 'ppt', 'pptx'],
  descripcion_tipos_archivo = 'PDF, Word, PowerPoint'
WHERE nombre ILIKE '%presentación%' OR nombre ILIKE '%material%';

-- 6. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_tipos_documento_tipos_archivo ON public.tipos_documento USING gin(tipos_archivo_permitidos);

-- 7. Crear trigger para validar tipos de archivo al insertar documentos
CREATE OR REPLACE FUNCTION trigger_validar_tipo_archivo()
RETURNS trigger AS $$
BEGIN
  -- Validar tipo de archivo si se proporciona
  IF NEW.nombre_original IS NOT NULL AND NEW.tipo_documento_id IS NOT NULL THEN
    IF NOT validar_tipo_archivo(NEW.tipo_documento_id, NEW.nombre_original) THEN
      RAISE EXCEPTION 'Tipo de archivo no permitido para este tipo de documento';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS trigger_validar_tipo_archivo ON public.documentos;
CREATE TRIGGER trigger_validar_tipo_archivo
  BEFORE INSERT OR UPDATE ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_validar_tipo_archivo();

-- 8. Crear función para obtener tipos de archivo permitidos por tipo de documento
CREATE OR REPLACE FUNCTION obtener_tipos_archivo_permitidos(p_tipo_documento_id integer)
RETURNS TABLE(
  tipos_permitidos text[],
  descripcion text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(td.tipos_archivo_permitidos, ARRAY['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']),
    COALESCE(td.descripcion_tipos_archivo, 'Todos los tipos de archivo')
  FROM public.tipos_documento td
  WHERE td.id = p_tipo_documento_id AND td.activo = true;
END;
$$ LANGUAGE plpgsql;

-- 9. Verificar la migración
SELECT 
  'Migración completada' as status,
  COUNT(*) as total_tipos_documento,
  COUNT(CASE WHEN tipos_archivo_permitidos IS NOT NULL THEN 1 END) as tipos_con_filtros
FROM public.tipos_documento; 