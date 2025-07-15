const { google } = require('googleapis')
const path = require('path')
require('dotenv').config()

// Configurar autenticación
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-credentials.json'),
  scopes: ['https://www.googleapis.com/auth/drive.file']
})

const drive = google.drive({ version: 'v3', auth })

// Función para obtener archivos de la carpeta raíz
async function getFilesFromRoot() {
  try {
    const { data } = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
      fields: 'files(id, name, createdTime, size)',
      orderBy: 'createdTime desc'
    })
    
    return data.files || []
  } catch (error) {
    console.error('Error obteniendo archivos:', error.message)
    return []
  }
}

// Función para obtener metadatos de un archivo desde Supabase
async function getFileMetadata(fileName) {
  // Esta función simula la obtención de metadatos
  // En una implementación real, buscarías en la base de datos
  console.log(`📄 Procesando archivo: ${fileName}`)
  
  // Extraer información del nombre del archivo si es posible
  const metadata = {
    docente_id: 'unknown',
    docente_nombre: 'Docente Desconocido',
    periodo_id: 1,
    periodo_nombre: 'Periodo Actual',
    etapa_id: null,
    etapa_nombre: null,
    asignatura_id: null,
    asignatura_nombre: null,
    tipo_documento_id: 1,
    tipo_documento_nombre: 'Documento'
  }
  
  return metadata
}

// Función para crear estructura de carpetas
async function createFolderStructure(metadata) {
  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    
    // Crear carpeta del periodo
    const periodoFolderName = `Periodo ${metadata.periodo_nombre || metadata.periodo_id}`
    const periodoFolderId = await createFolderIfNotExists(periodoFolderName, rootFolderId)
    
    // Crear carpeta del docente
    const docenteFolderName = metadata.docente_nombre || `Docente ${metadata.docente_id}`
    const docenteFolderId = await createFolderIfNotExists(docenteFolderName, periodoFolderId)
    
    // Crear carpeta de asignatura si existe
    let targetFolderId = docenteFolderId
    if (metadata.asignatura_nombre) {
      targetFolderId = await createFolderIfNotExists(metadata.asignatura_nombre, docenteFolderId)
    }
    
    return targetFolderId
  } catch (error) {
    console.error('Error creando estructura:', error.message)
    return process.env.GOOGLE_DRIVE_FOLDER_ID
  }
}

// Función para crear carpeta si no existe
async function createFolderIfNotExists(folderName, parentFolderId) {
  try {
    const query = `name='${folderName}' and '${parentFolderId}' in parents and trashed=false`
    
    const { data: existingFolders } = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    })

    if (existingFolders.files && existingFolders.files.length > 0) {
      return existingFolders.files[0].id
    }

    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId]
    }

    const { data: newFolder } = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name'
    })

    console.log(`✅ Carpeta "${folderName}" creada`)
    return newFolder.id
  } catch (error) {
    console.error(`❌ Error creando carpeta "${folderName}":`, error.message)
    throw error
  }
}

// Función para mover archivo
async function moveFile(fileId, targetFolderId) {
  try {
    await drive.files.update({
      fileId: fileId,
      addParents: targetFolderId,
      removeParents: process.env.GOOGLE_DRIVE_FOLDER_ID,
      fields: 'id, name'
    })
    
    console.log(`✅ Archivo movido exitosamente`)
    return true
  } catch (error) {
    console.error('❌ Error moviendo archivo:', error.message)
    return false
  }
}

// Función principal de migración
async function migrateExistingFiles() {
  try {
    console.log('🚀 Iniciando migración de archivos existentes...')
    
    // Obtener archivos de la carpeta raíz
    const files = await getFilesFromRoot()
    
    if (files.length === 0) {
      console.log('✅ No hay archivos para migrar en la carpeta raíz')
      return
    }
    
    console.log(`📁 Encontrados ${files.length} archivos para migrar`)
    
    let migratedCount = 0
    let errorCount = 0
    
    for (const file of files) {
      try {
        console.log(`\n📄 Procesando: ${file.name}`)
        
        // Obtener metadatos del archivo
        const metadata = await getFileMetadata(file.name)
        
        // Crear estructura de carpetas
        const targetFolderId = await createFolderStructure(metadata)
        
        // Mover archivo
        const success = await moveFile(file.id, targetFolderId)
        
        if (success) {
          migratedCount++
        } else {
          errorCount++
        }
        
        // Pausa para evitar límites de API
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`❌ Error procesando ${file.name}:`, error.message)
        errorCount++
      }
    }
    
    console.log('\n📊 Resumen de migración:')
    console.log(`✅ Archivos migrados: ${migratedCount}`)
    console.log(`❌ Errores: ${errorCount}`)
    console.log(`📁 Total procesados: ${files.length}`)
    
  } catch (error) {
    console.error('❌ Error en migración:', error.message)
  }
}

// Ejecutar script
if (require.main === module) {
  migrateExistingFiles()
}

module.exports = { migrateExistingFiles } 