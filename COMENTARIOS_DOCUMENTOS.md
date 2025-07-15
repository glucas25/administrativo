# Sistema de Comentarios para Documentos

## 📋 Resumen

Se ha implementado un sistema completo de comentarios para el proceso de revisión de documentos, permitiendo al vicerrector agregar observaciones o motivos de rechazo, y al docente visualizar estos comentarios.

## 🎯 Funcionalidades Implementadas

### Para el Vicerrector

#### 1. **Modal de Comentarios**
- Al hacer clic en "Observar" o "Rechazar", se abre un modal
- Muestra información del documento (docente, tipo, asignatura)
- Campo de texto obligatorio para agregar comentarios
- Botones de "Cancelar" y "Confirmar" con validación

#### 2. **Campos de Comentarios**
- **Observaciones**: Para documentos observados (correcciones menores)
- **Motivo del rechazo**: Para documentos rechazados (requisitos no cumplidos)

#### 3. **Registro de Cambios**
- Se actualiza el campo `observaciones` en la tabla `documentos`
- Se registra en `historial_estados` con el comentario
- Se guarda `fecha_revision` y `revisado_por`

### Para el Docente

#### 1. **Indicadores Visuales**
- Iconos específicos para estados: ⚠️ (Observado), ❌ (Rechazado)
- Enlace "Ver comentarios" cuando hay observaciones
- Botón 📋 para ver detalles completos

#### 2. **Modal de Comentarios**
- Muestra información del documento
- Fecha de revisión
- Comentario completo del vicerrector
- Formato legible con saltos de línea

## 🗄️ Estructura de Base de Datos

### Tabla `documentos`
```sql
-- Campos existentes
observaciones text,           -- Comentario del vicerrector
fecha_revision timestamp,     -- Fecha de revisión
revisado_por uuid            -- ID del vicerrector que revisó
```

### Tabla `historial_estados`
```sql
-- Estructura completa
id integer PRIMARY KEY,
documento_id uuid REFERENCES documentos(id),
estado_anterior varchar,
estado_nuevo varchar,
cambiado_por uuid REFERENCES auth.users(id),
fecha_cambio timestamp DEFAULT now(),
comentario text              -- Comentario del cambio
```

## 🔄 Flujo de Trabajo

### 1. **Vicerrector Revisa Documento**
```
1. Accede a "Revisar documentos"
2. Descarga el documento para revisarlo
3. Hace clic en "Observar" o "Rechazar"
4. Completa el modal con comentarios obligatorios
5. Confirma la acción
6. Sistema actualiza estado y registra historial
```

### 2. **Docente Ve Comentarios**
```
1. Accede a "Mis documentos"
2. Ve indicadores visuales en documentos observados/rechazados
3. Hace clic en "Ver comentarios" o 📋
4. Lee los comentarios del vicerrector
5. Realiza correcciones si es necesario
6. Sube nueva versión del documento
```

## 🎨 Interfaz de Usuario

### Modal del Vicerrector
```
┌─────────────────────────────────────┐
│ Observar Documento                  │
├─────────────────────────────────────┤
│ Docente: Juan Pérez                 │
│ Documento: Plan de Clases           │
│ Asignatura: Matemáticas             │
├─────────────────────────────────────┤
│ Comentario (observaciones):         │
│ [Área de texto obligatoria]        │
├─────────────────────────────────────┤
│ [Cancelar] [Observar]              │
└─────────────────────────────────────┘
```

### Modal del Docente
```
┌─────────────────────────────────────┐
│ Observaciones                       │
├─────────────────────────────────────┤
│ Documento: Plan de Clases           │
│ Asignatura: Matemáticas             │
│ Fecha de revisión: 15/01/2025      │
├─────────────────────────────────────┤
│ Comentario del vicerrector:         │
│ ┌─────────────────────────────────┐ │
│ │ Falta incluir evaluación...    │ │
│ │ Agregar objetivos específicos   │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ [Cerrar]                           │
└─────────────────────────────────────┘
```

## 🔧 Configuración Técnica

### Archivos Modificados
- `app/vicerrector/documentos/page.tsx` - Modal y lógica de comentarios
- `app/docente/documentos/page.tsx` - Visualización de comentarios
- `types/database.ts` - Tipos TypeScript actualizados

### Nuevos Archivos
- `verificar_historial_estados.sql` - Script de verificación y optimización
- `COMENTARIOS_DOCUMENTOS.md` - Esta documentación

## 📊 Validaciones

### Frontend
- ✅ Comentario obligatorio para observar/rechazar
- ✅ Validación de longitud mínima
- ✅ Prevención de envío múltiple
- ✅ Manejo de errores con toast

### Backend
- ✅ Actualización atómica de documento
- ✅ Registro en historial de estados
- ✅ Manejo de errores de base de datos
- ✅ Rollback en caso de fallo

## 🚀 Instalación

### 1. Ejecutar Script de Verificación
```sql
-- En Supabase SQL Editor
-- Ejecutar verificar_historial_estados.sql
```

### 2. Verificar Estructura
```sql
-- Verificar que la tabla existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'historial_estados'
);
```

### 3. Probar Funcionalidad
1. **Como Vicerrector**: Revisar un documento y agregar comentarios
2. **Como Docente**: Ver los comentarios en "Mis documentos"

## 🔍 Monitoreo y Reportes

### Consultas Útiles

```sql
-- Documentos con comentarios
SELECT 
  d.estado,
  COUNT(*) as cantidad,
  COUNT(CASE WHEN d.observaciones IS NOT NULL THEN 1 END) as con_comentarios
FROM documentos d
GROUP BY d.estado;

-- Historial de cambios recientes
SELECT 
  h.estado_nuevo,
  h.fecha_cambio,
  h.comentario,
  CONCAT(pd.apellidos, ' ', pd.nombres) as vicerrector
FROM historial_estados h
LEFT JOIN perfiles_docentes pd ON h.cambiado_por = pd.user_id
ORDER BY h.fecha_cambio DESC
LIMIT 10;
```

## 🚨 Solución de Problemas

### Error: "No se pudo actualizar"
- **Causa**: Problemas de permisos o conexión
- **Solución**: Verificar permisos de usuario en Supabase

### Error: "Debe agregar un comentario"
- **Causa**: Campo de comentario vacío
- **Solución**: Completar el campo obligatorio

### Error: "Campo comentario no existe"
- **Causa**: Tabla `historial_estados` no creada
- **Solución**: Ejecutar script de verificación

## 📈 Próximos Pasos

1. **Notificaciones por email** cuando se observa/rechaza un documento
2. **Plantillas de comentarios** para casos comunes
3. **Historial completo** de cambios por documento
4. **Reportes de revisión** por vicerrector
5. **Sistema de respuestas** del docente a las observaciones

## ✅ Checklist de Verificación

- [ ] Tabla `historial_estados` existe y tiene índices
- [ ] Modal del vicerrector funciona correctamente
- [ ] Comentarios se guardan en ambas tablas
- [ ] Docente puede ver comentarios
- [ ] Validaciones funcionan en frontend
- [ ] Manejo de errores implementado
- [ ] Interfaz es responsive y accesible

---

**Nota**: Esta implementación mantiene compatibilidad con datos existentes y proporciona una experiencia de usuario fluida para ambos roles. 