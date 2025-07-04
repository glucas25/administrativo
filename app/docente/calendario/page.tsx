// app/docente/calendario/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface EntregaCalendario {
  id: number
  titulo: string
  fecha_limite: string
  tipo_documento: {
    nombre: string
    codigo: string
  }
  estado?: 'pendiente' | 'entregado' | 'observado' | 'aprobado'
}

export default function CalendarioPage() {
  const router = useRouter()
  const [entregas, setEntregas] = useState<EntregaCalendario[]>([])
  const [loading, setLoading] = useState(true)
  const [mesActual, setMesActual] = useState(new Date())
  const [vistaActual, setVistaActual] = useState<'mes' | 'lista'>('mes')

  useEffect(() => {
    checkAuth()
    loadEntregas()
  }, [mesActual])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
    }
  }

  const loadEntregas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Obtener período activo
      const { data: periodoActivo } = await supabase
        .from('periodos_academicos')
        .select('id')
        .eq('activo', true)
        .single()

      if (!periodoActivo) return

      // Cargar entregas programadas
      const { data: entregasData } = await supabase
        .from('entregas_programadas')
        .select(`
          *,
          tipos_documento (
            nombre,
            codigo
          )
        `)
        .eq('periodo_id', periodoActivo.id)
        .eq('activo', true)
        .order('fecha_limite')

      // Verificar estado de cada entrega para el docente
      const entregasConEstado = await Promise.all(
        (entregasData || []).map(async (entrega) => {
          const { data: documento } = await supabase
            .from('documentos')
            .select('estado')
            .eq('docente_id', user.id)
            .eq('entrega_id', entrega.id)
            .single()

          let estado: EntregaCalendario['estado'] = 'pendiente'
          if (documento) {
            switch (documento.estado) {
              case 'APROBADO':
                estado = 'aprobado'
                break
              case 'OBSERVADO':
                estado = 'observado'
                break
              default:
                estado = 'entregado'
            }
          }

          return {
            ...entrega,
            estado
          }
        })
      )

      setEntregas(entregasConEstado)
    } catch (error) {
      console.error('Error loading entregas:', error)
      toast.error('Error al cargar calendario')
    } finally {
      setLoading(false)
    }
  }

  const getDiasDelMes = () => {
    const año = mesActual.getFullYear()
    const mes = mesActual.getMonth()
    const primerDia = new Date(año, mes, 1)
    const ultimoDia = new Date(año, mes + 1, 0)
    const diasEnMes = ultimoDia.getDate()
    const primerDiaSemana = primerDia.getDay()

    const dias = []
    
    // Días del mes anterior
    for (let i = primerDiaSemana - 1; i >= 0; i--) {
      const dia = new Date(año, mes, -i)
      dias.push({ fecha: dia, esOtroMes: true })
    }

    // Días del mes actual
    for (let i = 1; i <= diasEnMes; i++) {
      dias.push({ fecha: new Date(año, mes, i), esOtroMes: false })
    }

    // Completar la última semana
    const diasRestantes = 42 - dias.length
    for (let i = 1; i <= diasRestantes; i++) {
      dias.push({ fecha: new Date(año, mes + 1, i), esOtroMes: true })
    }

    return dias
  }

  const getEntregasDelDia = (fecha: Date) => {
    return entregas.filter(entrega => {
      const fechaEntrega = new Date(entrega.fecha_limite)
      return fechaEntrega.toDateString() === fecha.toDateString()
    })
  }

  const cambiarMes = (direccion: number) => {
    setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + direccion))
  }

  const getColorEstado = (estado?: EntregaCalendario['estado']) => {
    switch (estado) {
      case 'aprobado':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'observado':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'entregado':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-red-100 text-red-800 border-red-200'
    }
  }

  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/docente')}
                className="mr-4 text-gray-500 hover:text-gray-700"
              >
                ← Volver
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Calendario de Entregas
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setVistaActual('mes')}
                className={`px-3 py-1 rounded ${vistaActual === 'mes' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Vista Mes
              </button>
              <button
                onClick={() => setVistaActual('lista')}
                className={`px-3 py-1 rounded ${vistaActual === 'lista' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Vista Lista
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {vistaActual === 'mes' ? (
          /* Vista Calendario */
          <div className="bg-white shadow rounded-lg p-6">
            {/* Controles del mes */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => cambiarMes(-1)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold">
                {nombresMeses[mesActual.getMonth()]} {mesActual.getFullYear()}
              </h2>
              <button
                onClick={() => cambiarMes(1)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 gap-0 mb-2">
              {diasSemana.map(dia => (
                <div key={dia} className="text-center text-sm font-medium text-gray-700 py-2">
                  {dia}
                </div>
              ))}
            </div>

            {/* Grid del calendario */}
            <div className="grid grid-cols-7 gap-0 border-t border-l">
              {getDiasDelMes().map((dia, index) => {
                const entregasDelDia = getEntregasDelDia(dia.fecha)
                const esHoy = dia.fecha.toDateString() === new Date().toDateString()
                
                return (
                  <div
                    key={index}
                    className={`border-r border-b p-2 min-h-[100px] ${
                      dia.esOtroMes ? 'bg-gray-50' : 'bg-white'
                    } ${esHoy ? 'bg-blue-50' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      dia.esOtroMes ? 'text-gray-400' : 'text-gray-900'
                    }`}>
                      {dia.fecha.getDate()}
                    </div>
                    
                    {/* Entregas del día */}
                    <div className="space-y-1">
                      {entregasDelDia.slice(0, 3).map((entrega, idx) => (
                        <div
                          key={entrega.id}
                          className={`text-xs p-1 rounded border ${getColorEstado(entrega.estado)} cursor-pointer hover:opacity-80`}
                          onClick={() => {
                            if (entrega.estado === 'pendiente' || entrega.estado === 'observado') {
                              router.push('/docente/subir')
                            } else {
                              router.push('/docente/documentos')
                            }
                          }}
                          title={`${entrega.tipo_documento.nombre} - ${entrega.titulo}`}
                        >
                          <div className="truncate">
                            {entrega.tipo_documento.codigo}
                          </div>
                        </div>
                      ))}
                      {entregasDelDia.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{entregasDelDia.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Leyenda */}
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-100 border border-red-200 rounded mr-2"></div>
                <span>Pendiente</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded mr-2"></div>
                <span>Entregado</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded mr-2"></div>
                <span>Con observaciones</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-100 border border-green-200 rounded mr-2"></div>
                <span>Aprobado</span>
              </div>
            </div>
          </div>
        ) : (
          /* Vista Lista */
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Todas las Entregas</h2>
            </div>
            
            <div className="divide-y divide-gray-200">
              {entregas.map((entrega) => {
                const fechaLimite = new Date(entrega.fecha_limite)
                const diasRestantes = Math.ceil((fechaLimite.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                const vencido = diasRestantes < 0 && entrega.estado === 'pendiente'
                
                return (
                  <div key={entrega.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">
                          {entrega.tipo_documento.nombre}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {entrega.titulo}
                        </p>
                        <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                          <span>
                            📅 {fechaLimite.toLocaleDateString()}
                          </span>
                          {entrega.estado === 'pendiente' && (
                            <span className={vencido ? 'text-red-600' : diasRestantes <= 3 ? 'text-yellow-600' : ''}>
                              {vencido ? 'Vencido' : `${diasRestantes} días restantes`}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4 flex flex-col items-end">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getColorEstado(entrega.estado)}`}>
                          {entrega.estado === 'pendiente' ? 'Pendiente' :
                           entrega.estado === 'entregado' ? 'Entregado' :
                           entrega.estado === 'observado' ? 'Con observaciones' :
                           'Aprobado'}
                        </span>
                        
                        {(entrega.estado === 'pendiente' || entrega.estado === 'observado') && (
                          <button
                            onClick={() => router.push('/docente/subir')}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                          >
                            Subir documento →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {entregas.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  No hay entregas programadas
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resumen de entregas */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-600">Total Entregas</div>
            <div className="text-2xl font-bold text-gray-900">{entregas.length}</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-4">
            <div className="text-sm font-medium text-red-600">Pendientes</div>
            <div className="text-2xl font-bold text-red-900">
              {entregas.filter(e => e.estado === 'pendiente').length}
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4">
            <div className="text-sm font-medium text-yellow-600">Con Observaciones</div>
            <div className="text-2xl font-bold text-yellow-900">
              {entregas.filter(e => e.estado === 'observado').length}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4">
            <div className="text-sm font-medium text-green-600">Aprobadas</div>
            <div className="text-2xl font-bold text-green-900">
              {entregas.filter(e => e.estado === 'aprobado').length}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}