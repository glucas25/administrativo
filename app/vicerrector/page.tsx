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

  useEffect(() => {
    checkUser();
    loadStats();
    loadGraficos();
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
    // Últimas entregas
    const { data: entregasData } = await supabase.from('entregas_programadas').select('*').order('fecha_entrega', { ascending: false }).limit(5);
    setUltimasEntregas(entregasData || []);
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
      {/* Header */}
      <header className="bg-purple-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold">
              Panel de Vicerrectorado
            </h1>
            <button
              onClick={handleLogout}
              className="text-sm text-purple-200 hover:text-white"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Bienvenido, {user?.nombre_completo || 'Vicerrectorado'}
          </h2>
          <p className="text-gray-600 mt-1">
            Panel de administración del sistema
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm font-medium text-gray-600">Docentes</p>
            <p className="text-2xl font-semibold text-gray-900">{stats.totalDocentes}</p>
          </div>

          <div className="bg-orange-50 rounded-lg shadow p-4">
            <p className="text-sm font-medium text-orange-800">Por Revisar</p>
            <p className="text-2xl font-semibold text-orange-900">{stats.documentosPorRevisar}</p>
          </div>

          <div className="bg-green-50 rounded-lg shadow p-4">
            <p className="text-sm font-medium text-green-800">Aprobados</p>
            <p className="text-2xl font-semibold text-green-900">{stats.documentosAprobados}</p>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-4">
            <p className="text-sm font-medium text-blue-800">Tipos Doc.</p>
            <p className="text-2xl font-semibold text-blue-900">{stats.tiposDocumento}</p>
          </div>

          <div className="bg-purple-50 rounded-lg shadow p-4">
            <p className="text-sm font-medium text-purple-800">Asignaturas</p>
            <p className="text-2xl font-semibold text-purple-900">{stats.asignaturas}</p>
          </div>

          <div className="bg-indigo-50 rounded-lg shadow p-4">
            <p className="text-sm font-medium text-indigo-800">Cursos</p>
            <p className="text-2xl font-semibold text-indigo-900">{stats.cursos}</p>
          </div>
        </div>

        {/* Gráficos y Novedades */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Distribución de documentos por estado</h3>
            <Pie data={pieData} />
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Carga horaria total por docente</h3>
            <Bar data={barData} options={{ plugins: { legend: { display: false } } }} />
          </div>
        </div>

        {/* Sección de novedades */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Últimos docentes agregados</h3>
            <ul className="divide-y">
              {ultimosDocentes.map(d => (
                <li key={d.id} className="py-2">
                  <span className="font-medium">{d.nombre_completo || d.correo}</span>
                  <span className="ml-2 text-gray-500 text-xs">{d.correo}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Últimas entregas programadas</h3>
            <ul className="divide-y">
              {ultimasEntregas.map(e => (
                <li key={e.id} className="py-2">
                  <span className="font-medium">{e.nombre || 'Entrega'}</span>
                  <span className="ml-2 text-gray-500 text-xs">{e.fecha_entrega}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
