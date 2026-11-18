/**
 * Opciones comunes de los clientes de Supabase del servidor. Un servidor
 * atiende a muchas personas con el mismo proceso, así que el cliente no
 * guarda ni renueva ninguna sesión: cada petición crea el suyo. Las sesiones
 * con cookies llegan con el admin (W10a).
 */
export const SERVER_CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;
