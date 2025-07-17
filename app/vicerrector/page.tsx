// app/vicerrector/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Usuario } from '@/types/database'
import toast from 'react-hot-toast'
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function VicerrectorDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalDocentes: 0,
    documentosPorRevisar: 0,
    documentosAprobados: 0,
    tiposDocumento: 0,
    asignaturas: 0,
    cursos: 0
  })
  const [docentes, setDocentes] = useState<any[]>([]);
  const [cargasPorDocente, setCargasPorDocente] = useState<any[]>([]);
  const [documentosEstado, setDocumentosEstado] = useState({ ENVIADO: 0, APROBADO: 0, OBSERVADO: 0 });
  const [ultimosDocentes, setUltimosDocentes] = useState<any[]>([]);
  const [ultimasEntregas, setUltimasEntregas] = useState<any[]>([]);
  // Calcular ranking de docentes más cumplidos (por documentos aprobados)
  const [rankingDocentes, setRankingDocentes] = useState<any[]>([]);
  // Estado para métricas por tipo de documento
  const [tiposDocumentoMetrica, setTiposDocumentoMetrica] = useState<any[]>([]);

  useEffect(() => {
    checkUser();
    loadStats();
    loadGraficos();
    // Ranking de docentes más cumplidos
    const fetchRankingDocentes = async () => {
      // Traer todos los documentos aprobados con relación a usuarios_completos
      const { data, error } = await supabase
        .from('documentos')
        .select('docente_id, usuarios_completos:docente_id(nombre_completo, correo)')
        .eq('estado', 'APROBADO');
      if (!error && data) {
        const ranking: Record<string, { nombre: string, cantidad: number }> = {};
        data.forEach((d: any) => {
          const nombre = d.usuarios_completos?.nombre_completo || d.docente_id;
          if (!ranking[nombre]) ranking[nombre] = { nombre, cantidad: 0 };
          ranking[nombre].cantidad++;
        });
        const top = Object.values(ranking).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
        setRankingDocentes(top);
      }
    };
    fetchRankingDocentes();
    // Métricas por tipo de documento
    const fetchTiposDocumentoMetrica = async () => {
      const { data: tipos, error: errorTipos } = await supabase
        .from('tipos_documento')
        .select('id, nombre')
        .eq('activo', true);
      if (!tipos || errorTipos) return setTiposDocumentoMetrica([]);
      const { data: docs, error: errorDocs } = await supabase
        .from('documentos')
        .select('id, tipo_documento_id, estado');
      if (!docs || errorDocs) return setTiposDocumentoMetrica([]);
      const metricas = tipos.map((tipo: any) => {
        const docsTipo = docs.filter((d: any) => d.tipo_documento_id === tipo.id);
        const entregados = docsTipo.length;
        const aprobados = docsTipo.filter((d: any) => d.estado === 'APROBADO').length;
        return {
          nombre: tipo.nombre,
          entregados,
          aprobados
        };
      });
      setTiposDocumentoMetrica(metricas);
    };
    fetchTiposDocumentoMetrica();
    // Últimas entregas programadas con tipo de documento
    const fetchUltimasEntregas = async () => {
      const { data: entregasData, error } = await supabase
        .from('entregas_programadas')
        .select('id, titulo, fecha_limite, tipo_documento:tipo_documento_id(nombre)')
        .order('fecha_limite', { ascending: false })
        .limit(5);
      if (!error && entregasData) {
        setUltimasEntregas(entregasData);
      }
    };
    fetchUltimasEntregas();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push('/auth/login')
        return
      }

      // Usar la función correcta para obtener el perfil
      const { data: userData } = await supabase
        .rpc('obtener_perfil_usuario', { p_user_id: authUser.id })

      const rol = (userData && userData[0]?.rol) ? userData[0].rol.toLowerCase().trim() : '';
      console.log('Rol detectado en dashboard vicerrector:', rol);
      if (rol !== 'vicerrector') {
        toast.error('No tienes permisos para acceder a esta sección')
        router.push('/docente')
        return
      }

      if (userData && userData[0]) {
        setUser({
          ...userData[0],
          nombre_completo: userData[0].nombre_completo || `${userData[0].apellidos ?? ''} ${userData[0].nombres ?? ''}`.trim()
        })
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      // Contar docentes
      const { data: docentesData } = await supabase
        .rpc('listar_usuarios_activos', { p_rol: 'docente' })
      const docentesCount = docentesData ? docentesData.length : 0

      // Contar documentos por revisar
      const { count: porRevisarCount } = await supabase
        .from('documentos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'ENVIADO')

      // Contar documentos aprobados
      const { count: aprobadosCount } = await supabase
        .from('documentos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'APROBADO')

      // Contar tipos de documento
      const { count: tiposCount } = await supabase
        .from('tipos_documento')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)

      // Contar asignaturas
      const { count: asignaturasCount } = await supabase
        .from('asignaturas')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)

      // Contar cursos
      const { count: cursosCount } = await supabase
        .from('cursos')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)

      setStats({
        totalDocentes: docentesCount || 0,
        documentosPorRevisar: porRevisarCount || 0,
        documentosAprobados: aprobadosCount || 0,
        tiposDocumento: tiposCount || 0,
        asignaturas: asignaturasCount || 0,
        cursos: cursosCount || 0
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadGraficos = async () => {
    // Docentes y cargas
    const { data: docentesData } = await supabase.from('usuarios_completos').select('*').eq('rol', 'docente').eq('activo', true);
    setDocentes(docentesData || []);
    // Cargas por docente
    const { data: cargasData } = await supabase.from('carga_horaria').select('docente_id, horas_semanales').eq('activo', true);
    const cargasPorDoc = {} as Record<string, number>;
    (cargasData || []).forEach((c: any) => {
      cargasPorDoc[c.docente_id] = (cargasPorDoc[c.docente_id] || 0) + c.horas_semanales;
    });
    setCargasPorDocente(Object.entries(cargasPorDoc).map(([id, horas]) => ({ id, horas })));
    // Documentos por estado
    const { data: docsData } = await supabase.from('documentos').select('estado');
    const estadoCount = { ENVIADO: 0, APROBADO: 0, OBSERVADO: 0 };
    (docsData || []).forEach((d: any) => {
      if (d.estado === 'ENVIADO' || d.estado === 'APROBADO' || d.estado === 'OBSERVADO') {
        const estado = d.estado as 'ENVIADO' | 'APROBADO' | 'OBSERVADO';
        estadoCount[estado] = (estadoCount[estado] || 0) + 1;
      }
    });
    setDocumentosEstado(estadoCount);
    // Últimos docentes
    setUltimosDocentes((docentesData || []).slice(-5).reverse());
  };

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  // Gráfico de pastel de documentos por estado
  const pieData = {
    labels: ['Enviados', 'Aprobados', 'Observados'],
    datasets: [
      {
        data: [documentosEstado.ENVIADO, documentosEstado.APROBADO, documentosEstado.OBSERVADO],
        backgroundColor: ['#fbbf24', '#34d399', '#f87171'],
        borderWidth: 1,
      },
    ],
  };
  // Gráfico de barras de cargas horarias por docente
  const barData = {
    labels: docentes.map(d => d.nombre_completo || d.correo),
    datasets: [
      {
        label: 'Horas asignadas',
        data: docentes.map(d => (cargasPorDocente.find(c => c.id === d.id)?.horas || 0)),
        backgroundColor: '#6366f1',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl md:text-3xl font-bold text-blue-900 mb-6">Panel del Vicerrector</h2>
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Bienvenido, {user?.nombre_completo || 'Vicerrectorado'}
          </h2>
          <p className="text-gray-600 mt-1">
            Panel de administración del sistema
          </p>
        </div>

        {/* Stats Grid Mejorado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-10">
          {/* Docentes */}
          <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-lg p-6 border border-blue-100">
            <span className="text-4xl mb-2">👨‍🏫</span>
            <span className="text-3xl font-extrabold text-blue-800 mb-1">{stats.totalDocentes}</span>
            <span className="text-base font-semibold text-blue-700">Docentes</span>
          </div>
          {/* Por Revisar */}
          <div className="flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-yellow-100 rounded-2xl shadow-lg p-6 border border-orange-100">
            <span className="text-4xl mb-2">📥</span>
            <span className="text-3xl font-extrabold text-orange-700 mb-1">{stats.documentosPorRevisar}</span>
            <span className="text-base font-semibold text-orange-700">Por Revisar</span>
          </div>
          {/* Aprobados */}
          <div className="flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-lg p-6 border border-green-100">
            <span className="text-4xl mb-2">✅</span>
            <span className="text-3xl font-extrabold text-green-700 mb-1">{stats.documentosAprobados}</span>
            <span className="text-base font-semibold text-green-700">Aprobados</span>
          </div>
          {/* Tipos Documento */}
          <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-100 rounded-2xl shadow-lg p-6 border border-cyan-100">
            <span className="text-4xl mb-2">📄</span>
            <span className="text-3xl font-extrabold text-cyan-700 mb-1">{stats.tiposDocumento}</span>
            <span className="text-base font-semibold text-cyan-700">Tipos Doc.</span>
          </div>
          {/* Asignaturas */}
          <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-lg p-6 border border-blue-100">
            <span className="text-4xl mb-2">📚</span>
            <span className="text-3xl font-extrabold text-blue-700 mb-1">{stats.asignaturas}</span>
            <span className="text-base font-semibold text-blue-700">Asignaturas</span>
          </div>
          {/* Cursos */}
          <div className="flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl shadow-lg p-6 border border-indigo-100">
            <span className="text-4xl mb-2">🏫</span>
            <span className="text-3xl font-extrabold text-indigo-700 mb-1">{stats.cursos}</span>
            <span className="text-base font-semibold text-indigo-700">Cursos</span>
          </div>
        </div>

        {/* Tablas de métricas y detalles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          {/* Documentos por estado */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-100">
            <h3 className="text-lg font-bold text-blue-800 mb-4">Documentos por Estado</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-blue-50">
                  <th className="px-4 py-2 text-left rounded-tl-xl">Estado</th>
                  <th className="px-4 py-2 text-center">Cantidad</th>
                  <th className="px-4 py-2 text-center rounded-tr-xl">Porcentaje</th>
                </tr>
              </thead>
              <tbody>
                {['APROBADO', 'ENVIADO', 'OBSERVADO'].map(estado => {
                  const total = documentosEstado.APROBADO + documentosEstado.ENVIADO + documentosEstado.OBSERVADO;
                  const cantidad = documentosEstado[estado as keyof typeof documentosEstado] || 0;
                  const porcentaje = total ? ((cantidad / total) * 100).toFixed(1) : '0.0';
                  const color = estado === 'APROBADO' ? 'bg-green-100 text-green-700' : estado === 'ENVIADO' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
                  return (
                    <tr key={estado} className="border-b last:border-b-0">
                      <td className="px-4 py-2 font-semibold">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${color}`}>{estado}</span>
                      </td>
                      <td className="px-4 py-2 text-center">{cantidad}</td>
                      <td className="px-4 py-2 text-center">{porcentaje}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-blue-50 font-bold">
                  <td className="px-4 py-2 rounded-bl-xl">Total</td>
                  <td className="px-4 py-2 text-center">{documentosEstado.APROBADO + documentosEstado.ENVIADO + documentosEstado.OBSERVADO}</td>
                  <td className="px-4 py-2 text-center rounded-br-xl">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Tipos de documentos */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-100">
            <h3 className="text-lg font-bold text-blue-800 mb-4">Tipos de Documentos</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-blue-50">
                  <th className="px-4 py-2 text-left rounded-tl-xl">Tipo</th>
                  <th className="px-4 py-2 text-center">Entregados</th>
                  <th className="px-4 py-2 text-center rounded-tr-xl">Aprobados</th>
                </tr>
              </thead>
              <tbody>
                {tiposDocumentoMetrica.length === 0 && <tr><td colSpan={3} className="text-center text-gray-400 py-4">Sin datos</td></tr>}
                {tiposDocumentoMetrica.map(tipo => (
                  <tr key={tipo.nombre} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-semibold">{tipo.nombre}</td>
                    <td className="px-4 py-2 text-center">{tipo.entregados}</td>
                    <td className="px-4 py-2 text-center">{tipo.aprobados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          {/* Ranking de docentes más cumplidos */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
            <h3 className="text-lg font-bold text-green-800 mb-4">Docentes más cumplidos</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-green-50">
                  <th className="px-4 py-2 text-left rounded-tl-xl">Docente</th>
                  <th className="px-4 py-2 text-center rounded-tr-xl">Aprobados</th>
                </tr>
              </thead>
              <tbody>
                {rankingDocentes.length === 0 && <tr><td colSpan={2} className="text-center text-gray-400 py-4">Sin datos</td></tr>}
                {rankingDocentes.map((doc, idx) => (
                  <tr key={doc.nombre} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-semibold flex items-center"><span className="mr-2 text-lg">{idx + 1}.</span> {doc.nombre}</td>
                    <td className="px-4 py-2 text-center"><span className="bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-bold">{doc.cantidad}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Últimas entregas programadas */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
            <h3 className="text-lg font-bold text-indigo-800 mb-4">Últimas entregas programadas</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-indigo-50">
                  <th className="px-4 py-2 text-left rounded-tl-xl">Título</th>
                  <th className="px-4 py-2 text-center">Fecha Límite</th>
                  <th className="px-4 py-2 text-center rounded-tr-xl">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {ultimasEntregas.length === 0 && <tr><td colSpan={3} className="text-center text-gray-400 py-4">Sin datos</td></tr>}
                {ultimasEntregas.map(e => (
                  <tr key={e.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-semibold">{e.titulo || 'Entrega'}</td>
                    <td className="px-4 py-2 text-center">{e.fecha_limite ? new Date(e.fecha_limite).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 text-center"><span className="bg-indigo-100 text-indigo-700 rounded-full px-3 py-1 text-xs font-bold">{e.tipo_documento?.nombre || '-'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
