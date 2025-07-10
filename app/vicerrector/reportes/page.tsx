"use client"
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface ReporteDocente {
  docente: string;
  entregados: number;
  pendientes: number;
  observados: number;
  aprobados: number;
}

export default function ReportesPage() {
  const [filtro, setFiltro] = useState('');
  const [reportes, setReportes] = useState<ReporteDocente[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    cargarReportes();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }
    const { data: userData } = await supabase.rpc('obtener_perfil_usuario', { p_user_id: user.id });
    const rol = (userData && userData[0]?.rol) ? userData[0].rol.toLowerCase().trim() : '';
    if (rol !== 'vicerrector') {
      router.push('/docente');
    }
  };

  const cargarReportes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documentos')
        .select(`
          docente:perfiles_docentes (
            apellidos,
            nombres
          ),
          estado
        `);
      if (error) throw error;
      // Agrupar por docente
      const agrupado: { [nombre: string]: ReporteDocente } = {};
      (data || []).forEach((doc: any) => {
        const nombre = doc.docente ? `${doc.docente.apellidos ?? ''} ${doc.docente.nombres ?? ''}`.trim() : 'Sin nombre';
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
      setReportes([]);
    } finally {
      setLoading(false);
    }
  };

  const reportesFiltrados = reportes.filter(r => r.docente.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="bg-purple-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold">Generar reportes</h1>
              <button
                onClick={() => router.push('/vicerrector')}
                className="text-purple-200 hover:text-white text-sm mt-1"
              >
                ← Volver al dashboard
              </button>
            </div>
          </div>
        </div>
      </header>
      <h1 className="text-3xl font-bold mb-8">Reportes de Entregas por Docente</h1>
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar docente..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Docente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entregados</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pendientes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Observados</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aprobados</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8">Cargando...</td></tr>
            ) : reportesFiltrados.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8">No hay datos</td></tr>
            ) : (
              reportesFiltrados.map((r, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{r.docente}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.entregados}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.pendientes}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.observados}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.aprobados}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

