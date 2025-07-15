# Implementación de Etapas Académicas

Este documento describe la implementación completa del sistema de etapas académicas para clasificar documentos por trimestres y etapas especiales.

## 📋 Resumen de Cambios

### 1. **Estructura de Base de Datos**
- Nueva tabla `etapas` para definir etapas del año lectivo
- Campos `etapa_id` agregados a `entregas_programadas` y `documentos`
- Triggers automáticos para poblar etapas al crear periodos

### 2. **Etapas Definidas**
- **Diagnóstico** (orden: 0) - Etapa inicial de diagnóstico/nivelación
- **Trimestre 1** (orden: 1) - Primer trimestre
- **Trimestre 2** (orden: 2) - Segundo trimestre  
- **Trimestre 3** (orden: 3) - Tercer trimestre
- **Supletorio** (orden: 4) - Etapa de recuperación

### 3. **Frontend Actualizado**
- Dashboard del docente agrupa documentos por etapa
- Interfaz visual con colores por etapa
- Filtros y navegación mejorada

## 🚀 Pasos de Implementación

### Paso 1: Ejecutar Migración SQL

1. **Ir a Supabase Dashboard** → SQL Editor
2. **Ejecutar el script de migración**:

```sql
-- Copiar y ejecutar el contenido de migration_etapas.sql
```

### Paso 2: Poblar Etapas en Periodos Existentes

**Opción A: Usando SQL (Recomendado)**
```sql
-- Ejecutar en Supabase SQL Editor
-- Copiar y ejecutar el contenido de poblar_etapas_existentes.sql
```

**Opción B: Usando Script Node.js**
```bash
# Crear archivo .env con variables de Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_url
SUPABASE_SERVICE_ROLE_KEY=tu_service_key

# Ejecutar script
node scripts/poblar_etapas.js
```

### Paso 3: Verificar Implementación

1. **Verificar etapas creadas**:
```sql
SELECT 
  p.codigo as periodo_codigo,
  p.nombre as periodo_nombre,
  e.nombre as etapa_nombre,
  e.orden as etapa_orden
FROM public.periodos_academicos p
JOIN public.etapas e ON p.id = e.periodo_id
WHERE p.activo = true
ORDER BY p.id, e.orden;
```

2. **Verificar estructura de tablas**:
```sql
-- Verificar que los campos etapa_id existen
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('entregas_programadas', 'documentos', 'etapas')
AND column_name LIKE '%etapa%';
```

## 📊 Funcionalidades Implementadas

### Para el Docente
- ✅ **Dashboard agrupado por etapas**: Los documentos se muestran organizados por etapa académica
- ✅ **Indicadores visuales**: Cada etapa tiene un color distintivo
- ✅ **Filtros por etapa**: Fácil navegación entre etapas
- ✅ **Subida contextual**: Al subir un documento, se asocia automáticamente a la etapa correspondiente

### Para el Vicerrector
- ✅ **Asignación por etapa**: Al crear entregas programadas, se puede especificar la etapa
- ✅ **Gestión de periodos**: Las etapas se crean automáticamente al crear un nuevo periodo
- ✅ **Vista consolidada**: Puede ver el progreso por etapa y por docente

## 🔧 Configuración Adicional

### Variables de Entorno Requeridas
```env
# Google Drive (para subida de archivos)
GOOGLE_APPLICATION_CREDENTIALS=path/to/google-credentials.json
GOOGLE_DRIVE_FOLDER_ID=tu_folder_id

# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_url
SUPABASE_SERVICE_ROLE_KEY=tu_service_key
```

### Archivos Modificados
- ✅ `types/database.ts` - Tipos TypeScript actualizados
- ✅ `app/docente/page.tsx` - Dashboard con etapas
- ✅ `app/api/documentos/upload/route.ts` - Endpoint de upload actualizado
- ✅ `migration_etapas.sql` - Script de migración
- ✅ `poblar_etapas_existentes.sql` - Script para poblar datos existentes
- ✅ `scripts/poblar_etapas.js` - Script Node.js alternativo

## 🎯 Flujo de Trabajo

### 1. **Configuración Inicial (Vicerrector)**
1. Crear nuevo periodo académico
2. Las etapas se crean automáticamente (Diagnóstico, Trimestre 1, 2, 3, Supletorio)
3. Crear entregas programadas asignándolas a etapas específicas

### 2. **Uso Diario (Docente)**
1. Ver dashboard agrupado por etapas
2. Identificar documentos pendientes por etapa
3. Subir documentos (se asocian automáticamente a la etapa)
4. Seguir progreso por etapa

### 3. **Gestión Académica**
1. Etapa de Diagnóstico: Solo al inicio del año
2. Trimestres: Secuenciales durante el año
3. Supletorio: Para recuperación y casos especiales

## 🔍 Verificación Post-Implementación

### Checklist de Verificación
- [ ] Tabla `etapas` creada con datos
- [ ] Campos `etapa_id` agregados a `entregas_programadas` y `documentos`
- [ ] Dashboard del docente muestra etapas correctamente
- [ ] Subida de documentos funciona con etapas
- [ ] Triggers automáticos funcionan para nuevos periodos

### Comandos de Verificación
```sql
-- Verificar etapas creadas
SELECT COUNT(*) FROM etapas;

-- Verificar entregas con etapas
SELECT COUNT(*) FROM entregas_programadas WHERE etapa_id IS NOT NULL;

-- Verificar documentos con etapas
SELECT COUNT(*) FROM documentos WHERE etapa_id IS NOT NULL;
```

## 🚨 Solución de Problemas

### Error: "No hay etapas configuradas"
- **Causa**: No se ejecutó el script de poblamiento
- **Solución**: Ejecutar `poblar_etapas_existentes.sql` en Supabase

### Error: "Campo etapa_id no existe"
- **Causa**: No se ejecutó la migración completa
- **Solución**: Ejecutar `migration_etapas.sql` completo

### Error: "Google Drive credentials"
- **Causa**: Faltan credenciales de Google Drive
- **Solución**: Configurar `GOOGLE_APPLICATION_CREDENTIALS` y `GOOGLE_DRIVE_FOLDER_ID`

## 📈 Próximos Pasos

1. **Implementar filtros avanzados** por etapa en el dashboard
2. **Agregar reportes** de progreso por etapa
3. **Implementar notificaciones** por etapa
4. **Crear vista de vicerrector** para gestión de etapas
5. **Agregar validaciones** de fechas por etapa

---

**Nota**: Esta implementación mantiene compatibilidad con datos existentes y permite una migración gradual sin afectar la funcionalidad actual. 