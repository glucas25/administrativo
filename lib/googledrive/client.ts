import { google } from 'googleapis'
import path from 'path'
import { Readable } from 'stream'

// Configurar autenticación
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-credentials.json'),
  scopes: ['https://www.googleapis.com/auth/drive.file']
})

const drive = google.drive({ version: 'v3', auth })

// Interfaz para el resultado de la subida
export interface UploadResult {
  id: string
  name: string
  webViewLink: string
  webContentLink: string
}

// Función para subir archivos a Google Drive
export async function uploadToGoogleDrive(
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<UploadResult> {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!]
    }
    
    const media = {
      mimeType,
      body: Readable.from(fileBuffer)
    }
    
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink'
    })
    
    // Hacer el archivo público
    await drive.permissions.create({
      fileId: response.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    })
    
    return {
      id: response.data.id!,
      name: response.data.name!,
      webViewLink: response.data.webViewLink!,
      webContentLink: response.data.webContentLink!
    }
  } catch (error) {
    console.error('Error uploading to Google Drive:', error)
    throw error
  }
}
