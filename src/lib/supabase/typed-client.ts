import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

/**
 * Cliente de Supabase que conoce las tablas, columnas y funciones de la base.
 * Con él, consultar algo que no existe es un error de compilación. Los tipos
 * salen de `npm run db:types`.
 */
export type TypedSupabaseClient = SupabaseClient<Database>;
