"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Curso, Asignatura, CursoAsignatura } from "@/types/database";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function CursoAsignaturaPage() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [relaciones, setRelaciones] = useState<CursoAsignatura[]>([]);
  const [form, setForm] = useState({ curso_id: "", asignatura_id: "", horas_semanales: "" });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const { data: cursosData } = await supabase.from("cursos").select("*").eq("activo", true).order("curso");
    setCursos(cursosData || []);
    const { data: asignaturasData } = await supabase.from("asignaturas").select("*").eq("activo", true).order("nombre");
    setAsignaturas(asignaturasData || []);
    const { data: relacionesData } = await supabase.from("curso_asignaturas").select("*, cursos(*), asignaturas(*)").eq("activo", true);
    setRelaciones(relacionesData || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.curso_id || !form.asignatura_id || !form.horas_semanales) {
      toast.error("Completa todos los campos");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("curso_asignaturas").insert({
      curso_id: parseInt(form.curso_id),
      asignatura_id: parseInt(form.asignatura_id),
      horas_semanales: parseInt(form.horas_semanales),
      activo: true,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Relación agregada");
      setForm({ curso_id: "", asignatura_id: "", horas_semanales: "" });
      cargarDatos();
    }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    setLoading(true);
    const { error } = await supabase.from("curso_asignaturas").update({ activo: false }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Relación eliminada");
      cargarDatos();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Gestionar malla curricular
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="mb-8 flex flex-wrap gap-4 items-end bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Curso</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.curso_id}
              onChange={e => setForm(f => ({ ...f, curso_id: e.target.value }))}
              required
            >
              <option value="">Seleccionar...</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>{c.curso} {c.paralelo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Asignatura</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.asignatura_id}
              onChange={e => setForm(f => ({ ...f, asignatura_id: e.target.value }))}
              required
            >
              <option value="">Seleccionar...</option>
              {asignaturas.map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Horas/Sem</label>
            <input
              type="number"
              className="border border-gray-300 rounded-lg px-3 py-2 w-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={1}
              value={form.horas_semanales}
              onChange={e => setForm(f => ({ ...f, horas_semanales: e.target.value }))}
              required
            />
          </div>
          <button 
            type="submit" 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5" 
            disabled={loading}
          >
            Agregar
          </button>
        </form>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Relaciones existentes</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Curso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asignatura</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horas/Sem</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {relaciones.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.cursos?.curso} {r.cursos?.paralelo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.asignaturas?.nombre}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{r.horas_semanales}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    <button 
                      onClick={() => handleDelete(r.id)} 
                      className="text-red-600 hover:text-red-800 hover:underline transition-colors" 
                      disabled={loading}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
} 