import { type RouteConfig, layout, route } from "@react-router/dev/routes";

import { PAGES } from "./lib/i18n/pages";
import { buildLocalizedRoutes } from "./lib/i18n/route-map";

export default [
  // La cáscara (header) envuelve las páginas del sitio y el 404. Las rutas
  // de abajo, que no son páginas, quedan fuera de ella, y con ella el aviso
  // de idioma: es a propósito.
  layout("routes/site-layout.tsx", [
    // Las páginas del sitio se declaran una vez en el mapa de páginas y
    // existen en todos los idiomas.
    ...buildLocalizedRoutes(PAGES),
    // Siempre al final: recibe lo que no coincidió con ninguna ruta.
    route("*", "routes/not-found.tsx"),
  ]),
  // Sin versión por idioma: no son páginas del sitio.
  route("healthz", "routes/healthz.ts"),
  // Página de muestra de los componentes. En producción responde 404.
  route("dev/componentes", "routes/dev-components.tsx"),
  // Falla a propósito para ver las páginas de error. En producción responde
  // 404. La versión en inglés existe para ver la página en ese idioma.
  route("dev/fallo", "routes/dev-failure.ts"),
  route("en/dev/fallo", "routes/dev-failure.ts", { id: "dev-failure-en" }),
  // Guarda el idioma elegido y lleva a la misma página en ese idioma.
  route("idioma", "routes/language-choice.ts"),
  // Diagnóstico de las cabeceras del proxy. En producción responde 404.
  route("dev/cabeceras", "routes/dev-headers.ts"),
] satisfies RouteConfig;
