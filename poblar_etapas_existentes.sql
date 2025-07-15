-- Script para poblar etapas en periodos académicos existentes
-- Ejecutar después de la migración principal

-- Verificar periodos existentes
SELECT id, codigo, nombre FROM public.periodos_academicos WHERE activo = true;

-- Poblar etapas para todos los periodos activos
INSERT INTO public.etapas (nombre, orden, periodo_id) 
SELECT 'Diagnóstico', 0, id 
FROM public.periodos_academicos 
WHERE id NOT IN (
    SELECT DISTINCT periodo_id 
    FROM public.etapas 
    WHERE nombre = 'Diagnóstico'
);

INSERT INTO public.etapas (nombre, orden, periodo_id) 
SELECT 'Trimestre 1', 1, id 
FROM public.periodos_academicos 
WHERE id NOT IN (
    SELECT DISTINCT periodo_id 
    FROM public.etapas 
    WHERE nombre = 'Trimestre 1'
);

INSERT INTO public.etapas (nombre, orden, periodo_id) 
SELECT 'Trimestre 2', 2, id 
FROM public.periodos_academicos 
WHERE id NOT IN (
    SELECT DISTINCT periodo_id 
    FROM public.etapas 
    WHERE nombre = 'Trimestre 2'
);

INSERT INTO public.etapas (nombre, orden, periodo_id) 
SELECT 'Trimestre 3', 3, id 
FROM public.periodos_academicos 
WHERE id NOT IN (
    SELECT DISTINCT periodo_id 
    FROM public.etapas 
    WHERE nombre = 'Trimestre 3'
);

INSERT INTO public.etapas (nombre, orden, periodo_id) 
SELECT 'Supletorio', 4, id 
FROM public.periodos_academicos 
WHERE id NOT IN (
    SELECT DISTINCT periodo_id 
    FROM public.etapas 
    WHERE nombre = 'Supletorio'
);

-- Verificar que se crearon las etapas
SELECT 
    p.codigo as periodo_codigo,
    p.nombre as periodo_nombre,
    e.nombre as etapa_nombre,
    e.orden as etapa_orden
FROM public.periodos_academicos p
JOIN public.etapas e ON p.id = e.periodo_id
WHERE p.activo = true
ORDER BY p.id, e.orden; 