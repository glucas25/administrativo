// scripts/add_perfil_docente.js
// Uso: node scripts/add_perfil_docente.js <correo> <apellidos> <nombres> <rol>
// Ejemplo: node scripts/add_perfil_docente.js usuario@ejemplo.com Perez Juan docente

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan variables de entorno de Supabase.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const [,, correo, apellidos, nombres, rol] = process.argv;

if (!correo || !apellidos || !nombres || !rol) {
  console.log('Uso: node scripts/add_perfil_docente.js <correo> <apellidos> <nombres> <rol>');
  process.exit(1);
}

async function main() {
  // Buscar el user_id en auth.users por correo usando la función RPC
  const { data: userIdData, error: errorUser } = await supabase
    .rpc('get_user_id_by_email', { email_input: correo });

  if (errorUser) {
    console.error('Error buscando usuario en auth.users:', errorUser.message);
    process.exit(1);
  }
  if (!userIdData) {
    console.error('No se encontró un usuario en auth.users con ese correo.');
    process.exit(1);
  }
  const user_id = userIdData;

  // Verificar si ya existe el perfil
  const { data: existente, error: errorExistente } = await supabase
    .from('perfiles_docentes')
    .select('id')
    .eq('user_id', user_id)
    .single();
  if (existente) {
    console.log('Ya existe un perfil para este user_id.');
    process.exit(0);
  }

  const { data, error } = await supabase
    .from('perfiles_docentes')
    .insert([
      {
        user_id,
        apellidos,
        nombres,
        rol,
        activo: true
      }
    ])
    .select();

  if (error) {
    console.error('Error al crear el perfil:', error.message);
    process.exit(1);
  }
  console.log('Perfil creado correctamente:', data);
}

main();