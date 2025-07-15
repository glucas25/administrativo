// types/database.ts - Actualizado con la nueva estructura

export type UserRole = 'docente' | 'vicerrector' | 'admin'

export interface Usuario {
  id: string
  nombre_completo?: string
  correo: string
  rol: UserRole
  activo: boolean
  fecha_creacion?: string
  ultimo_acceso?: string
  cedula?: string
  apellidos?: string
  nombres?: string
  funcion?: string
}

export interface Asignatura {
  id: number
  codigo: string
  nombre: string
  tipo?: string
  area?: string
  activo: boolean
  created_at?: string
}

export interface Curso {
  id: number
  codigo: string
  subnivel: string
  curso: string
  paralelo: string
  jornada: string
  periodo_id?: number
  activo: boolean
  created_at?: string
}

export interface CursoAsignatura {
  id: number;
  curso_id: number;
  asignatura_id: number;
  horas_semanales: number;
  activo: boolean;
  cursos?: Curso; // Relación anidada en plural
  asignaturas?: Asignatura; // Relación anidada en plural
}

export interface CargaHoraria {
  id: number
  docente_id: string
  curso_asignatura_id: number
  periodo_id: number
  horas_semanales: number
  activo: boolean
  created_at?: string
  // Relaciones
  curso_asignatura?: CursoAsignatura
  periodo?: PeriodoAcademico
}

export interface PeriodoAcademico {
  id: number
  codigo: string
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
}

// Nueva interfaz para Etapas
export interface Etapa {
  id: number
  nombre: string
  orden: number
  periodo_id: number
  activo: boolean
  created_at?: string
  // Relaciones
  periodo?: PeriodoAcademico
}

export interface TipoDocumento {
  id: number
  codigo: string
  nombre: string
  descripcion?: string
  requiere_revision: boolean
  requiere_asignatura: boolean
  tipos_archivo_permitidos?: string[]
  descripcion_tipos_archivo?: string
  plantilla_url?: string
  creado_por?: string
  activo: boolean
  fecha_creacion?: string
}

export interface EntregaProgramada {
  id: number
  tipo_documento_id: number
  periodo_id: number
  etapa_id?: number // Nuevo campo
  titulo: string
  descripcion?: string
  fecha_inicio: string
  fecha_limite: string
  es_obligatorio: boolean
  activo: boolean
  // Relaciones
  tipo_documento?: TipoDocumento
  periodo?: PeriodoAcademico
  etapa?: Etapa // Nueva relación
}

export interface Documento {
  id: string;
  docente_id: string;
  entrega_id: number | null;
  tipo_documento_id: number | null;
  periodo_id: number | null;
  asignatura_id: number | null;
  etapa_id: number | null;
  curso_asignatura_id: number | null; // <-- permitir nulo
  nombre_archivo: string;
  nombre_original: string;
  tamaño_bytes: number;
  tipo_mime: string;
  link_onedrive: string | null;
  onedrive_file_id: string | null;
  estado: string;
  fecha_subida: string;
  fecha_ultima_modificacion: string;
  fecha_revision?: string;
  revisado_por?: string;
  version: number;
  observaciones: string | null;
  metadata: any;
  entrega?: string | null;
  // Relaciones opcionales
  docente?: {
    nombres?: string;
    apellidos?: string;
  };
  tipos_documento?: {
    nombre?: string;
  };
  tipo_documento?: {
    nombre?: string;
  };
  asignatura?: {
    nombre?: string;
  };
  curso_asignatura?: {
    curso?: {
      curso?: string;
      paralelo?: string;
      jornada?: string;
    };
    asignatura?: {
      nombre?: string;
    };
  };
}

export interface Notificacion {
  id: number
  usuario_id: string
  documento_id?: string
  tipo_notificacion: string
  asunto?: string
  contenido?: string
  enviado: boolean
  fecha_programada?: string
  fecha_envio?: string
  intentos: number
  error_mensaje?: string
}

// Tipos para vistas y consultas complejas
export interface DocenteConCarga {
  usuario: Usuario
  cargas: Array<{
    carga_horaria: CargaHoraria
    curso: Curso
    asignatura: Asignatura
  }>
  total_horas: number
}

export interface DocumentoPendiente {
  entrega: EntregaProgramada
  tipo_documento: TipoDocumento
  etapa?: Etapa // Nueva relación
  dias_restantes: number
  vencido: boolean
}

// Nuevo tipo para agrupar documentos por etapa
export interface DocumentosPorEtapa {
  etapa: Etapa
  documentos: Documento[]
  total_pendientes: number
  total_entregados: number
}
