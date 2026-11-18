import { serverEnv } from "~/lib/env.server";

// Ruta de recurso para Railway y el monitoreo de disponibilidad (NFR-009).
// Solo dice que el servidor responde; no toca ningún servicio externo.
export function loader(): Response {
  // env.server.ts valida al cargarse, y el servidor carga todas las rutas al
  // arrancar: referenciarlo aquí hace que un servidor mal configurado no
  // arranque, en vez de fallar en la primera petición que use una variable.
  // El ticket #30 lo usa de verdad, al agregar el entorno a la respuesta.
  void serverEnv;

  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
