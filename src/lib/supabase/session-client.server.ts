import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
  type CookieOptions,
} from "@supabase/ssr";

import type { Database } from "../database.types";
import { serverEnv, type AppEnvironment, type ServerEnv } from "../env.server";
import type { TypedSupabaseClient } from "./typed-client";

// Solo en la máquina de quien programa el sitio se sirve sin cifrar.
const ENVIRONMENTS_WITHOUT_SECURE: readonly AppEnvironment[] = [
  "local",
  "test",
];

export interface SessionSupabase {
  /** Consulta como la persona de la petición: aplican sus políticas RLS. */
  readonly client: TypedSupabaseClient;
  /** Anota en una respuesta las cookies que la sesión cambió: las nuevas al
   * renovarse, o su borrado al cerrarse. */
  readonly writeCookies: (headers: Headers) => void;
}

// `httpOnly`: el navegador nunca lee la sesión. Ningún componente crea un
// cliente de Supabase.
function buildCookieOptions(appEnv: AppEnvironment): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: !ENVIRONMENTS_WITHOUT_SECURE.includes(appEnv),
    path: "/",
  };
}

// Lo que se lee de la petición y lo que se va a escribir en la respuesta.
// Una escritura se ve en la lectura siguiente, así que renovar y cerrar la
// sesión en la misma petición no deja una cookie suelta.
function createCookieJar(request: Request): {
  readonly getAll: () => { name: string; value: string }[];
  readonly set: (name: string, value: string, options: CookieOptions) => void;
  readonly writeCookies: (headers: Headers) => void;
} {
  const current = new Map(
    parseCookieHeader(request.headers.get("Cookie") ?? "").map(
      ({ name, value }) => [name, value ?? ""],
    ),
  );
  const pending = new Map<string, string>();
  return {
    getAll: () => [...current].map(([name, value]) => ({ name, value })),
    set: (name, value, options) => {
      pending.set(name, serializeCookieHeader(name, value, options));
      if (options.maxAge === 0) current.delete(name);
      else current.set(name, value);
    },
    writeCookies: (headers) => {
      for (const cookie of pending.values()) {
        headers.append("Set-Cookie", cookie);
      }
    },
  };
}

/**
 * Cliente de Supabase con la sesión de Auth que viene en las cookies de la
 * petición (llave pública: respeta RLS). Es el cliente de las consultas del
 * panel. Quien lo crea tiene que llamar a `writeCookies` sobre la respuesta,
 * o una sesión renovada se pierde.
 *
 * Se crea uno por petición. El segundo argumento existe para las pruebas.
 */
export function createSessionSupabaseClient(
  request: Request,
  env: ServerEnv = serverEnv,
): SessionSupabase {
  const jar = createCookieJar(request);
  const client = createServerClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookieOptions: buildCookieOptions(env.appEnv),
      cookies: {
        getAll: jar.getAll,
        setAll: (cookies) => {
          for (const { name, value, options } of cookies) {
            jar.set(name, value, options);
          }
        },
      },
    },
  );
  return { client, writeCookies: jar.writeCookies };
}
