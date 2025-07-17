// app/docente/page.tsx - Dashboard mejorado con etapas
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Usuario, Documento, EntregaProgramada, CargaHoraria, Asignatura, Curso, TipoDocumento, Etapa } from '@/types/database'
import toast from 'react-hot-toast'
import { useRef } from 'react'
// Eliminar: import { useSession } from 'next-auth/react'

interface CargaHorariaCompleta {
  id: number
  curso_asignatura_id: number // <-- agregado para el mapeo correcto
  horas_semanales: number
  curso_asignatura: {
    curso?: Curso
    asignatura?: Asignatura
    horas_semanales: number
  }
}

interface EntregaPendiente extends EntregaProgramada {
  tipo_documento: {
    nombre: string
    codigo: string
  }
  etapa?: Etapa
  dias_restantes: number
  vencido: boolean
}

interface EntregaExpandida extends EntregaProgramada {
  asignatura?: Asignatura
  asignatura_id?: number
  curso?: Curso
  curso_asignatura_id: number | null
  etapa?: Etapa
}

export default function DocenteDashboard() {
  const router = useRouter()
  // Eliminar: const { data: session, status } = useSession()
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [cargaHoraria, setCargaHoraria] = useState<CargaHorariaCompleta[]>([])
  const [entregasPendientes, setEntregasPendientes] = useState<EntregaPendiente[]>([])
  const [documentosRecientes, setDocumentosRecientes] = useState<Documento[]>([])
const [stats, setStats] = useState({
  totalDocumentos: 0,
  pendientes: 0,
  observados: 0,
  aprobados: 0,
  totalHoras: 0,
  asignaturas: 0,
  cursos: 0
})

  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([])
  const [entregas, setEntregas] = useState<EntregaProgramada[]>([])
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [documentosPorEntrega, setDocumentosPorEntrega] = useState<{[key: string]: Documento | null}>({})
  const [formData, setFormData] = useState({
    tipo_documento_id: '',
    entrega_id: '',
    asignatura_id: '',
    observaciones: '',
    observaciones_internas: '',
    curso_asignatura_id: ''
  })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [periodoActivo, setPeriodoActivo] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  // 1. Estado para la entrega seleccionada
  const [entregaSeleccionada, setEntregaSeleccionada] = useState<any>(null);
  // Estado para el modal de observaciones
  const [showObservacionesModal, setShowObservacionesModal] = useState(false);
  const [observacionesSeleccionadas, setObservacionesSeleccionadas] = useState<string | null>(null);
  // Agregar estado para pestañas activas
  const [etapaActiva, setEtapaActiva] = useState<string>('todas');
  const [tipoActivo, setTipoActivo] = useState<string>('todos');
  const [tabActivo, setTabActivo] = useState<'inicio' | 'rendimiento' | 'documentos' | 'carga' | 'soporte'>('inicio');
  // Estado para el modal de comentarios
  const [showComentariosModal, setShowComentariosModal] = useState(false);
  const [comentarioDocente, setComentarioDocente] = useState<string | null>(null);
  const [comentarioVicerrector, setComentarioVicerrector] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        router.push('/auth/login');
        return;
      }
      // Buscar en la vista usuarios_completos por user_id
      const { data, error } = await supabase
        .from('usuarios_completos')
        .select('*')
        .eq('id', userId)
        .single();
      if (!data) {
        setError('Tu usuario no está registrado en el sistema. Contacta al administrador.');
        setLoading(false);
        return;
      }
      if (data.rol !== 'docente') {
        router.push('/auth/login');
        return;
      }
      setUser({
        ...data,
        nombre_completo: data.nombre_completo || `${data.apellidos ?? ''} ${data.nombres ?? ''}`.trim()
      });
      setLoading(false);
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadDocenteData(user.id)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Generar entregas expandidas por asignatura
  const entregasExpandida = entregas.flatMap(entrega => {
    const tipoDoc = tiposDocumento.find(t => t.id === entrega.tipo_documento_id);
    if (tipoDoc && tipoDoc.requiere_asignatura && cargaHoraria.length > 0) {
      // Una fila por cada asignatura de la carga horaria
      return cargaHoraria.map(carga => ({
        ...entrega,
        tipo_documento: tipoDoc,
        curso_asignatura: carga.curso_asignatura,
        asignatura: carga.curso_asignatura.asignatura,
        asignatura_id: carga.curso_asignatura.asignatura?.id,
        curso: carga.curso_asignatura.curso,
        curso_asignatura_id: carga.curso_asignatura_id
      }))
    } else if (tipoDoc) {
      // Solo una fila (entrega general, sin asignatura)
      return [{ ...entrega, tipo_documento: tipoDoc, curso_asignatura: { curso: undefined, asignatura: undefined, horas_semanales: 0 }, asignatura: undefined, asignatura_id: undefined, curso: undefined, curso_asignatura_id: -1 }]
    } else {
      // Si no hay tipoDoc, no devolver nada (evita undefined)
      return [];
    }
  }) as EntregaExpandida[]

  // Mapeo de documentos por entrega_id + curso_asignatura_id
  const documentosPorEntregaAsignatura: {[key: string]: any[]} = {};
  documentosRecientes.forEach(doc => {
    const key = String(doc.entrega_id ?? '') + '_' + String(doc.curso_asignatura_id ?? -1);
    if (!documentosPorEntregaAsignatura[key]) {
      documentosPorEntregaAsignatura[key] = [];
    }
    documentosPorEntregaAsignatura[key].push(doc);
  });

  // Para la tabla de entregados, muestra todos los documentos revisados
  // const documentosEntregados: any[] = [];
  // Object.values(documentosPorEntregaAsignatura).forEach((docs: any[]) => {
  //   docs
  //     .filter(doc => ['ENVIADO', 'EN_REVISION', 'APROBADO', 'OBSERVADO', 'RECHAZADO'].includes(doc.estado))
  //     .forEach(doc => documentosEntregados.push(doc));
  // });

  // Log de depuración para ver las claves y los datos (debe ir después de la declaración de entregasExpandida)
  useEffect(() => {
    console.log('--- DEBUG: Documentos recientes ---')
    documentosRecientes.forEach(doc => {
      const key = String(doc.entrega_id ?? '') + '_' + String(doc.curso_asignatura_id ?? -1)
      console.log(`doc: entrega_id=${doc.entrega_id}, curso_asignatura_id=${doc.curso_asignatura_id}, id=${doc.id}, estado=${doc.estado}, nombre=${doc.nombre_archivo}, clave=${key}`)
    })
    console.log('--- DEBUG: Entregas expandidas ---')
    entregasExpandida.forEach(entrega => {
      const key = String(entrega.id) + '_' + String(typeof entrega.curso_asignatura_id === 'number' ? entrega.curso_asignatura_id : -1)
      console.log(`entrega: id=${entrega.id}, curso_asignatura_id=${entrega.curso_asignatura_id}, asignatura_id=${entrega.asignatura_id}, titulo=${entrega.titulo}, clave=${key}`)
    })
    console.log('--- DEBUG: Mapeo documentosPorEntregaAsignatura ---')
    Object.keys(documentosPorEntregaAsignatura).forEach(key => {
      const doc = documentosPorEntregaAsignatura[key]?.[0];
      console.log(`key=${key} => doc_id=${doc?.id}, estado=${doc?.estado}, nombre=${doc?.nombre_archivo}`)
    })
  }, [documentosRecientes, entregasExpandida, documentosPorEntregaAsignatura])

  if (loading) return <div>Cargando...</div>
  if (error) return <div className="text-red-600 text-center mt-8">{error}</div>
  if (!user) return null;

  const loadDocenteData = async (docenteId: string) => {
    try {
      // Cargar período activo
      const { data: periodoActivo } = await supabase
        .from('periodos_academicos')
        .select('*')
        .eq('activo', true)
        .single()

      if (!periodoActivo) {
        toast('No hay período académico activo')
        return
      }
      setPeriodoActivo(periodoActivo)

      // Cargar etapas del período
      const { data: etapasData } = await supabase
        .from('etapas')
        .select('*')
        .eq('periodo_id', periodoActivo.id)
        .eq('activo', true)
        .order('orden', { ascending: true })

      setEtapas(etapasData || [])

      // Cargar carga horaria con detalles
      const { data: cargaData } = await supabase
        .from('carga_horaria')
        .select(`
          id,
          horas_semanales,
          curso_asignatura_id
        `)
        .eq('docente_id', docenteId)
        .eq('periodo_id', periodoActivo.id)
        .eq('activo', true)

      // Obtener detalles de cada carga
      const cargaCompleta = await Promise.all(
        (cargaData || []).map(async (carga) => {
          const { data: cursoAsig } = await supabase
            .from('curso_asignaturas')
            .select(`
              horas_semanales,
              cursos (
                id,
                codigo,
                subnivel,
                curso,
                paralelo,
                jornada,
                activo
              ),
              asignaturas (
                id,
                codigo,
                nombre,
                area,
                activo
              )
            `)
            .eq('id', carga.curso_asignatura_id)
            .single()

          return {
            id: carga.id,
            curso_asignatura_id: carga.curso_asignatura_id, // Asignar correctamente
            horas_semanales: carga.horas_semanales,
            curso_asignatura: {
              curso: Array.isArray(cursoAsig?.cursos) ? cursoAsig.cursos[0] : cursoAsig?.cursos,
              asignatura: Array.isArray(cursoAsig?.asignaturas) ? cursoAsig.asignaturas[0] : cursoAsig?.asignaturas,
              horas_semanales: cursoAsig?.horas_semanales || 0
            }
          }
        })
      )

      setCargaHoraria(cargaCompleta.filter(c => c.curso_asignatura.curso && c.curso_asignatura.asignatura))

      // Cargar entregas del período con etapas
      const { data: entregasData } = await supabase
        .from('entregas_programadas')
        .select(`
          *,
          tipos_documento (
            nombre,
            codigo
          ),
          etapas (
            id,
            nombre,
            orden
          )
        `)
        .eq('periodo_id', periodoActivo.id)
        .eq('activo', true)
        .eq('es_obligatorio', true)
        .gte('fecha_limite', new Date().toISOString().split('T')[0])

      setEntregas(entregasData || [])

      // Cargar documentos del docente y mapearlos por entrega
      const { data: documentosData } = await supabase
        .from('documentos')
        .select('*') // Traer todos los campos, incluyendo 'entrega' como columna simple
        .eq('docente_id', docenteId)

      console.log('documentosData:', documentosData); // <-- Log para depuración
      // Mapear solo el documento más reciente por entrega_id + curso_asignatura_id
      const documentosPorEntregaMap: {[key: string]: any | null} = {}
      if (documentosData && Array.isArray(documentosData)) {
        // Agrupar por clave entrega_id + curso_asignatura_id
        const grouped: {[key: string]: any[]} = {}
        for (const doc of documentosData) {
          const key = String(doc.entrega_id ?? '') + '_' + String(doc.curso_asignatura_id ?? '')
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(doc)
        }
        // Para cada grupo, tomar el más reciente por fecha_subida
        for (const key in grouped) {
          grouped[key].sort((a, b) => new Date(b.fecha_subida).getTime() - new Date(a.fecha_subida).getTime())
          documentosPorEntregaMap[key] = grouped[key][0]
        }
      }
      setDocumentosPorEntrega(documentosPorEntregaMap)

      // Guardar todos los documentos para el mapeo global
      setDocumentosRecientes(documentosData as Documento[] || [])

      // Verificar cuáles ya fueron entregadas
      const entregasPendientes = await Promise.all(
        (entregasData || []).map(async (entrega) => {
          const { data: documento } = await supabase
            .from('documentos')
            .select('id, estado')
            .eq('docente_id', docenteId)
            .eq('entrega_id', entrega.id)
            .single()

          if (!documento || documento.estado === 'OBSERVADO' || documento.estado === 'RECHAZADO') {
            const diasRestantes = Math.ceil(
              (new Date(entrega.fecha_limite).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            )

            return {
              ...entrega,
              dias_restantes: diasRestantes,
              vencido: diasRestantes < 0
            }
          }
          return null
        })
      )

      setEntregasPendientes(entregasPendientes.filter(Boolean) as EntregaPendiente[])

      const { data: tiposData } = await supabase
        .from('tipos_documento')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })
      setTiposDocumento(tiposData || [])

      const { data: asignData } = await supabase
        .from('asignaturas')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })
      setAsignaturas(asignData || [])

      // Calcular estadísticas
      const { data: allDocumentos } = await supabase
        .from('documentos')
        .select('estado')
        .eq('docente_id', docenteId)

      const totalHoras = cargaCompleta.reduce((sum, c) => sum + c.horas_semanales, 0)
      const asignaturasUnicas = new Set(cargaCompleta.map(c => c.curso_asignatura.asignatura?.id)).size
      const cursosUnicos = new Set(cargaCompleta.map(c => c.curso_asignatura.curso?.id)).size

      setStats({
        totalDocumentos: allDocumentos?.length || 0,
        pendientes: entregasPendientes.filter(Boolean).length,
        observados: allDocumentos?.filter(d => d.estado === 'OBSERVADO').length || 0,
        aprobados: allDocumentos?.filter(d => d.estado === 'APROBADO').length || 0,
        totalHoras,
        asignaturas: asignaturasUnicas,
        cursos: cursosUnicos
      })

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar información')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'APROBADO':
        return 'bg-green-100 text-green-800'
      case 'OBSERVADO':
        return 'bg-yellow-100 text-yellow-800'
      case 'RECHAZADO':
        return 'bg-red-100 text-red-800'
      case 'EN_REVISION':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    setFile(selected)
    
    // Validar tipo de archivo si se ha seleccionado un tipo de documento
    if (selected && formData.tipo_documento_id) {
      validateFileType(selected, parseInt(formData.tipo_documento_id))
    }
  }

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
      toast.error(`Tipo de archivo no permitido. Tipos permitidos: ${tipoDocumento.descripcion_tipos_archivo || tipoDocumento.tipos_archivo_permitidos.join(', ')}`)
      setFile(null)
      return false
    }

    return true
  }

  const handleTipoDocumentoChange = (tipoDocumentoId: string) => {
    setFormData({ ...formData, tipo_documento_id: tipoDocumentoId })
    
    // Si ya hay un archivo seleccionado, validarlo
    if (file && tipoDocumentoId) {
      validateFileType(file, parseInt(tipoDocumentoId))
    }
  }

  const getTiposArchivoPermitidos = (tipoDocumentoId: number) => {
    const tipoDocumento = tiposDocumento.find(t => t.id === tipoDocumentoId)
    if (!tipoDocumento || !tipoDocumento.tipos_archivo_permitidos) {
      return 'Todos los tipos de archivo'
    }
    return tipoDocumento.descripcion_tipos_archivo || tipoDocumento.tipos_archivo_permitidos.join(', ')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast.error('Seleccione un archivo')
      return
    }

    if (!formData.tipo_documento_id) {
      toast.error('Seleccione un tipo de documento')
      return
    }

    // Validar tipo de archivo
    if (!validateFileType(file, parseInt(formData.tipo_documento_id))) {
      return
    }

    // Validar tamaño máximo (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo supera el tamaño máximo permitido (10 MB)')
      return
    }

    setUploading(true)
    try {
      console.log('entregaSeleccionada al enviar:', entregaSeleccionada);
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('docente_id', user?.id || '')
      formDataUpload.append('periodo_id', periodoActivo?.id?.toString() || '')
      formDataUpload.append('tipo_documento_id', entregaSeleccionada?.tipo_documento_id?.toString() || formData.tipo_documento_id)
      if (entregaSeleccionada?.entrega_id || formData.entrega_id) {
        formDataUpload.append('entrega_id', entregaSeleccionada?.id?.toString() || formData.entrega_id)
      }
      if (entregaSeleccionada?.etapa_id) {
        formDataUpload.append('etapa_id', entregaSeleccionada.etapa_id.toString())
      }
      if (entregaSeleccionada?.curso_asignatura_id) {
        formDataUpload.append('curso_asignatura_id', entregaSeleccionada.curso_asignatura_id.toString())
      }
      if (entregaSeleccionada?.asignatura_id || formData.asignatura_id) {
        formDataUpload.append('asignatura_id', entregaSeleccionada?.asignatura_id?.toString() || formData.asignatura_id)
      }
      if (formData.observaciones_internas) {
        formDataUpload.append('observaciones_internas', formData.observaciones_internas)
      }
      const uploadRes = await fetch('/api/documentos/upload', {
        method: 'POST',
        body: formDataUpload
      })
      const uploadJson = await uploadRes.json()
      if (!uploadJson.success) {
        toast.error(uploadJson.error || 'Error subiendo archivo')
        return
      }
      toast.success('Documento subido y registrado correctamente')
      setFormData({
        tipo_documento_id: '',
        entrega_id: '',
        asignatura_id: '',
        observaciones: '',
        observaciones_internas: '',
        curso_asignatura_id: ''
      })
      setFile(null)
      setEntregaSeleccionada(null)
      setShowUploadModal(false)
      if (user?.id) await loadDocenteData(user.id)
    } catch (error: any) {
      console.error('Error subiendo documento:', error)
      toast.error('Error al subir documento: ' + (error?.message || ''))
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  // Si no hay entregas ni carga horaria, mostrar mensaje claro SOLO en la sección de entregas, no ocultar el dashboard
  // Eliminar este bloque:
  // if (entregas.length === 0) {
  //   return <div className="min-h-screen flex items-center justify-center text-gray-500">No tienes entregas programadas para este período.</div>;
  // }
  // if (cargaHoraria.length === 0) {
  //   return <div className="min-h-screen flex items-center justify-center text-gray-500">No tienes carga horaria asignada para este período. Contacta al administrador.</div>;
  // }

  // Función para agrupar documentos por etapa
  const agruparDocumentosPorEtapa = (documentos: any[], entregas: any[]) => {
    const documentosPorEtapa: { [key: string]: any[] } = {}
    
    etapas.forEach(etapa => {
      documentosPorEtapa[etapa.id] = []
    })

    documentos.forEach(doc => {
      const entrega = entregas.find(e => e.id === doc.entrega_id)
      if (entrega?.etapa_id) {
        if (!documentosPorEtapa[entrega.etapa_id]) {
          documentosPorEtapa[entrega.etapa_id] = []
        }
        documentosPorEtapa[entrega.etapa_id].push(doc)
      }
    })

    return documentosPorEtapa
  }

  // Agrupar documentos por etapa
  const documentosPorEtapa = agruparDocumentosPorEtapa(documentosRecientes, entregas)

  // Normaliza el valor de curso_asignatura_id a -1 si es null/undefined
  const normalizaCursoAsignaturaId = (id: number | null | undefined) => {
    return (id === null || id === undefined) ? -1 : id;
  }
  // Crear mapa de entregas expandidas
  const entregasMap: {[key: string]: any} = {};
  entregasExpandida.forEach(e => {
    const key = String(e.id) + '_' + String(normalizaCursoAsignaturaId(e.curso_asignatura_id));
    entregasMap[key] = e;
  });
  // Enriquecer documentos revisados
  const documentosRevisados = documentosRecientes
    .filter(doc => ['ENVIADO', 'EN_REVISION', 'APROBADO', 'OBSERVADO', 'RECHAZADO'].includes(doc.estado))
    .map(doc => {
      const key = String(doc.entrega_id) + '_' + String(normalizaCursoAsignaturaId(doc.curso_asignatura_id));
      const entregaRelacion = entregasMap[key];
      return {
        ...doc,
        tipo_documento: entregaRelacion?.tipo_documento,
        curso_asignatura: entregaRelacion?.curso_asignatura,
        asignatura: entregaRelacion?.asignatura,
        curso: entregaRelacion?.curso,
        titulo: entregaRelacion?.titulo,
        entrega_relacion: entregaRelacion, // Relación, si se necesita
        // NO sobrescribir doc.entrega (string)
      };
    });
  // Filtrar entregas pendientes
  const docsAgrupados: {[key: string]: boolean} = {};
  documentosRevisados.forEach(doc => {
    const key = String(doc.entrega_id) + '_' + String(normalizaCursoAsignaturaId(doc.curso_asignatura_id));
    docsAgrupados[key] = true;
  });
  const entregasNoEntregadas = entregasExpandida.filter(e => {
    const key = String(e.id) + '_' + String(normalizaCursoAsignaturaId(e.curso_asignatura_id));
    return !docsAgrupados[key];
  });

  // 2. Obtener solo los documentos aprobados para la nueva sección
  // Documentos aprobados enriquecidos (con info de entrega)
  const documentosAprobados = documentosRevisados.filter(doc => doc.estado === 'APROBADO');
  // Documentos entregados: solo los que NO son aprobados
  const documentosEntregados = documentosRevisados.filter(doc => doc.estado !== 'APROBADO');

  // Agrupar documentos por etapa y tipo de documento
  const agruparPorEtapaYTipo = (docs: any[]): Record<number, Record<string, any[]>> => {
    const resultado: Record<number, Record<string, any[]>> = {};
    etapas.forEach(etapa => {
      if (typeof etapa.id === 'number') resultado[etapa.id] = {};
    });
    docs.forEach((doc: any) => {
      // Buscar la entrega para obtener la etapa y tipo
      const entregaRelacion = entregas.find(e => e.id === doc.entrega_id);
      if (!entregaRelacion || typeof entregaRelacion.etapa_id !== 'number' || typeof entregaRelacion.tipo_documento_id !== 'number') return;
      const etapaId = entregaRelacion.etapa_id;
      const tipoId = entregaRelacion.tipo_documento_id;
      const tipoNombre = tiposDocumento.find(t => t.id === tipoId)?.nombre || 'Otro';
      if (!resultado[etapaId]) resultado[etapaId] = {};
      if (!resultado[etapaId][tipoNombre]) resultado[etapaId][tipoNombre] = [];
      resultado[etapaId][tipoNombre].push({ ...doc, entrega_relacion: entregaRelacion }); // NO sobrescribir doc.entrega
    });
    return resultado;
  };

  const documentosEntregadosPorEtapaTipo = agruparPorEtapaYTipo(documentosEntregados);
  const documentosAprobadosPorEtapaTipo = agruparPorEtapaYTipo(documentosAprobados);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0057B7] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-6 mb-4 md:mb-0">
            <img
              src="/logo-fondo-azul2.png"
              alt="Logo Unidad Educativa Fiscal Juan León Mera"
              className="h-20 w-20 rounded-full object-cover"
              aria-label="Logo Institución"
            />
            <div className="flex flex-col">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight drop-shadow-md tracking-tight">
                Sistema de Gestión Documental Docente
              </h1>
              <p className="text-base md:text-lg text-blue-100 font-semibold mt-1 tracking-wide drop-shadow-sm">
                Unidad Educativa Fiscal Juan León Mera
              </p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            <span className="text-white font-medium text-base md:text-lg">
              {user?.nombre_completo || `${user?.apellidos ?? ''} ${user?.nombres ?? ''}`.trim()}
            </span>
            <a
              href="#"
              onClick={e => { e.preventDefault(); handleLogout(); }}
              className="ml-0 md:ml-6 text-white hover:underline text-base font-semibold whitespace-nowrap"
              style={{ minWidth: '120px', textAlign: 'right' }}
              aria-label="Cerrar sesión"
            >
              Cerrar sesión
            </a>
          </div>
        </div>
      </header>

      {/* Tabs Responsive */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Tabs */}
          <div className="hidden md:flex gap-2 pt-4 pb-2 bg-white/70 rounded-xl shadow-sm px-2">
            <button onClick={() => setTabActivo('inicio')} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold transition-all duration-200 border-2 ${tabActivo === 'inicio' ? 'bg-[#0057B7] text-white border-[#0057B7] shadow-md scale-105' : 'bg-white text-gray-700 border-transparent hover:bg-blue-50 hover:border-blue-200'}`}> 
              <span className="text-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" /></svg>
              </span>
              <span>Inicio</span>
            </button>
            <button onClick={() => setTabActivo('documentos')} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold transition-all duration-200 border-2 ${tabActivo === 'documentos' ? 'bg-[#0057B7] text-white border-[#0057B7] shadow-md scale-105' : 'bg-white text-gray-700 border-transparent hover:bg-blue-50 hover:border-blue-200'}`}> 
              <span className="text-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </span>
              <span>Documentos</span>
            </button>
            <button onClick={() => setTabActivo('rendimiento')} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold transition-all duration-200 border-2 ${tabActivo === 'rendimiento' ? 'bg-[#0057B7] text-white border-[#0057B7] shadow-md scale-105' : 'bg-white text-gray-700 border-transparent hover:bg-blue-50 hover:border-blue-200'}`}> 
              <span className="text-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </span>
              <span>Rendimiento</span>
            </button>
            <button onClick={() => setTabActivo('carga')} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold transition-all duration-200 border-2 ${tabActivo === 'carga' ? 'bg-[#0057B7] text-white border-[#0057B7] shadow-md scale-105' : 'bg-white text-gray-700 border-transparent hover:bg-blue-50 hover:border-blue-200'}`}> 
              <span className="text-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 17l4 4 4-4m-4-5v9" /></svg>
              </span>
              <span>Carga Horaria</span>
            </button>
            <button onClick={() => setTabActivo('soporte')} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold transition-all duration-200 border-2 ${tabActivo === 'soporte' ? 'bg-[#0057B7] text-white border-[#0057B7] shadow-md scale-105' : 'bg-white text-gray-700 border-transparent hover:bg-blue-50 hover:border-blue-200'}`}> 
              <span className="text-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 17l-4 4m0 0l-4-4m4 4V3" /></svg>
              </span>
              <span>Soporte</span>
            </button>
          </div>
        {/* Mobile Tab Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-gray-200 flex justify-around py-2 shadow-xl rounded-t-xl">
          <button onClick={() => setTabActivo('inicio')} className={`flex flex-col items-center text-xs transition-all duration-200 ${tabActivo === 'inicio' ? 'text-[#0057B7] font-bold scale-110' : 'text-gray-500 hover:text-[#0057B7]'}`}> 
            <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" /></svg>
            <span>Inicio</span>
          </button>
          <button onClick={() => setTabActivo('documentos')} className={`flex flex-col items-center text-xs transition-all duration-200 ${tabActivo === 'documentos' ? 'text-[#0057B7] font-bold scale-110' : 'text-gray-500 hover:text-[#0057B7]'}`}> 
            <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span>Docs</span>
          </button>
          <button onClick={() => setTabActivo('rendimiento')} className={`flex flex-col items-center text-xs transition-all duration-200 ${tabActivo === 'rendimiento' ? 'text-[#0057B7] font-bold scale-110' : 'text-gray-500 hover:text-[#0057B7]'}`}> 
            <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span>Rend.</span>
          </button>
          <button onClick={() => setTabActivo('carga')} className={`flex flex-col items-center text-xs transition-all duration-200 ${tabActivo === 'carga' ? 'text-[#0057B7] font-bold scale-110' : 'text-gray-500 hover:text-[#0057B7]'}`}> 
            <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 17l4 4 4-4m-4-5v9" /></svg>
            <span>Carga</span>
          </button>
          <button onClick={() => setTabActivo('soporte')} className={`flex flex-col items-center text-xs transition-all duration-200 ${tabActivo === 'soporte' ? 'text-[#0057B7] font-bold scale-110' : 'text-gray-500 hover:text-[#0057B7]'}`}> 
            <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 17l-4 4m0 0l-4-4m4 4V3" /></svg>
            <span>Soporte</span>
          </button>
        </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {/* Tabs Content */}
        {tabActivo === 'inicio' && (
          <>
            {/* TAB INICIO: Bienvenida, resumen, timeline, alertas, KPIs */}
            <section className="mb-8">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-100 shadow-lg rounded-2xl p-8 border border-blue-200 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-blue-200 flex items-center justify-center text-4xl font-bold text-white border-4 border-white shadow">
                    {/* Avatar: iniciales */}
                    <span>{user?.nombres?.[0] || ''}{user?.apellidos?.[0] || ''}</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold text-blue-900 mb-1">¡Bienvenido/a, {user?.nombre_completo || `${user?.nombres || ''} ${user?.apellidos || ''}`}!</h2>
                    <p className="text-blue-700 text-lg font-medium">{user?.correo}</p>
                    <p className="text-gray-600 mt-2">¡Gracias por tu dedicación! Recuerda que tu labor impacta positivamente en la formación de los estudiantes. ¡Sigue así! 🚀</p>
                  </div>
                </div>
              </div>
            </section>
            {/* Resumen semanal y alertas inteligentes */}
            <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white shadow rounded-2xl p-6 border border-blue-100">
                <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Resumen semanal
                </h3>
                <ul className="space-y-2">
                  {entregasPendientes.length === 0 ? (
                    <li className="text-gray-500">No tienes entregas pendientes esta semana. ¡Buen trabajo!</li>
                  ) : (
                    entregasPendientes.slice(0, 5).map((entrega, idx) => {
                      // Nombre detallado: tipo documento + título/desc si aplica
                      let detalle = entrega.tipo_documento?.nombre || 'Documento';
                      if (entrega.titulo) detalle += ` - ${entrega.titulo}`;
                      else if (entrega.descripcion) detalle += ` - ${entrega.descripcion}`;
                      return (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <span className={`inline-block w-2 h-2 rounded-full ${entrega.vencido ? 'bg-red-500' : entrega.dias_restantes <= 2 ? 'bg-yellow-400' : 'bg-green-500'}`}></span>
                          <span className="font-semibold">{detalle}</span>
                          <span className="ml-auto text-xs text-gray-500">{entrega.dias_restantes < 0 ? 'Vencido' : `${entrega.dias_restantes} días restantes`}</span>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
              <div className="bg-white shadow rounded-2xl p-6 border border-yellow-100">
                <h3 className="text-lg font-bold text-yellow-700 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" /></svg>
                  Alertas inteligentes
                </h3>
                <ul className="space-y-2">
                  {entregasPendientes.filter(e => e.vencido || e.dias_restantes <= 2).length === 0 ? (
                    <li className="text-gray-500">No hay alertas urgentes. ¡Sigue así!</li>
                  ) : (
                    entregasPendientes.filter(e => e.vencido || e.dias_restantes <= 2).map((entrega, idx) => {
                      let detalle = entrega.tipo_documento?.nombre || 'Documento';
                      if (entrega.titulo) detalle += ` - ${entrega.titulo}`;
                      else if (entrega.descripcion) detalle += ` - ${entrega.descripcion}`;
                      return (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <span className={`inline-block w-2 h-2 rounded-full ${entrega.vencido ? 'bg-red-500' : 'bg-yellow-400'}`}></span>
                          <span className="font-semibold">{detalle}</span>
                          <span className="ml-auto text-xs text-gray-500">{entrega.dias_restantes < 0 ? 'Vencido' : `${entrega.dias_restantes} días restantes`}</span>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </section>
            {/* Timeline de entregas */}
            <section className="mb-8">
              <div className="bg-white shadow rounded-2xl p-6 border border-indigo-100">
                <h3 className="text-lg font-bold text-indigo-700 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h6m-6 0V7a4 4 0 00-4-4H5a4 4 0 00-4 4v10a4 4 0 004 4h6a4 4 0 004-4z" /></svg>
                  Timeline de entregas
                </h3>
                <ol className="relative border-l-2 border-indigo-200 ml-2">
                  {documentosRecientes.length === 0 ? (
                    <li className="mb-6 ml-6 text-gray-500">Aún no has subido documentos.</li>
                  ) : (
                    documentosRecientes.slice(0, 5).map((doc, idx) => {
                      let detalle = doc.tipo_documento?.nombre || doc.tipos_documento?.nombre || 'Documento';
                      if (doc.etapa_id && etapas.length) {
                        const etapa = etapas.find(e => e.id === doc.etapa_id);
                        if (etapa) detalle += ` - ${etapa.nombre}`;
                      }
                      if (doc.asignatura?.nombre) detalle += ` - ${doc.asignatura.nombre}`;
                      if (doc.curso_asignatura?.curso?.curso) detalle += ` - ${doc.curso_asignatura.curso.curso}`;
                      return (
                        <li key={doc.id || idx} className="mb-6 ml-6">
                          <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-8 ring-white ${doc.estado === 'APROBADO' ? 'bg-green-400' : doc.estado === 'OBSERVADO' ? 'bg-yellow-400' : doc.estado === 'RECHAZADO' ? 'bg-red-400' : 'bg-blue-400'}`}></span>
                          <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                            <span className="font-semibold text-indigo-800">{detalle}</span>
                            <span className="text-xs text-gray-500">{doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : ''}</span>
                            <span className={`text-xs font-semibold ml-2 ${getEstadoColor(doc.estado)}`}>{doc.estado}</span>
                          </div>
                          {doc.observaciones && (
                            <div className="text-xs text-yellow-700 mt-1">Obs: {doc.observaciones}</div>
                          )}
                        </li>
                      );
                    })
                  )}
                </ol>
              </div>
            </section>
            {/* KPIs principales */}
            <section className="mb-8">
              <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 shadow-lg rounded-2xl p-8 border border-indigo-200">
                <h3 className="text-xl font-extrabold mb-6 text-indigo-900 tracking-tight flex items-center gap-2">
                  <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  KPIs principales
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-blue-600">{stats.totalDocumentos}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Documentos<br />Subidos</span>
          </div>
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-green-600">{stats.aprobados}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Aprobados</span>
          </div>
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-yellow-600">{stats.observados}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Observados</span>
          </div>
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-purple-600">{stats.totalHoras}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Horas<br />Asignadas</span>
          </div>
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-indigo-600">{stats.asignaturas}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Asignaturas</span>
          </div>
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-pink-600">{stats.cursos}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Cursos</span>
          </div>
        </div>
              </div>
            </section>
          </>
        )}
        {tabActivo === 'rendimiento' && (
          <>
            {/* Estadísticas de Rendimiento */}
            <section className="mb-8">
              <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 shadow-lg rounded-2xl p-8 border border-indigo-200">
                <h2 className="text-2xl font-extrabold mb-6 text-indigo-900 tracking-tight flex items-center gap-2">
                  <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Estadísticas de Rendimiento
                </h2>

                {/* Tarjetas KPI generales */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-blue-600">{stats.totalDocumentos}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Documentos<br />Subidos</span>
          </div>
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-green-600">{stats.aprobados}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Aprobados</span>
          </div>
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-yellow-600">{stats.observados}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Observados</span>
          </div>
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-purple-600">{stats.totalHoras}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Horas<br />Asignadas</span>
          </div>
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-indigo-600">{stats.asignaturas}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Asignaturas</span>
          </div>
                  <div className="bg-white shadow p-4 rounded-lg flex flex-col items-center">
            <span className="text-2xl font-bold text-pink-600">{stats.cursos}</span>
            <span className="text-xs text-gray-600 mt-1 text-center">Cursos</span>
          </div>
        </div>

                {/* KPIs Específicos */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-white shadow p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Puntualidad</p>
                        <p className="text-2xl font-bold text-green-600">
                          {(() => {
                            const aTiempo = documentosRecientes.filter(d => d.entrega === 'A tiempo').length;
                            const total = documentosRecientes.length;
                            return total > 0 ? Math.round((aTiempo / total) * 100) : 0;
                          })()}%
                        </p>
                      </div>
                      <div className="text-green-500">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white shadow p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Anticipación Promedio</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {(() => {
                            const documentosConEntrega = documentosRecientes.filter(d => d.entrega === 'A tiempo');
                            if (documentosConEntrega.length === 0) return '0';
                            return '2.3';
                          })()} días
                        </p>
                      </div>
                      <div className="text-blue-500">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white shadow p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Tasa de Aprobación</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {(() => {
                            const aprobados = documentosRecientes.filter(d => d.estado === 'APROBADO').length;
                            const total = documentosRecientes.length;
                            return total > 0 ? Math.round((aprobados / total) * 100) : 0;
                          })()}%
                        </p>
                      </div>
                      <div className="text-purple-500">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white shadow p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Documentos Enviados</p>
                        <p className="text-2xl font-bold text-indigo-600">{documentosRecientes.length}</p>
                      </div>
                      <div className="text-indigo-500">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white shadow p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Máximo Atraso</p>
                        <p className="text-2xl font-bold text-red-600">
                          {(() => {
                            const docsConAtraso = documentosRecientes.filter(d => d.entrega === 'Con atraso');
                            if (docsConAtraso.length === 0) return '0';
                            
                            let maxAtraso = 0;
                            docsConAtraso.forEach(doc => {
                              const entrega = entregas.find(e => e.id === doc.entrega_id);
                              if (entrega?.fecha_limite && doc.fecha_subida) {
                                const fechaLimite = new Date(entrega.fecha_limite);
                                const fechaSubida = new Date(doc.fecha_subida);
                                const atraso = Math.ceil((fechaSubida.getTime() - fechaLimite.getTime()) / (1000 * 60 * 60 * 24));
                                if (atraso > maxAtraso) {
                                  maxAtraso = atraso;
                                }
                              }
                            });
                            
                            return maxAtraso;
                          })()} días
                        </p>
                      </div>
                      <div className="text-red-500">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Análisis por Tipo de Documento */}
                <div className="bg-white shadow rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Rendimiento por Tipo de Documento
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      const tiposUnicos = [...new Set(documentosRecientes.map(d => d.tipo_documento_id))];
                      
                      return tiposUnicos.map(tipoId => {
                        const docsDelTipo = documentosRecientes.filter(d => d.tipo_documento_id === tipoId);
                        const tipoDoc = tiposDocumento.find(t => t.id === tipoId);
                        const aprobados = docsDelTipo.filter(d => d.estado === 'APROBADO').length;
                        const observados = docsDelTipo.filter(d => d.estado === 'OBSERVADO').length;
                        const rechazados = docsDelTipo.filter(d => d.estado === 'RECHAZADO').length;
                        const aTiempo = docsDelTipo.filter(d => d.entrega === 'A tiempo').length;
                        const total = docsDelTipo.length;
                        
                        return (
                          <div key={tipoId} className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-800 mb-2">{tipoDoc?.nombre || 'Tipo desconocido'}</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Total:</span>
                                <span className="font-semibold">{total}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Aprobados:</span>
                                <span className={`font-semibold ${aprobados/total >= 0.8 ? 'text-green-600' : 'text-yellow-600'}`}>
                                  {total > 0 ? Math.round((aprobados/total) * 100) : 0}% ({aprobados})
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Observados:</span>
                                <span className="font-semibold text-yellow-600">
                                  {total > 0 ? Math.round((observados/total) * 100) : 0}% ({observados})
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Rechazados:</span>
                                <span className="font-semibold text-red-600">
                                  {total > 0 ? Math.round((rechazados/total) * 100) : 0}% ({rechazados})
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Puntualidad:</span>
                                <span className={`font-semibold ${aTiempo/total >= 0.9 ? 'text-green-600' : 'text-yellow-600'}`}>
                                  {total > 0 ? Math.round((aTiempo/total) * 100) : 0}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Comparación por Etapa - Mejorada */}
                <div className="bg-white shadow rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Comparación por Etapa
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Etapa</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Documentos</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Aprobados</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Observados</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Rechazados</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Puntualidad</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {etapas.filter(etapa => {
                          // Solo mostrar etapas que tienen documentos
                          const docsDeEtapa = documentosRecientes.filter(d => {
                            const entrega = entregas.find(e => e.id === d.entrega_id);
                            return entrega?.etapa_id === etapa.id;
                          });
                          return docsDeEtapa.length > 0;
                        }).map((etapa) => {
                          const docsDeEtapa = documentosRecientes.filter(d => {
                            const entrega = entregas.find(e => e.id === d.entrega_id);
                            return entrega?.etapa_id === etapa.id;
                          });
                          const total = docsDeEtapa.length;
                          const aprobados = docsDeEtapa.filter(d => d.estado === 'APROBADO').length;
                          const observados = docsDeEtapa.filter(d => d.estado === 'OBSERVADO').length;
                          const rechazados = docsDeEtapa.filter(d => d.estado === 'RECHAZADO').length;
                          const aTiempo = docsDeEtapa.filter(d => d.entrega === 'A tiempo').length;
                          const puntualidad = total > 0 ? Math.round((aTiempo/total) * 100) : 0;
                          const aprobacion = total > 0 ? Math.round((aprobados/total) * 100) : 0;
                          
                          return (
                            <tr key={etapa.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                                  {etapa.nombre}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-700">{total}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  aprobacion >= 80 ? 'bg-green-100 text-green-800' :
                                  aprobacion >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {aprobados} ({aprobacion}%)
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                  {observados} ({total > 0 ? Math.round((observados/total) * 100) : 0}%)
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                  {rechazados} ({total > 0 ? Math.round((rechazados/total) * 100) : 0}%)
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  puntualidad >= 90 ? 'bg-green-100 text-green-800' :
                                  puntualidad >= 70 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {puntualidad}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {total === 0 ? (
                                  <span className="text-gray-400 text-xs">Sin documentos</span>
                                ) : puntualidad >= 90 && aprobacion >= 80 ? (
                                  <span className="text-green-600 text-xs font-semibold">⭐ Excelente</span>
                                ) : puntualidad >= 70 && aprobacion >= 60 ? (
                                  <span className="text-yellow-600 text-xs font-semibold">📈 Bueno</span>
                                ) : (
                                  <span className="text-red-600 text-xs font-semibold">⚠️ Mejorar</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Badges de Logros */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    Logros y Reconocimientos
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {(() => {
                      const aTiempo = documentosRecientes.filter(d => d.entrega === 'A tiempo').length;
                      const total = documentosRecientes.length;
                      const puntualidad = total > 0 ? (aTiempo / total) * 100 : 0;
                      const aprobados = documentosRecientes.filter(d => d.estado === 'APROBADO').length;
                      const tasaAprobacion = total > 0 ? (aprobados / total) * 100 : 0;
                      
                      const badges = [];
                      
                      if (puntualidad === 100) {
                        badges.push({ text: '🏆 Siempre a tiempo', color: 'bg-yellow-100 text-yellow-800' });
                      } else if (puntualidad >= 90) {
                        badges.push({ text: '⏰ Maestro de la puntualidad', color: 'bg-green-100 text-green-800' });
                      }
                      
                      if (tasaAprobacion >= 80) {
                        badges.push({ text: '✅ Excelente calidad', color: 'bg-blue-100 text-blue-800' });
                      }
                      
                      if (total >= 10) {
                        badges.push({ text: '📚 Docente activo', color: 'bg-purple-100 text-purple-800' });
                      }
                      
                      if (badges.length === 0) {
                        badges.push({ text: '🚀 En camino al éxito', color: 'bg-gray-100 text-gray-800' });
                      }
                      
                      return badges.map((badge, index) => (
                        <span key={index} className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.color}`}>
                          {badge.text}
                        </span>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
        {tabActivo === 'documentos' && (
          <>
            {/* Documentos Solicitados */}
            <section className="mb-8">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 shadow-lg rounded-2xl p-8 border border-blue-200">
                <h2 className="text-2xl font-extrabold mb-6 text-blue-900 tracking-tight flex items-center gap-2">
                  <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h6m-6 0V7a4 4 0 00-4-4H5a4 4 0 00-4 4v10a4 4 0 004 4h6a4 4 0 004-4z" /></svg>
                  Documentos Solicitados
                </h2>
          {entregas.length === 0 ? (
            <p className="text-gray-500">No tienes entregas programadas para este período.</p>
          ) : (
            <div className="space-y-6">
              {etapas.map((etapa) => {
                const entregasDeEtapa = entregasNoEntregadas.filter((entrega: any) => 
                  entrega.etapa_id === etapa.id
                )
                if (entregasDeEtapa.length === 0) return null
                return (
                        <div key={etapa.id} className="border rounded-xl p-4 bg-white/80 shadow mb-4">
                          <h3 className="text-lg font-semibold mb-3 text-blue-800 flex items-center">
                      <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                        etapa.orden === 0 ? 'bg-blue-500' : 
                        etapa.orden === 1 ? 'bg-green-500' : 
                        etapa.orden === 2 ? 'bg-yellow-500' : 
                        etapa.orden === 3 ? 'bg-orange-500' : 'bg-red-500'
                      }`}></span>
                      {etapa.nombre}
                    </h3>
                    <div className="overflow-x-auto">
                            <table className="min-w-full rounded-xl overflow-hidden">
                              <thead className="bg-blue-200 text-white uppercase text-sm font-extrabold tracking-wider shadow-md border-b-4 border-blue-400">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Documento</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Curso</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Asignatura</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fecha Límite</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Días Restantes</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Acción</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Entrega</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {entregasDeEtapa.map((entrega, idx) => {
                                  const key = String(entrega.id) + '_' + String(normalizaCursoAsignaturaId(entrega.curso_asignatura_id))
                                  const documento = documentosPorEntregaAsignatura[key]?.[0] || null;
                            const diasRestantes = Math.ceil(
                              (new Date(entrega.fecha_limite).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                            )
                            const vencido = diasRestantes < 0
                            const puedeSubir = !documento || documento.estado === 'OBSERVADO' || documento.estado === 'RECHAZADO'
                            return (
                              <tr key={key} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">{entrega?.tipo_documento?.nombre || entrega?.titulo || 'Sin nombre'}</td>
                                <td className="px-4 py-3 text-sm">{entrega?.curso ? `${entrega.curso.curso} ${entrega.curso.paralelo || ''}` : '-'}</td>
                                <td className="px-4 py-3 text-sm">{entrega?.asignatura?.nombre || '-'}</td>
                                      <td className="px-4 py-3 text-sm">{entrega?.fecha_limite ? new Date(entrega.fecha_limite).toLocaleDateString() : '-'}</td>
                                <td className="px-4 py-3 text-sm">
                                        {(() => {
                                          const diasRestantes = Math.ceil(
                                            (new Date(entrega.fecha_limite).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                                          );
                                          const vencido = diasRestantes < 0;
                                          return (
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                              vencido 
                                                ? 'bg-red-100 text-red-800' 
                                                : diasRestantes <= 3 
                                                  ? 'bg-yellow-100 text-yellow-800' 
                                                  : 'bg-green-100 text-green-800'
                                            }`}>
                                              {vencido 
                                                ? `Vencido hace ${Math.abs(diasRestantes)} días` 
                                                : `${diasRestantes} días restantes`
                                              }
                                            </span>
                                          );
                                        })()}
                                      </td>
                                      <td className="px-4 py-3 text-sm">
                                        {puedeSubir ? (
                                    <button
                                      onClick={() => {
                                              setEntregaSeleccionada(entrega);
                                        setFormData({
                                          ...formData,
                                          tipo_documento_id: entrega.tipo_documento_id.toString(),
                                          entrega_id: entrega.id.toString(),
                                                asignatura_id: entrega.asignatura_id ? entrega.asignatura_id.toString() : ''
                                              });
                                              setTimeout(() => setShowUploadModal(true), 0);
                                            }}
                                            className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition"
                                    >
                                      {documento ? 'Reemplazar' : 'Subir'}
                                    </button>
                                  ) : (
                                          <span className="text-xs text-gray-400">No editable</span>
                                  )}
                                      </td>
                                      <td className="px-4 py-3 text-sm">
                                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Pendiente</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
            </section>

        {/* Documentos Entregados */}
            <section className="mb-8">
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 shadow-lg rounded-2xl p-8 border border-purple-200">
                <h2 className="text-2xl font-extrabold mb-6 text-purple-900 tracking-tight flex items-center gap-2">
                  <svg className="w-7 h-7 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 17l4 4 4-4m-4-5v9" /></svg>
                  Documentos Entregados
                </h2>
              {etapas.length === 0 ? (
                <p className="text-gray-500">No hay etapas configuradas.</p>
              ) : (
                etapas.map(etapa => {
                  const tipos = documentosEntregadosPorEtapaTipo[etapa.id] || {};
                  const tieneDocs = Object.values(tipos).some(arr => arr.length > 0);
                  if (!tieneDocs) return null;
                  return (
                    <div key={etapa.id} className="mb-6">
                      <h3 className="text-lg font-semibold mb-2 text-blue-800">{etapa.nombre}</h3>
                      {Object.entries(tipos).map(([tipoNombre, docs]) => (
                        <div key={tipoNombre} className="mb-4">
                          <h4 className="text-md font-semibold mb-1 text-gray-700">{tipoNombre}</h4>
                          <div className="overflow-x-auto rounded-xl bg-purple-50 p-2">
                            <table className="min-w-full rounded-xl overflow-hidden">
                              <thead className="bg-purple-200 text-white uppercase text-sm font-extrabold tracking-wider shadow-md border-b-4 border-purple-400">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Documento</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Curso</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Asignatura</th>
                                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Archivo</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fecha de Entrega</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fecha de Revisión</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Entrega</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Estado</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Comentario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                                {docs.map((doc) => {
  console.log('RENDER DOC:', doc); // <-- Log para depuración justo antes de renderizar
                    return (
    <tr key={doc.id} className="hover:bg-gray-50">
      <td className="px-4 py-2 text-sm font-medium text-gray-900">{doc?.tipo_documento?.nombre || doc?.titulo || 'Sin nombre'}</td>
      <td className="px-4 py-2 text-sm">{doc?.curso_asignatura?.curso?.curso ? `${doc.curso_asignatura.curso.curso} ${doc.curso_asignatura.curso.paralelo || ''}` : '-'}</td>
      <td className="px-4 py-2 text-sm">{doc?.asignatura?.nombre || 'Sin asignatura'}</td>
      <td className="px-4 py-2 text-sm text-center">
        <div className="flex justify-center items-center h-full">
                            {doc?.nombre_archivo ? (
                              <button
                                title="Ver documento"
                                onClick={async () => {
                                  const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.nombre_archivo, 60 * 60)
                                  if (error || !data?.signedUrl) {
                                    toast.error('No se pudo generar el enlace de descarga')
                                    return
                                  }
                                  window.open(data.signedUrl, '_blank')
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l7.07-7.07a4 4 0 10-5.656-5.657l-8.485 8.485a6 6 0 108.485 8.485l6.586-6.586" />
                                </svg>
                              </button>
                            ) : (
                              <span className="text-gray-400">Sin archivo</span>
                            )}
                          </div>
                        </td>
      <td className="px-4 py-2 text-sm">{doc?.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
      <td className="px-4 py-2 text-sm">{doc?.fecha_revision ? new Date(doc.fecha_revision).toLocaleDateString() : '-'}</td>
      <td className="px-4 py-2 text-sm">
  {typeof doc?.entrega === 'string' && doc?.entrega === 'A tiempo' && (
    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">A tiempo</span>
  )}
  {typeof doc?.entrega === 'string' && doc?.entrega === 'Con atraso' && (
    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Con atraso</span>
  )}
  {typeof doc?.entrega === 'string' && doc?.entrega !== 'A tiempo' && doc?.entrega !== 'Con atraso' && doc?.entrega !== '' && (
    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{doc.entrega}</span>
  )}
  {(!doc?.entrega || typeof doc?.entrega !== 'string' || doc?.entrega === '') && (
    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Pendiente</span>
                          )}
                        </td>
      <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getEstadoColor(doc?.estado)}`}>{doc?.estado || 'Sin estado'}</span>
                        </td>
      <td className="px-4 py-2 text-sm">
  {(doc.observaciones || doc.observaciones_internas) ? (
                            <button
      className="text-yellow-600 hover:text-yellow-800 text-xs underline"
                              onClick={() => {
        setComentarioDocente(doc.observaciones_internas || null);
        setComentarioVicerrector(doc.observaciones || null);
        setShowComentariosModal(true);
      }}
      title="Ver comentarios"
    >
      Ver comentarios
                            </button>
                          ) : (
    <span className="text-gray-400 text-xs">Sin comentario</span>
                          )}
                        </td>
                      </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
        </section>

        {/* Documentos Aprobados */}
        <section className="mb-8">
          <div className="bg-gradient-to-r from-green-50 to-green-100 shadow-lg rounded-2xl p-8 border border-green-200">
            <h2 className="text-2xl font-extrabold mb-6 text-green-900 tracking-tight flex items-center gap-2">
              <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Documentos Aprobados
            </h2>
          {etapas.length === 0 ? (
            <p className="text-gray-500">No hay etapas configuradas.</p>
          ) : (
            etapas.map(etapa => {
              const tipos = documentosAprobadosPorEtapaTipo[etapa.id] || {};
              const tieneDocs = Object.values(tipos).some(arr => arr.length > 0);
              if (!tieneDocs) return null;
              return (
                <div key={etapa.id} className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-blue-800">{etapa.nombre}</h3>
                  {Object.entries(tipos).map(([tipoNombre, docs]) => (
                    <div key={tipoNombre} className="mb-4">
                      <h4 className="text-md font-semibold mb-1 text-gray-700">{tipoNombre}</h4>
                      <div className="overflow-x-auto rounded-xl bg-green-50 p-2">
                        <table className="min-w-full rounded-xl overflow-hidden">
                          <thead className="bg-green-200 text-white uppercase text-sm font-extrabold tracking-wider shadow-md border-b-4 border-green-400">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Documento</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Curso</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Asignatura</th>
                              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Archivo</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fecha de Entrega</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fecha de Revisión</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Entrega</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Estado</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Comentario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                                {docs.map((doc) => (
                                  <tr key={doc.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{doc?.tipo_documento?.nombre || doc?.titulo || 'Sin nombre'}</td>
                                    <td className="px-4 py-2 text-sm">{doc?.curso_asignatura?.curso?.curso ? `${doc.curso_asignatura.curso.curso} ${doc.curso_asignatura.curso.paralelo || ''}` : '-'}</td>
                                    <td className="px-4 py-2 text-sm">{doc?.asignatura?.nombre || 'Sin asignatura'}</td>
                                    <td className="px-4 py-2 text-sm text-center">
                                      <div className="flex justify-center items-center h-full">
                                        {doc?.nombre_archivo ? (
                                          <button
                                            title="Ver documento"
                                            onClick={async () => {
                                              const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.nombre_archivo, 60 * 60)
                                              if (error || !data?.signedUrl) {
                                                toast.error('No se pudo generar el enlace de descarga')
                                                return
                                              }
                                              window.open(data.signedUrl, '_blank')
                                            }}
                                            className="text-blue-600 hover:text-blue-800"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l7.07-7.07a4 4 0 10-5.656-5.657l-8.485 8.485a6 6 0 108.485 8.485l6.586-6.586" />
                                            </svg>
                                </button>
                              ) : (
                                          <span className="text-gray-400">Sin archivo</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-sm">{doc?.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
                                    <td className="px-4 py-2 text-sm">{doc?.fecha_revision ? new Date(doc.fecha_revision).toLocaleDateString() : '-'}</td>
                                    <td className="px-4 py-2 text-sm">
  {typeof doc?.entrega === 'string' && doc?.entrega === 'A tiempo' && (
    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">A tiempo</span>
  )}
  {typeof doc?.entrega === 'string' && doc?.entrega === 'Con atraso' && (
    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Con atraso</span>
  )}
  {typeof doc?.entrega === 'string' && doc?.entrega !== 'A tiempo' && doc?.entrega !== 'Con atraso' && doc?.entrega !== '' && (
    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{doc.entrega}</span>
  )}
  {(!doc?.entrega || typeof doc?.entrega !== 'string' || doc?.entrega === '') && (
    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Pendiente</span>
  )}
</td>
<td className="px-4 py-2 text-sm">
  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getEstadoColor(doc?.estado)}`}>{doc?.estado || 'Sin estado'}</span>
</td>
<td className="px-4 py-2 text-sm">
  {(doc.observaciones || doc.observaciones_internas) ? (
    <button
      className="text-yellow-600 hover:text-yellow-800 text-xs underline"
      onClick={() => {
        setComentarioDocente(doc.observaciones_internas || null);
        setComentarioVicerrector(doc.observaciones || null);
        setShowComentariosModal(true);
      }}
      title="Ver comentarios"
    >
      Ver comentarios
    </button>
  ) : (
    <span className="text-gray-400 text-xs">Sin comentario</span>
  )}
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
                      </div>
                    ))}
                  </div>
                );
              })
          )}
        </div>
          </section>
          </>
        )}
        {tabActivo === 'carga' && (
          <>
            {/* Carga Horaria */}
            <section className="mb-8">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 shadow-lg rounded-2xl p-8 border border-blue-200">
                <h2 className="text-2xl font-extrabold mb-6 text-blue-900 tracking-tight flex items-center gap-2">
                  <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Carga Horaria
                </h2>
              {cargaHoraria.length === 0 ? (
                <p className="text-gray-500">No tienes carga horaria asignada.</p>
              ) : (
                  <div className="overflow-x-auto rounded-xl bg-blue-50 p-2">
                    <table className="min-w-full rounded-xl overflow-hidden">
                      <thead className="bg-blue-200 text-white uppercase text-sm font-extrabold tracking-wider shadow-md border-b-4 border-blue-400">
                        <tr>
                          <th className="px-4 py-3 text-left text-blue-900">Curso</th>
                          <th className="px-4 py-3 text-left text-blue-900">Asignatura</th>
                          <th className="px-4 py-3 text-left text-blue-900">Horas/Sem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                        {[...cargaHoraria].sort((a, b) => {
                          const cursoA = a?.curso_asignatura?.curso?.curso ? `${a.curso_asignatura.curso.curso} ${a.curso_asignatura.curso.paralelo || ''}` : '';
                          const cursoB = b?.curso_asignatura?.curso?.curso ? `${b.curso_asignatura.curso.curso} ${b.curso_asignatura.curso.paralelo || ''}` : '';
                          return cursoA.localeCompare(cursoB, 'es', { sensitivity: 'base' });
                        }).map((carga) => (
                        <tr key={carga.id}>
                          <td className="px-4 py-2 text-sm">{carga?.curso_asignatura?.curso?.curso ? `${carga.curso_asignatura.curso.curso} ${carga.curso_asignatura.curso.paralelo || ''}` : 'Sin curso'}</td>
                          <td className="px-4 py-2 text-sm">{carga?.curso_asignatura?.asignatura?.nombre || 'Sin asignatura'}</td>
                          <td className="px-4 py-2 text-sm">{carga?.curso_asignatura?.horas_semanales ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
            </section>
          </>
        )}
        {tabActivo === 'soporte' && (
          <div className="space-y-8">
            {/* FAQ */}
            <section className="bg-white rounded-2xl shadow p-6 border border-blue-100">
              <h2 className="text-xl font-bold text-blue-800 mb-4">Preguntas Frecuentes (FAQ)</h2>
              <details className="mb-2">
                <summary className="font-semibold cursor-pointer">¿Cómo subo un documento?</summary>
                <p className="ml-4 mt-2 text-gray-700">Ve al tab Documentos y haz clic en "Subir documento". Selecciona el tipo de documento, la entrega y adjunta el archivo correspondiente. Recuerda revisar los tipos de archivo permitidos.</p>
              </details>
              <details className="mb-2">
                <summary className="font-semibold cursor-pointer">¿Qué significan los estados de los documentos?</summary>
                <ul className="ml-4 mt-2 text-gray-700 list-disc space-y-1">
                  <li><b>ENVIADO</b>: El documento fue subido y está pendiente de revisión.</li>
                  <li><b>EN REVISIÓN</b>: El documento está siendo evaluado por el vicerrector.</li>
                  <li><b>APROBADO</b>: El documento fue revisado y cumple con los requisitos.</li>
                  <li><b>OBSERVADO</b>: El documento tiene observaciones que debes corregir. Lee el comentario y vuelve a subir la versión corregida.</li>
                  <li><b>RECHAZADO</b>: El documento no fue aceptado. Consulta el motivo y vuelve a intentarlo si corresponde.</li>
                </ul>
              </details>
              <details className="mb-2">
                <summary className="font-semibold cursor-pointer">¿Cómo sé qué documentos debo entregar?</summary>
                <p className="ml-4 mt-2 text-gray-700">En el tab de Inicio y en Documentos verás la lista de entregas pendientes, con el nombre, tipo, fecha límite y estado de cada una.</p>
              </details>
              <details className="mb-2">
                <summary className="font-semibold cursor-pointer">¿Puedo subir varias versiones de un documento?</summary>
                <p className="ml-4 mt-2 text-gray-700">Sí, puedes subir una nueva versión si tu documento fue observado o rechazado. El sistema guardará el historial y solo la versión más reciente será evaluada.</p>
              </details>
              <details className="mb-2">
                <summary className="font-semibold cursor-pointer">¿Qué hago si tengo problemas con mi cuenta?</summary>
                <p className="ml-4 mt-2 text-gray-700">Contacta a soporte usando el formulario abajo. Incluye tu nombre, correo y una descripción clara del problema.</p>
              </details>
              <details className="mb-2">
                <summary className="font-semibold cursor-pointer">¿Dónde veo mis entregas pendientes?</summary>
                <p className="ml-4 mt-2 text-gray-700">En el tab de Inicio y en Documentos puedes ver tus entregas pendientes y su estado. También recibirás alertas de entregas próximas o vencidas.</p>
              </details>
              <details className="mb-2">
                <summary className="font-semibold cursor-pointer">¿Qué tipos de archivo puedo subir?</summary>
                <p className="ml-4 mt-2 text-gray-700">Cada tipo de documento tiene formatos permitidos (por ejemplo PDF, DOCX, XLSX). Al seleccionar el tipo de documento, verás los formatos aceptados debajo del selector.</p>
              </details>
              <details className="mb-2">
                <summary className="font-semibold cursor-pointer">¿Cómo recibo notificaciones de observaciones o aprobaciones?</summary>
                <p className="ml-4 mt-2 text-gray-700">Recibirás notificaciones dentro del sistema y, si tu correo está actualizado, también por email. Revisa el dashboard con frecuencia para no perderte novedades.</p>
              </details>
              <details className="mb-2">
                <summary className="font-semibold cursor-pointer">¿Qué hago si no puedo subir un archivo?</summary>
                <p className="ml-4 mt-2 text-gray-700">Verifica que el archivo no exceda el tamaño máximo permitido y que el formato sea el correcto. Si el problema persiste, contacta a soporte con una captura de pantalla del error.</p>
              </details>
              <details className="mb-2">
                <summary className="font-semibold cursor-pointer">Tips para docentes</summary>
                <ul className="ml-4 mt-2 text-gray-700 list-disc space-y-1">
                  <li>Sube tus documentos con anticipación para evitar contratiempos.</li>
                  <li>Lee cuidadosamente las observaciones y corrige antes de volver a subir.</li>
                  <li>Organiza tus archivos y usa nombres claros para facilitar la revisión.</li>
                  <li>Consulta la guía interactiva si tienes dudas sobre el uso de la plataforma.</li>
                </ul>
              </details>
            </section>

            {/* Encuesta de satisfacción */}
            <section className="bg-white rounded-2xl shadow p-6 border border-yellow-100">
              <h2 className="text-xl font-bold text-yellow-700 mb-4">Encuesta de Satisfacción</h2>
              <form>
                <label className="block mb-2">¿Cómo calificarías tu experiencia?</label>
                <div className="flex gap-2 mb-4">
                  {[1,2,3,4,5].map(n => (
                    <button type="button" key={n} className="text-2xl">⭐</button>
                  ))}
                </div>
                <textarea className="w-full border rounded p-2 mb-2" placeholder="Comentarios adicionales..." />
                <button className="bg-yellow-600 text-white px-4 py-2 rounded">Enviar</button>
              </form>
            </section>

            {/* Contacto/Ayuda */}
            <section className="bg-white rounded-2xl shadow p-6 border border-green-100">
              <h2 className="text-xl font-bold text-green-700 mb-4">¿Necesitas ayuda?</h2>
              <form>
                <input className="w-full border rounded p-2 mb-2" placeholder="Tu correo" />
                <textarea className="w-full border rounded p-2 mb-2" placeholder="Describe tu problema o consulta..." />
                <button className="bg-green-600 text-white px-4 py-2 rounded">Enviar mensaje</button>
              </form>
              <p className="mt-2 text-sm text-gray-500">O escríbenos a <a href="mailto:soporte@tudominio.com" className="underline text-green-700">soporte@tudominio.com</a></p>
            </section>

            {/* Guía interactiva */}
            <section className="bg-white rounded-2xl shadow p-6 border border-indigo-100">
              <h2 className="text-xl font-bold text-indigo-700 mb-4">Guía Interactiva</h2>
              <button className="bg-indigo-600 text-white px-4 py-2 rounded">Iniciar tour guiado</button>
              <p className="mt-2 text-sm text-gray-500">¿Prefieres leer? <a href="/guia.pdf" className="underline text-indigo-700">Descarga la guía en PDF</a></p>
            </section>
          </div>
        )}
      </main>
        {/* Modal de subida de documento */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
                onClick={() => setShowUploadModal(false)}
              >
                ×
              </button>
              <h2 className="text-xl font-bold mb-4 text-gray-900">Subir Documento</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
                {/* Solo mostrar selects si no están definidos */}
                {!formData.tipo_documento_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Documento *
              </label>
              <select
                value={formData.tipo_documento_id}
                onChange={(e) => handleTipoDocumentoChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Seleccione un tipo...</option>
                {tiposDocumento.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
              {formData.tipo_documento_id && (
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Tipos de archivo permitidos:</strong> {getTiposArchivoPermitidos(parseInt(formData.tipo_documento_id))}
                </div>
              )}
            </div>
                )}
                {!formData.entrega_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                      Entrega Programada *
              </label>
              <select
                value={formData.entrega_id}
                onChange={(e) => setFormData({ ...formData, entrega_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Seleccione una entrega...</option>
                      {entregas.map((entrega) => (
                    <option key={entrega.id} value={entrega.id}>
                      {entrega.titulo} - Vence: {new Date(entrega.fecha_limite).toLocaleDateString()}
                    </option>
                  ))}
              </select>
            </div>
                )}
                {tiposDocumento.find(t => t.id === parseInt(formData.tipo_documento_id))?.requiere_asignatura && !formData.asignatura_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asignatura *
                </label>
                <select
                  value={formData.asignatura_id}
                  onChange={(e) => setFormData({ ...formData, asignatura_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Seleccione una asignatura...</option>
                  {asignaturas.map((asignatura) => (
                    <option key={asignatura.id} value={asignatura.id}>
                      {asignatura.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Archivo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo *
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {file ? (
                    <div className="text-sm text-gray-900">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      {formData.tipo_documento_id && (
                        <div className="mt-2 text-sm text-green-600">
                          ✓ Tipo de archivo válido para este documento
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="mt-2 text-red-600 hover:text-red-500"
                      >
                        Eliminar archivo
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                        >
                              <span>Subir archivo</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            className="sr-only"
                            onChange={handleFileChange}
                                ref={fileInputRef}
                          />
                        </label>
                        <p className="pl-1">o arrastrar y soltar</p>
                      </div>
                      <p className="text-xs text-gray-500">PDF, DOC, DOCX hasta 10MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
              Comentario para el revisor (opcional)
              </label>
              <textarea
              value={formData.observaciones_internas}
              onChange={(e) => setFormData({ ...formData, observaciones_internas: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              placeholder="Agregar un comentario para el vicerrector..."
              />
            </div>
            {/* Botones */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploading || !file}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Subiendo...' : 'Subir Documento'}
              </button>
            </div>
          </form>
        </div>
          </div>
        )}
      {/* Modal para mostrar observaciones del vicerrector */}
      {showObservacionesModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Comentario del vicerrector</h3>
                <button
                  onClick={() => {
                    setShowObservacionesModal(false);
                    setObservacionesSeleccionadas(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {observacionesSeleccionadas}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowObservacionesModal(false);
                    setObservacionesSeleccionadas(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal para mostrar ambos comentarios */}
      {showComentariosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowComentariosModal(false)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <h2 className="text-lg font-semibold mb-4 text-indigo-700 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Comentarios del documento
            </h2>
            {comentarioDocente && (
              <div className="mb-4">
                <span className="block text-xs font-semibold text-blue-700 mb-1">🧑‍🏫 Comentario del docente:</span>
                <p className="text-gray-800 whitespace-pre-line text-sm bg-blue-50 rounded p-2">{comentarioDocente}</p>
              </div>
            )}
            {comentarioVicerrector && (
              <div className="mb-2">
                <span className="block text-xs font-semibold text-yellow-700 mb-1">🧑‍💼 Comentario del vicerrector:</span>
                <p className="text-gray-800 whitespace-pre-line text-sm bg-yellow-50 rounded p-2">{comentarioVicerrector}</p>
              </div>
            )}
            {(!comentarioDocente && !comentarioVicerrector) && (
              <p className="text-gray-500 text-sm">No hay comentarios registrados.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
