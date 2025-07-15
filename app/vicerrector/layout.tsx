'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function VicerrectorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'Gestión Académica': false,
    'Gestión de Documentos': false,
    'Gestión de Usuarios': false,
  });
  const [error, setError] = useState<string | null>(null);

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
      if (data.rol !== 'vicerrector') {
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
    // Expande el grupo correspondiente a la ruta activa al cargar
    groupedMenu.forEach(group => {
      if (group.items.some(item => pathname.startsWith(item.href))) {
        setExpanded(exp => ({ ...exp, [group.section]: true }));
      }
    });
    // eslint-disable-next-line
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    toast.success('Sesión cerrada')
  }

  const groupedMenu = [
    {
      section: 'Dashboard',
      items: [
    { href: '/vicerrector', label: 'Dashboard', icon: '🏠' },
      ],
    },
    {
      section: 'Gestión Académica',
      icon: '📚',
      items: [
        { href: '/vicerrector/asignaturas', label: 'Asignaturas', icon: '📖' },
        { href: '/vicerrector/cursos', label: 'Cursos', icon: '🏫' },
        { href: '/vicerrector/periodos', label: 'Períodos Académicos', icon: '📆' },
        { href: '/vicerrector/curso-asignatura', label: 'Malla Curricular', icon: '🗂️' },
        { href: '/vicerrector/carga-horaria', label: 'Carga Horaria', icon: '⏰' },
      ],
    },
    {
      section: 'Gestión de Documentos',
      icon: '📄',
      items: [
    { href: '/vicerrector/tipos-documento', label: 'Tipos de Documento', icon: '📋' },
        { href: '/vicerrector/entregas', label: 'Programar Entregas', icon: '📅' },
        { href: '/vicerrector/documentos', label: 'Revisar Documentos', icon: '📝' },
      ],
    },
    {
      section: 'Gestión de Usuarios',
      icon: '👥',
      items: [
        { href: '/vicerrector/docentes', label: 'Docentes', icon: '👨‍🏫' },
        { href: '/vicerrector/importar', label: 'Importar Masivamente', icon: '⬆️' },
        { href: '/vicerrector/reportes', label: 'Reportes', icon: '📊' },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }
  if (error) return <div className="text-red-600 text-center mt-8">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-purple-700 text-white shadow-lg fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white p-2 rounded-md hover:bg-purple-600 lg:hidden"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-bold ml-2">Panel de Vicerrectorado</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm">{user?.nombre_completo}</span>
            <button
              onClick={handleLogout}
              className="text-purple-200 hover:text-white transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <div className="flex pt-14">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-64 bg-white shadow-md fixed left-0 top-14 bottom-0 overflow-y-auto">
          <nav className="p-4">
            {groupedMenu.map(group => (
              <div key={group.section} className="mb-6">
                <button
                  type="button"
                  className="flex items-center mb-2 text-xs text-gray-500 uppercase tracking-wider w-full focus:outline-none"
                  onClick={() => setExpanded(exp => ({ ...exp, [group.section]: !exp[group.section] }))}
                >
                  {group.icon && <span className="mr-2 text-base">{group.icon}</span>}
                  {group.section}
                  <span className="ml-auto text-xs">{expanded[group.section] ? '▼' : '►'}</span>
                </button>
                {expanded[group.section] && (
                  <ul className="space-y-1">
                    {group.items.map(item => {
                const isActive = pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                            className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        isActive
                                ? 'bg-purple-100 text-purple-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                            <span className="text-lg">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Sidebar - Mobile */}
        <div
          className={`lg:hidden fixed inset-0 z-50 transition-opacity ${
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="absolute inset-0 bg-black opacity-50" onClick={() => setSidebarOpen(false)}></div>
          <aside className={`absolute left-0 top-0 bottom-0 w-64 bg-white shadow-lg transform transition-transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="p-4 bg-purple-700 text-white">
              <h2 className="text-lg font-bold">Menú</h2>
            </div>
            <nav className="p-4">
              {groupedMenu.map(group => (
                <div key={group.section} className="mb-6">
                  <button
                    type="button"
                    className="flex items-center mb-2 text-xs text-gray-500 uppercase tracking-wider w-full focus:outline-none"
                    onClick={() => setExpanded(exp => ({ ...exp, [group.section]: !exp[group.section] }))}
                  >
                    {group.icon && <span className="mr-2 text-base">{group.icon}</span>}
                    {group.section}
                    <span className="ml-auto text-xs">{expanded[group.section] ? '▼' : '►'}</span>
                  </button>
                  {expanded[group.section] && (
                    <ul className="space-y-1">
                      {group.items.map(item => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                              className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition text-sm font-medium ${
                          isActive
                                  ? 'bg-purple-100 text-purple-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                              <span className="text-lg">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
                  )}
                </div>
              ))}
            </nav>
          </aside>
        </div>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
