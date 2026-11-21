import { type RouteConfig, route } from "@react-router/dev/routes";

import { buildLocalizedRoutes } from "./lib/i18n/route-map";

export default [
  // Cada página se declara una vez aquí y existe en todos los idiomas.
  ...buildLocalizedRoutes([{ id: "home", file: "routes/home.tsx", path: "" }]),
  // Sin versión por idioma: no son páginas del sitio.
  route("healthz", "routes/healthz.ts"),
  // Página de muestra de los componentes. En producción responde 404.
  route("dev/componentes", "routes/dev-components.tsx"),
  // Diagnóstico de las cabeceras del proxy. En producción responde 404.
  route("dev/cabeceras", "routes/dev-headers.ts"),
  // Siempre al final: recibe lo que no coincidió con ninguna ruta.
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
