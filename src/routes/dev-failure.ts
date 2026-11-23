import { data } from "react-router";

import { serverEnv } from "~/lib/env.server";

import type { Route } from "./+types/dev-failure";

// Falla a propósito para poder ver las páginas de error en las pruebas de
// Playwright. Sin parámetro lanza un error no controlado (500); con
// `?estado=403` lanza una respuesta controlada con ese estado. En producción
// no existe: responde 404.

const NOT_FOUND_STATUS = 404;
const FORBIDDEN_STATUS = 403;
const FORBIDDEN_PARAM = String(FORBIDDEN_STATUS);

/** Un texto que la página de error nunca debe mostrar. */
export const DEV_FAILURE_SECRET_MESSAGE = "detalle-tecnico-secreto";

export function loader({ request }: Route.LoaderArgs): never {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const state = new URL(request.url).searchParams.get("estado");
  if (state === FORBIDDEN_PARAM) {
    throw data(null, { status: FORBIDDEN_STATUS });
  }
  throw new Error(DEV_FAILURE_SECRET_MESSAGE);
}

// Nunca se pinta: el loader siempre lanza.
export default function DevFailure(): null {
  return null;
}
