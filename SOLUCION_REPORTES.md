# Solución para la Página de Reportes del Vicerrector

## 🔍 Problema Identificado

La página de "Generar reportes" en el dashboard del vicerrector no muestra datos porque:

1. **Vista faltante**: La vista `vista_documentos_completa` no existe en la base de datos
2. **Consulta incorrecta**: La consulta original intentaba acceder a `perfiles_docentes` que ya no se usa
3. **Relaciones incorrectas**: Las relaciones entre tablas no están configuradas correctamente

## 🛠️ Solución

### Paso 1: Crear la Vista en Supabase

1. **Ir a Supabase Dashboard** → SQL Editor
2. **Ejecutar el siguiente SQL**:

```sql
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
```

### Paso 2: Verificar la Vista

Ejecutar en SQL Editor para verificar que la vista se creó correctamente:

```sql
-- Verificar que la vista existe
SELECT EXISTS (
  SELECT FROM information_schema.views 
  WHERE table_name = 'vista_documentos_completa'
) as vista_existe;

-- Probar la vista
SELECT * FROM vista_documentos_completa LIMIT 5;
```

### Paso 3: Código Actualizado

El código de la página de reportes ya ha sido actualizado para usar la vista correcta:

```typescript
const cargarReportes = async () => {
  setLoading(true);
  try {
    // Usar la vista completa para obtener datos
    const { data, error } = await supabase
      .from('vista_documentos_completa')
      .select('estado, docente_nombre_completo, docente_apellidos, docente_nombres');
    
    if (error) {
      console.error('Error en la consulta:', error);
      throw error;
    }
    
    // Agrupar por docente
    const agrupado: { [nombre: string]: ReporteDocente } = {};
    (data || []).forEach((doc: any) => {
      let nombre = 'Sin nombre';
      
      if (doc.docente_nombre_completo) {
        nombre = doc.docente_nombre_completo;
      } else if (doc.docente_apellidos || doc.docente_nombres) {
        nombre = `${doc.docente_apellidos || ''} ${doc.docente_nombres || ''}`.trim();
      }
      
      if (!agrupado[nombre]) {
        agrupado[nombre] = {
          docente: nombre,
          entregados: 0,
          pendientes: 0,
          observados: 0,
          aprobados: 0,
        };
      }
      // Contar según estado
      if (doc.estado === 'APROBADO') agrupado[nombre].aprobados++;
      else if (doc.estado === 'OBSERVADO') agrupado[nombre].observados++;
      else if (doc.estado === 'ENVIADO' || doc.estado === 'EN_REVISION') agrupado[nombre].pendientes++;
      agrupado[nombre].entregados++;
    });
    
    setReportes(Object.values(agrupado));
  } catch (err) {
    console.error('Error cargando reportes:', err);
    setReportes([]);
  } finally {
    setLoading(false);
  }
};
```

## 🔧 Archivos Modificados

1. **`app/vicerrector/reportes/page.tsx`** - Actualizado para usar la vista correcta
2. **`crear_vista_documentos_completa.sql`** - Script SQL para crear la vista
3. **`scripts/crear-vista-documentos.js`** - Script Node.js para ejecutar el SQL

## ✅ Verificación

Después de ejecutar el SQL, verificar que:

1. **La vista existe**: `SELECT * FROM vista_documentos_completa LIMIT 1;`
2. **Los datos se muestran**: La página de reportes debe mostrar estadísticas por docente
3. **No hay errores en consola**: Revisar la consola del navegador para errores

## 🚨 Posibles Errores

### Error: "relation 'vista_documentos_completa' does not exist"
- **Solución**: Ejecutar el SQL para crear la vista

### Error: "column 'docente_nombre_completo' does not exist"
- **Solución**: Verificar que la vista se creó correctamente con todos los campos

### Error: "No hay datos"
- **Solución**: Verificar que existen documentos en la tabla `documentos`

## 📊 Resultado Esperado

La página de reportes debe mostrar una tabla con:
- **Docente**: Nombre del docente
- **Entregados**: Total de documentos entregados
- **Pendientes**: Documentos en estado ENVIADO o EN_REVISION
- **Observados**: Documentos en estado OBSERVADO
- **Aprobados**: Documentos en estado APROBADO

---

**Nota**: Si después de ejecutar el SQL la página sigue sin mostrar datos, verificar que existen documentos en la base de datos y que los docentes están correctamente asociados. 