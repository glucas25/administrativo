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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 bg-purple-700 px-8 py-6 shadow text-white">
        <h1 className="text-3xl font-bold">Gestionar malla curricular</h1>
        <button
          onClick={() => router.push('/vicerrector')}
          className="text-purple-200 hover:text-white text-sm mt-2"
        >
          ← Volver al dashboard
        </button>
      </div>
      <form onSubmit={handleSubmit} className="mb-8 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Curso</label>
          <select
            className="border rounded px-2 py-1"
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
          <label className="block text-sm font-medium mb-1">Asignatura</label>
          <select
            className="border rounded px-2 py-1"
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
          <label className="block text-sm font-medium mb-1">Horas/Sem</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-24"
            min={1}
            value={form.horas_semanales}
            onChange={e => setForm(f => ({ ...f, horas_semanales: e.target.value }))}
            required
          />
        </div>
        <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700" disabled={loading}>
          Agregar
        </button>
      </form>
      <h2 className="text-lg font-semibold mb-2">Relaciones existentes</h2>
      <table className="min-w-full border text-sm">
        <thead>
          <tr>
            <th className="border px-2 py-1">Curso</th>
            <th className="border px-2 py-1">Asignatura</th>
            <th className="border px-2 py-1">Horas/Sem</th>
            <th className="border px-2 py-1">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {relaciones.map(r => (
            <tr key={r.id}>
              <td className="border px-2 py-1">{r.cursos?.curso} {r.cursos?.paralelo}</td>
              <td className="border px-2 py-1">{r.asignaturas?.nombre}</td>
              <td className="border px-2 py-1 text-center">{r.horas_semanales}</td>
              <td className="border px-2 py-1 text-center">
                <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline" disabled={loading}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 