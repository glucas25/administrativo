const { google } = require('googleapis')
const path = require('path')
require('dotenv').config()

// Configurar autenticación
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-credentials.json'),
  scopes: ['https://www.googleapis.com/auth/drive.file']
})

const drive = google.drive({ version: 'v3', auth })

// Función para crear carpeta si no existe
async function createFolderIfNotExists(folderName, parentFolderId) {
  try {
    // Buscar si la carpeta ya existe
    const query = parentFolderId 
      ? `name='${folderName}' and '${parentFolderId}' in parents and trashed=false`
      : `name='${folderName}' and '${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`
    
    const { data: existingFolders } = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    })

    if (existingFolders.files && existingFolders.files.length > 0) {
      console.log(`✅ Carpeta "${folderName}" ya existe`)
      return existingFolders.files[0].id
    }

    // Crear nueva carpeta
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : [process.env.GOOGLE_DRIVE_FOLDER_ID]
    }

    const { data: newFolder } = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name'
    })

    console.log(`✅ Carpeta "${folderName}" creada exitosamente`)
    return newFolder.id
  } catch (error) {
    console.error(`❌ Error creando carpeta "${folderName}":`, error.message)
    throw error
  }
}

// Función para crear estructura de carpetas
async function createDriveStructure() {
  try {
    console.log('🚀 Iniciando creación de estructura de carpetas en Google Drive...')
    
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!rootFolderId) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID no está configurado')
    }

    console.log(`📁 Carpeta raíz: ${rootFolderId}`)

    // Crear carpetas de ejemplo para demostración
    const estructura = [
      {
        nombre: 'Sistema Docentes',
        subcarpetas: [
          {
            nombre: 'Periodo 2024-2025',
            subcarpetas: [
              {
                nombre: 'Diagnóstico',
                subcarpetas: [
                  {
                    nombre: 'Docente Juan Pérez',
                    subcarpetas: [
                      { nombre: 'Matemáticas' },
                      { nombre: 'Física' }
                    ]
                  },
                  {
                    nombre: 'Docente María García',
                    subcarpetas: [
                      { nombre: 'Historia' },
                      { nombre: 'Geografía' }
                    ]
                  }
                ]
              },
              {
                nombre: 'Trimestre 1',
                subcarpetas: [
                  {
                    nombre: 'Docente Juan Pérez',
                    subcarpetas: [
                      { nombre: 'Matemáticas' },
                      { nombre: 'Física' }
                    ]
                  }
                ]
              },
              {
                nombre: 'Trimestre 2',
                subcarpetas: []
              },
              {
                nombre: 'Trimestre 3',
                subcarpetas: []
              },
              {
                nombre: 'Supletorio',
                subcarpetas: []
              }
            ]
          }
        ]
      }
    ]

    // Función recursiva para crear carpetas
    async function createFoldersRecursive(folders, parentId = rootFolderId) {
      for (const folder of folders) {
        const folderId = await createFolderIfNotExists(folder.nombre, parentId)
        
        if (folder.subcarpetas && folder.subcarpetas.length > 0) {
          await createFoldersRecursive(folder.subcarpetas, folderId)
        }
      }
    }

    await createFoldersRecursive(estructura)
    
    console.log('✅ Estructura de carpetas creada exitosamente')
    console.log('\n📋 Estructura creada:')
    console.log('📁 Sistema Docentes/')
    console.log('  📁 Periodo 2024-2025/')
    console.log('    📁 Diagnóstico/')
    console.log('      📁 Docente Juan Pérez/')
    console.log('        📁 Matemáticas/')
    console.log('        📁 Física/')
    console.log('      📁 Docente María García/')
    console.log('        📁 Historia/')
    console.log('        📁 Geografía/')
    console.log('    📁 Trimestre 1/')
    console.log('      📁 Docente Juan Pérez/')
    console.log('        📁 Matemáticas/')
    console.log('        📁 Física/')
    console.log('    📁 Trimestre 2/')
    console.log('    📁 Trimestre 3/')
    console.log('    📁 Supletorio/')

  } catch (error) {
    console.error('❌ Error creando estructura:', error.message)
    process.exit(1)
  }
}

// Ejecutar script
if (require.main === module) {
  createDriveStructure()
}

module.exports = { createDriveStructure } 