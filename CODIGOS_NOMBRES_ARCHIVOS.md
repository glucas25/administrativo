# Convención de Nombres de Archivos para Documentos

Los archivos subidos al sistema se almacenan en Supabase Storage con un nombre único y estructurado, siguiendo la siguiente convención:

```
TIPO_DOCUMENTO-ETAPA-PERIODO-SUBNIVEL-CURSO_PARALELO-ASIGNATURA-PRIMERAPELLIDO-PRIMERNOMBRE-FECHA.EXT
```

## Ejemplo

```
PLAN-DIAG-2025_2026-BS-9A-MAT-LUCAS-GABRIEL-13-07-2025.pdf
```

## Descripción de los Códigos

| Campo              | Descripción                                      | Ejemplo / Código         |
|--------------------|--------------------------------------------------|-------------------------|
| TIPO_DOCUMENTO     | Código del tipo de documento                     | PLAN, DIAG, INF, EXAM   |
| ETAPA              | Código de la etapa                               | DIAG, PLAN, EJEC, EVAL  |
| PERIODO            | Periodo académico, con guion bajo                | 2025_2026               |
| SUBNIVEL           | Código del subnivel educativo                    | BS, BE, INI, PRE, BACH  |
| CURSO_PARALELO     | Curso y paralelo juntos, sin espacios            | 9A, 10B, 1C             |
| ASIGNATURA         | Código de la asignatura                          | MAT, LEN, CIE, HIS      |
| PRIMERAPELLIDO     | Primer apellido del docente                      | LUCAS                   |
| PRIMERNOMBRE       | Primer nombre del docente                        | GABRIEL                 |
| FECHA              | Fecha de subida en formato DD-MM-YYYY            | 13-07-2025              |
| EXT                | Extensión del archivo original                   | pdf, docx, etc.         |

## Tabla de Códigos Usados

### Tipos de Documento
| Nombre           | Código |
|------------------|--------|
| Diagnóstico      | DIAG   |
| Plan             | PLAN   |
| Informe          | INF    |
| Proyecto         | PROY   |
| Acta             | ACTA   |
| Guía             | GUIA   |
| Examen           | EXAM   |
| Reporte          | REP    |
| Otro             | OTRO   |

### Etapas
| Nombre           | Código |
|------------------|--------|
| Diagnóstico      | DIAG   |
| Planificación    | PLAN   |
| Ejecución        | EJEC   |
| Evaluación       | EVAL   |
| Seguimiento      | SEG    |

### Subniveles
| Nombre              | Código |
|---------------------|--------|
| Básico Superior     | BS     |
| Básico Elemental    | BE     |
| Inicial             | INI    |
| Preparatoria        | PRE    |
| Bachillerato        | BACH   |

### Asignaturas
| Nombre              | Código |
|---------------------|--------|
| Matemáticas         | MAT    |
| Lengua              | LEN    |
| Ciencias            | CIE    |
| Historia            | HIS    |
| Inglés              | ING    |
| Física              | FIS    |
| Química             | QUI    |
| Biología            | BIO    |
| Educación Física    | EDF    |

> **Nota:** Si un nombre no está en la tabla, se genera un código automático usando las primeras letras en mayúsculas y sin caracteres especiales.

## Observaciones
- Todos los campos se sanitizan para evitar caracteres no válidos.
- Si algún campo no está disponible, se omite en el nombre.
- La fecha corresponde al momento de la subida. 