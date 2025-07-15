# Filtros de Tipos de Archivo

## 📋 Descripción

El sistema ahora incluye una funcionalidad avanzada de filtros de tipos de archivo que permite al vicerrector configurar qué tipos de archivo pueden subir los docentes para cada tipo de documento específico.

## 🎯 Características

### Para el Vicerrector
- **Configuración flexible**: Puede especificar qué tipos de archivo son permitidos para cada tipo de documento
- **Interfaz intuitiva**: Checkboxes para seleccionar tipos de archivo permitidos
- **Descripción automática**: El sistema genera automáticamente una descripción legible de los tipos permitidos
- **Validación en tiempo real**: Los cambios se aplican inmediatamente

### Para el Docente
- **Validación automática**: El sistema valida el tipo de archivo antes de permitir la subida
- **Información clara**: Se muestra qué tipos de archivo son permitidos para cada documento
- **Feedback visual**: Indicadores visuales de archivos válidos/inválidos
- **Mensajes de error**: Explicaciones claras cuando un archivo no es permitido

## 🗂️ Tipos de Archivo Soportados

| Tipo | Extensión | Descripción | Icono |
|------|-----------|-------------|-------|
| PDF | `.pdf` | Documentos PDF | 📄 |
| Word | `.doc`, `.docx` | Documentos de Word | 📝 |
| Excel | `.xls`, `.xlsx` | Hojas de cálculo | 📊 |
| PowerPoint | `.ppt`, `.pptx` | Presentaciones | 📈 |
| Texto | `.txt` | Archivos de texto plano | 📄 |
| Rich Text | `.rtf` | Texto enriquecido | 📄 |
| Comprimido | `.zip`, `.rar` | Archivos comprimidos | 📦 |

## ⚙️ Configuración

### 1. Migración de Base de Datos

Ejecutar la migración en Supabase SQL Editor:

```sql
-- Ejecutar migration_tipos_archivo.sql
```

### 2. Configurar Tipos de Documento

1. Ir a **Vicerrector > Tipos de Documento**
2. Crear o editar un tipo de documento
3. En la sección "Tipos de Archivo Permitidos":
   - Seleccionar los tipos de archivo deseados
   - La descripción se genera automáticamente
4. Guardar los cambios

### 3. Configuraciones Recomendadas

#### Para Planificaciones e Informes
```
Tipos permitidos: PDF, Word
Descripción: PDF, Word
```

#### Para Evaluaciones
```
Tipos permitidos: PDF, Word, Excel
Descripción: PDF, Word, Excel
```

#### Para Presentaciones y Materiales
```
Tipos permitidos: PDF, Word, PowerPoint
Descripción: PDF, Word, PowerPoint
```

#### Para Documentos Generales
```
Tipos permitidos: Todos
Descripción: Todos los tipos de archivo
```

## 🔧 Funciones de Base de Datos

### `validar_tipo_archivo(p_tipo_documento_id, p_nombre_archivo)`
Valida si un archivo es permitido para un tipo de documento específico.

**Parámetros:**
- `p_tipo_documento_id`: ID del tipo de documento
- `p_nombre_archivo`: Nombre del archivo (incluye extensión)

**Retorna:** `boolean` - `true` si es permitido, `false` si no

### `obtener_descripcion_tipos_archivo(p_tipo_documento_id)`
Obtiene la descripción legible de los tipos de archivo permitidos.

**Parámetros:**
- `p_tipo_documento_id`: ID del tipo de documento

**Retorna:** `text` - Descripción de tipos permitidos

### `obtener_tipos_archivo_permitidos(p_tipo_documento_id)`
Obtiene la lista completa de tipos de archivo permitidos.

**Parámetros:**
- `p_tipo_documento_id`: ID del tipo de documento

**Retorna:** `table` con `tipos_permitidos` y `descripcion`

## 🚀 Uso en el Frontend

### Validación en Tiempo Real

```typescript
const validateFileType = (file: File, tipoDocumentoId: number) => {
  const tipoDocumento = tiposDocumento.find(t => t.id === tipoDocumentoId)
  if (!tipoDocumento || !tipoDocumento.tipos_archivo_permitidos) {
    return true // Si no hay restricciones, permitir
  }

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension) {
    toast.error('Archivo sin extensión válida')
    setFile(null)
    return false
  }

  if (!tipoDocumento.tipos_archivo_permitidos.includes(extension)) {
    toast.error(`Tipo de archivo no permitido. Tipos permitidos: ${tipoDocumento.descripcion_tipos_archivo}`)
    setFile(null)
    return false
  }

  return true
}
```

### Mostrar Información al Usuario

```typescript
const getTiposArchivoPermitidos = (tipoDocumentoId: number) => {
  const tipoDocumento = tiposDocumento.find(t => t.id === tipoDocumentoId)
  if (!tipoDocumento || !tipoDocumento.tipos_archivo_permitidos) {
    return 'Todos los tipos de archivo'
  }
  return tipoDocumento.descripcion_tipos_archivo || tipoDocumento.tipos_archivo_permitidos.join(', ')
}
```

## 🧪 Pruebas

### Script de Pruebas

Ejecutar el script de pruebas:

```bash
npm run test-filtros-archivo
```

### Casos de Prueba

1. **Validación de tipos permitidos**
   - Crear tipo de documento con filtros específicos
   - Probar archivos válidos e inválidos
   - Verificar mensajes de error

2. **Configuración del vicerrector**
   - Crear tipos de documento con diferentes filtros
   - Verificar que la descripción se genera correctamente
   - Probar la interfaz de selección

3. **Experiencia del docente**
   - Probar subida de archivos válidos
   - Probar subida de archivos inválidos
   - Verificar mensajes informativos

## 🔒 Seguridad

### Validación en Múltiples Niveles

1. **Frontend**: Validación en tiempo real para mejor UX
2. **Backend**: Validación en la API antes de procesar
3. **Base de datos**: Trigger de validación como última línea de defensa

### Triggers de Base de Datos

```sql
CREATE TRIGGER trigger_validar_tipo_archivo
  BEFORE INSERT OR UPDATE ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_validar_tipo_archivo();
```

## 📊 Estadísticas

### Métricas de Uso

- **Tipos de documento configurados**: Número de tipos con filtros específicos
- **Archivos rechazados**: Contador de archivos que no pasaron la validación
- **Tipos más populares**: Estadísticas de tipos de archivo más utilizados

### Monitoreo

```sql
-- Consultar estadísticas de validación
SELECT 
  td.nombre as tipo_documento,
  COUNT(*) as total_documentos,
  COUNT(CASE WHEN d.estado = 'ENVIADO' THEN 1 END) as enviados,
  td.tipos_archivo_permitidos
FROM tipos_documento td
LEFT JOIN documentos d ON td.id = d.tipo_documento_id
WHERE td.activo = true
GROUP BY td.id, td.nombre, td.tipos_archivo_permitidos
ORDER BY total_documentos DESC;
```

## 🛠️ Mantenimiento

### Actualizar Tipos de Archivo

Para agregar nuevos tipos de archivo:

1. Actualizar el array `TIPOS_ARCHIVO_DISPONIBLES` en el frontend
2. Actualizar la documentación
3. Probar con el script de pruebas

### Migración de Datos

Para tipos de documento existentes sin filtros:

```sql
-- Aplicar filtros por defecto
UPDATE tipos_documento 
SET 
  tipos_archivo_permitidos = ARRAY['pdf', 'doc', 'docx'],
  descripcion_tipos_archivo = 'PDF, Word'
WHERE tipos_archivo_permitidos IS NULL;
```

## 🚨 Troubleshooting

### Problemas Comunes

1. **Archivo rechazado incorrectamente**
   - Verificar que la extensión esté en minúsculas
   - Comprobar que el tipo de documento tenga filtros configurados

2. **Error en la validación**
   - Verificar que las funciones de base de datos estén creadas
   - Comprobar permisos de usuario

3. **Interfaz no muestra información**
   - Verificar que el tipo de documento tenga `descripcion_tipos_archivo`
   - Comprobar que el componente esté recibiendo los datos correctos

### Logs de Debug

```sql
-- Verificar configuración de tipos de documento
SELECT 
  id,
  nombre,
  tipos_archivo_permitidos,
  descripcion_tipos_archivo
FROM tipos_documento 
WHERE activo = true
ORDER BY nombre;
```

## 📈 Roadmap

### Próximas Mejoras

1. **Filtros por tamaño**: Límites de tamaño de archivo por tipo
2. **Validación de contenido**: Verificación del contenido del archivo
3. **Plantillas**: Archivos de plantilla por tipo de documento
4. **Historial de cambios**: Tracking de cambios en la configuración
5. **Notificaciones**: Alertas cuando se cambian los filtros

### Integración con Google Drive

- Validación de tipos de archivo antes de subir a Drive
- Organización automática por tipo de archivo
- Metadatos adicionales en Drive

---

**Nota**: Esta funcionalidad mejora significativamente la experiencia del usuario y la consistencia de los documentos en el sistema, asegurando que los docentes suban archivos en los formatos apropiados para cada tipo de documento. 