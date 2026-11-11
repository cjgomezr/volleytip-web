// Ruta de recurso para Railway y el monitoreo de disponibilidad (NFR-009).
// Solo dice que el servidor responde; no toca ningún servicio externo.
export function loader(): Response {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
