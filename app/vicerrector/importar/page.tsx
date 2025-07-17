'use client'
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface ManualUser {
  correo: string
  password: string
  apellidos: string
  nombres: string
  area: string
  titulo: string
  cedula?: string
}

export default function ImportarUsuariosPage() {
  const [csvData, setCsvData] = useState<string>('');
  const [manualUsers, setManualUsers] = useState<ManualUser[]>([
    { correo: '', password: '', apellidos: '', nombres: '', area: '', titulo: '', cedula: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: userData } = await supabase
      .rpc('obtener_perfil_usuario', { p_user_id: user.id })

    const rol = (userData && userData[0]?.rol) ? userData[0].rol.toLowerCase().trim() : '';
    if (rol !== 'vicerrector') {
      router.push('/docente')
    }
  }

  // Handler para archivo CSV
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setCsvData(evt.target?.result as string);
    };
    reader.readAsText(file);
  };

  // Handler para agregar usuario manual
  const addManualUser = () => {
    setManualUsers([
      ...manualUsers,
      { correo: '', password: '', apellidos: '', nombres: '', area: '', titulo: '', cedula: '' }
    ]);
  };

  // Handler para cambiar datos manuales
  const handleManualChange = (idx: number, field: keyof ManualUser, value: string) => {
    const updated = manualUsers.map((u, i) =>
      i === idx ? { ...u, [field]: value } : u
    );
    setManualUsers(updated);
  };

  // Handler para enviar usuarios manuales
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Llamar a la función crear_usuario_completo para cada usuario
      for (const user of manualUsers) {
        await supabase.rpc('crear_usuario_completo', {
          p_email: user.correo,
          p_password: user.password,
          p_cedula: user.cedula || null,
          p_apellidos: user.apellidos,
          p_nombres: user.nombres,
          p_area: user.area || null,
          p_titulo: user.titulo || null,
          p_rol: 'docente'
        })
      }
      toast.success('Usuarios enviados para creación')
    } catch (err) {
      toast.error('Error al importar usuarios')
    } finally {
      setLoading(false);
    }
  };

  // Handler para importar desde CSV (simulado)
  const handleCsvImport = async () => {
    setLoading(true);
    try {
      // Aquí deberías parsear el CSV y llamar a tu API para crear usuarios en lote
      toast.success('Usuarios importados desde CSV (simulado)');
    } catch (err) {
      toast.error('Error al importar desde CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <header className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Importar masivamente
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
      <h1 className="text-2xl font-bold mb-6">Importar Usuarios</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Importar desde archivo */}
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Importar desde archivo CSV/Excel</h2>
          <input type="file" accept=".csv,.xlsx" onChange={handleCsvUpload} className="mb-4" />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={handleCsvImport}
            disabled={loading || !csvData}
          >
            Importar archivo
          </button>
        </div>
        {/* Ingreso manual */}
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Ingreso manual de usuarios</h2>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            {manualUsers.map((user, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2 mb-2">
                <input type="email" placeholder="Correo" value={user.correo} onChange={e => handleManualChange(idx, 'correo', e.target.value)} className="border p-2 rounded" required />
                <input type="password" placeholder="Contraseña" value={user.password} onChange={e => handleManualChange(idx, 'password', e.target.value)} className="border p-2 rounded" required />
                <input type="text" placeholder="Apellidos" value={user.apellidos} onChange={e => handleManualChange(idx, 'apellidos', e.target.value)} className="border p-2 rounded" required />
                <input type="text" placeholder="Nombres" value={user.nombres} onChange={e => handleManualChange(idx, 'nombres', e.target.value)} className="border p-2 rounded" required />
                <input type="text" placeholder="Área" value={user.area} onChange={e => handleManualChange(idx, 'area', e.target.value)} className="border p-2 rounded" />
                <input type="text" placeholder="Título" value={user.titulo} onChange={e => handleManualChange(idx, 'titulo', e.target.value)} className="border p-2 rounded" />
              </div>
            ))}
            <button type="button" onClick={addManualUser} className="bg-gray-200 px-3 py-1 rounded">+ Agregar otro</button>
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50" disabled={loading}>
              Importar manualmente
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

