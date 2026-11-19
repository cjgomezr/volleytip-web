import { serverEnv } from "~/lib/env.server";

// Ruta de recurso para Railway y el monitoreo de disponibilidad (NFR-009).
// Dice que el servidor responde y en qué entorno corre, para comprobar de un
// vistazo que cada servicio apunta a donde debe. No toca ningún servicio
// externo, y del entorno solo expone el nombre: nunca una llave ni una URL.
export function loader(): Response {
  return Response.json(
    { status: "ok", environment: serverEnv.appEnv },
    { headers: { "Cache-Control": "no-store" } },
  );
}
