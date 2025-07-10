import { NextRequest, NextResponse } from 'next/server'
import { uploadToGoogleDrive } from '@/lib/googledrive/client'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'No se recibió archivo' }, { status: 400 })
    }
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = file.type || 'application/octet-stream'
    const fileName = file.name || 'documento.pdf'

    // Subir a Google Drive
    const result = await uploadToGoogleDrive(fileName, buffer, mimeType)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('Error en subida:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Error interno' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Método no permitido' }, { status: 405 })
} 