import React, { useState } from 'react'
import { completarPerfil } from '@/lib/auth/cliente' // Ajusta la ruta según dónde pongas la función

export default function CompletarPerfil({ authUser, onComplete }: { authUser: any, onComplete?: (user: any) => void }) {
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    cedula: '',
    rol: 'docente'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await completarPerfil(formData)
      if (result.success) {
        if (onComplete) onComplete(result.user)
      } else {
        setError(result.error || 'Error al completar el perfil')
      }
    } catch (err: any) {
      setError('Error inesperado: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="completar-perfil-container">
      <h2>Completa tu perfil</h2>
      <p>Necesitamos algunos datos adicionales para configurar tu cuenta.</p>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="nombres">Nombres *</label>
          <input type="text" id="nombres" name="nombres" value={formData.nombres} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="apellidos">Apellidos *</label>
          <input type="text" id="apellidos" name="apellidos" value={formData.apellidos} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="cedula">Cédula *</label>
          <input type="text" id="cedula" name="cedula" value={formData.cedula} onChange={handleChange} required />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </form>
    </div>
  )
} 