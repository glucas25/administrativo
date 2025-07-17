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
      // Intentar primero con la vista
      let data: any[] = [];
      let error: any = null;
      
      try {
        const result = await supabase
          .from('vista_documentos_completa')
          .select('estado, docente_nombres, docente_apellidos');
        
        data = result.data || [];
        error = result.error;
      } catch (viewError) {
        // Si falla la vista, hacer consulta directa
        const documentosResult = await supabase
          .from('documentos')
          .select('estado, docente_id');
        
        if (documentosResult.error) {
          throw documentosResult.error;
        }
        
        const usuariosResult = await supabase
          .from('usuarios_completos')
          .select('id, nombre_completo, apellidos, nombres');
        
        if (usuariosResult.error) {
          throw usuariosResult.error;
        }
        
        // Crear mapa de usuarios
        const usuariosMap = new Map();
        (usuariosResult.data || []).forEach((usuario: any) => {
          usuariosMap.set(usuario.id, usuario);
        });
        
        // Transformar datos
        data = (documentosResult.data || []).map((doc: any) => {
          const usuario = usuariosMap.get(doc.docente_id);
          return {
            estado: doc.estado,
            docente_apellidos: usuario?.apellidos || null,
            docente_nombres: usuario?.nombres || null
          };
        });
      }
      
      if (error) {
        console.error('Error en la consulta:', error);
        throw error;
      }
      
      // Agrupar por docente
      const agrupado: { [nombre: string]: ReporteDocente } = {};
      (data || []).forEach((doc: any) => {
        let nombre = 'Sin nombre';
        
        if (doc.docente_apellidos || doc.docente_nombres) {
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

  const reportesFiltrados = reportes.filter(r => r.docente.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Generar reportes
                </span>
              </h1>
              <div className="flex items-center space-x-2">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></div>
                <button
                  onClick={() => router.push('/vicerrector')}
                  className="text-blue-600 hover:text-blue-800 text-sm transition-colors font-medium flex items-center"
                >
                  <span className="mr-1">←</span>
                  Volver al dashboard
                </button>
              </div>
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

