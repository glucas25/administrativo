import { useState } from 'react';

const mockReportes = [
  { docente: 'Juan Pérez', entregados: 5, pendientes: 2, observados: 1, aprobados: 4 },
  { docente: 'María García', entregados: 6, pendientes: 0, observados: 0, aprobados: 6 },
  { docente: 'Carlos López', entregados: 4, pendientes: 3, observados: 2, aprobados: 2 },
];

export default function ReportesPage() {
  const [filtro, setFiltro] = useState('');
  const reportesFiltrados = mockReportes.filter(r => r.docente.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Reportes de Entregas por Docente</h1>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar docente..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          className="border p-2 rounded w-full md:w-1/2"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded shadow">
          <thead>
            <tr>
              <th className="px-4 py-2 border">Docente</th>
              <th className="px-4 py-2 border">Entregados</th>
              <th className="px-4 py-2 border">Pendientes</th>
              <th className="px-4 py-2 border">Observados</th>
              <th className="px-4 py-2 border">Aprobados</th>
            </tr>
          </thead>
          <tbody>
            {reportesFiltrados.map((r, idx) => (
              <tr key={idx}>
                <td className="px-4 py-2 border">{r.docente}</td>
                <td className="px-4 py-2 border text-center">{r.entregados}</td>
                <td className="px-4 py-2 border text-center">{r.pendientes}</td>
                <td className="px-4 py-2 border text-center">{r.observados}</td>
                <td className="px-4 py-2 border text-center">{r.aprobados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
