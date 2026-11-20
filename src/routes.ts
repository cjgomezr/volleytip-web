import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("healthz", "routes/healthz.ts"),
  // Página de muestra de los componentes. En producción responde 404.
  route("dev/componentes", "routes/dev-components.tsx"),
  // Diagnóstico de las cabeceras del proxy. En producción responde 404.
  route("dev/cabeceras", "routes/dev-headers.ts"),
  // Siempre al final: recibe lo que no coincidió con ninguna ruta.
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
