-- Migración para implementar etapas académicas
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tabla etapas
CREATE TABLE IF NOT EXISTS public.etapas (
    id integer NOT NULL DEFAULT nextval('etapas_id_seq'::regclass),
    nombre character varying NOT NULL,
    orden integer NOT NULL,
    periodo_id integer NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT etapas_pkey PRIMARY KEY (id),
    CONSTRAINT etapas_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.periodos_academicos(id)
);

-- 2. Crear secuencia para etapas (si no existe automáticamente)
CREATE SEQUENCE IF NOT EXISTS etapas_id_seq;

-- 3. Agregar campo etapa_id a entregas_programadas
ALTER TABLE public.entregas_programadas 
ADD COLUMN IF NOT EXISTS etapa_id integer REFERENCES public.etapas(id);

-- 4. Agregar campo etapa_id a documentos (para tracking)
ALTER TABLE public.documentos 
ADD COLUMN IF NOT EXISTS etapa_id integer REFERENCES public.etapas(id);

-- 5. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_etapas_periodo_id ON public.etapas(periodo_id);
CREATE INDEX IF NOT EXISTS idx_entregas_programadas_etapa_id ON public.entregas_programadas(etapa_id);
CREATE INDEX IF NOT EXISTS idx_documentos_etapa_id ON public.documentos(etapa_id);

-- 6. Función para poblar etapas automáticamente al crear un periodo
CREATE OR REPLACE FUNCTION poblar_etapas_por_periodo(periodo_id_param integer)
RETURNS void AS $$
BEGIN
    INSERT INTO public.etapas (nombre, orden, periodo_id) VALUES
    ('Diagnóstico', 0, periodo_id_param),
    ('Trimestre 1', 1, periodo_id_param),
    ('Trimestre 2', 2, periodo_id_param),
    ('Trimestre 3', 3, periodo_id_param),
    ('Supletorio', 4, periodo_id_param);
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger para poblar etapas automáticamente al crear un periodo
CREATE OR REPLACE FUNCTION trigger_poblar_etapas()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM poblar_etapas_por_periodo(NEW.id);
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS trigger_poblar_etapas_trigger ON public.periodos_academicos;
CREATE TRIGGER trigger_poblar_etapas_trigger
    AFTER INSERT ON public.periodos_academicos
    FOR EACH ROW
    EXECUTE FUNCTION trigger_poblar_etapas();

-- 8. Poblar etapas para periodos existentes (ejecutar solo si hay periodos sin etapas)
-- Descomenta y ajusta el periodo_id según tus datos existentes
/*
INSERT INTO public.etapas (nombre, orden, periodo_id) 
SELECT 'Diagnóstico', 0, id FROM public.periodos_academicos 
WHERE id NOT IN (SELECT DISTINCT periodo_id FROM public.etapas);

INSERT INTO public.etapas (nombre, orden, periodo_id) 
SELECT 'Trimestre 1', 1, id FROM public.periodos_academicos 
WHERE id NOT IN (SELECT DISTINCT periodo_id FROM public.etapas);

INSERT INTO public.etapas (nombre, orden, periodo_id) 
SELECT 'Trimestre 2', 2, id FROM public.periodos_academicos 
WHERE id NOT IN (SELECT DISTINCT periodo_id FROM public.etapas);

INSERT INTO public.etapas (nombre, orden, periodo_id) 
SELECT 'Trimestre 3', 3, id FROM public.periodos_academicos 
WHERE id NOT IN (SELECT DISTINCT periodo_id FROM public.etapas);

INSERT INTO public.etapas (nombre, orden, periodo_id) 
SELECT 'Supletorio', 4, id FROM public.periodos_academicos 
WHERE id NOT IN (SELECT DISTINCT periodo_id FROM public.etapas);
*/

-- 9. Vista para consultar documentos agrupados por etapa
CREATE OR REPLACE VIEW documentos_por_etapa AS
SELECT 
    e.id as etapa_id,
    e.nombre as etapa_nombre,
    e.orden as etapa_orden,
    p.id as periodo_id,
    p.nombre as periodo_nombre,
    COUNT(d.id) as total_documentos,
    COUNT(CASE WHEN d.estado = 'APROBADO' THEN 1 END) as documentos_aprobados,
    COUNT(CASE WHEN d.estado IN ('ENVIADO', 'EN_REVISION', 'OBSERVADO') THEN 1 END) as documentos_pendientes
FROM public.etapas e
JOIN public.periodos_academicos p ON e.periodo_id = p.id
LEFT JOIN public.documentos d ON e.id = d.etapa_id
WHERE e.activo = true
GROUP BY e.id, e.nombre, e.orden, p.id, p.nombre
ORDER BY p.id, e.orden;

-- 10. Comentarios para documentación
COMMENT ON TABLE public.etapas IS 'Etapas académicas del año lectivo (Diagnóstico, Trimestres, Supletorio)';
COMMENT ON COLUMN public.entregas_programadas.etapa_id IS 'Etapa académica a la que pertenece esta entrega programada';
COMMENT ON COLUMN public.documentos.etapa_id IS 'Etapa académica a la que pertenece este documento'; 