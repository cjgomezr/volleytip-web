import { type RouteConfig, layout, route } from "@react-router/dev/routes";

import { PAGES } from "./lib/i18n/pages";
import {
  PANEL_ADMIN_PAGES,
  PANEL_ENTRY_PAGES,
  PANEL_MEMBER_PAGES,
} from "./lib/i18n/panel-pages";
import { buildLocalizedRoutes } from "./lib/i18n/route-map";

export default [
  // La cáscara (header) envuelve las páginas del sitio y el 404. Las rutas
  // de abajo, que no son páginas, quedan fuera de ella, y con ella el aviso
  // de idioma: es a propósito.
  layout("routes/site-layout.tsx", [
    // Las páginas del sitio se declaran una vez en el mapa de páginas y
    // existen en todos los idiomas.
    ...buildLocalizedRoutes(PAGES),
    // Pinta la página de la app en cada estado, sin la base, dentro de la
    // cáscara. En producción responde 404.
    route("dev/app", "routes/dev-app.tsx"),
    route("en/dev/app", "routes/dev-app.tsx", { id: "dev-app-en" }),
    // Pinta las preguntas frecuentes con preguntas de muestra, sin la base.
    // En producción responde 404.
    route("dev/faq", "routes/dev-faq.tsx"),
    route("en/dev/faq", "routes/dev-faq.tsx", { id: "dev-faq-en" }),
    // Pinta Contacto en cada uno de sus estados, sin la base. En producción
    // responde 404.
    route("dev/contact", "routes/dev-contact.tsx"),
    route("en/dev/contact", "routes/dev-contact.tsx", {
      id: "dev-contact-en",
    }),
    // Siempre al final: recibe lo que no coincidió con ninguna ruta.
    route("*", "routes/not-found.tsx"),
  ]),
  // El panel y su entrada: en los dos idiomas, sin la cáscara del sitio.
  // Cada nivel de layout agrega una exigencia: sesión en cookies y origen,
  // después ser del equipo y, en las secciones, ser admin.
  layout("routes/panel/session-layout.tsx", [
    ...buildLocalizedRoutes(PANEL_ENTRY_PAGES),
    layout("routes/panel/member-layout.tsx", [
      ...buildLocalizedRoutes(PANEL_MEMBER_PAGES),
      layout("routes/panel/admin-layout.tsx", [
        ...buildLocalizedRoutes(PANEL_ADMIN_PAGES),
      ]),
    ]),
  ]),
  // Pinta la cáscara del panel con módulos de muestra, sin sesión ni base.
  // En producción responde 404.
  route("dev/panel/*", "routes/dev-panel.tsx"),
  route("en/dev/panel/*", "routes/dev-panel.tsx", { id: "dev-panel-en" }),
  // Pinta la entrada del panel y la página de su enlace en cada estado, sin la
  // base. En producción responde 404.
  route("dev/entrar", "routes/dev-sign-in.tsx"),
  route("en/dev/entrar", "routes/dev-sign-in.tsx", { id: "dev-sign-in-en" }),
  // Pinta los ajustes del panel y la confirmación del mantenimiento en cada
  // estado, sin sesión ni base. En producción responde 404.
  route("dev/ajustes", "routes/dev-settings.tsx"),
  route("en/dev/ajustes", "routes/dev-settings.tsx", {
    id: "dev-settings-en",
  }),
  // Sin versión por idioma: no son páginas del sitio.
  route("healthz", "routes/healthz.ts"),
  // Los archivos con que el celular abre `/r/` en la app. Son de recurso:
  // sin cáscara, sin idioma y sin redirección.
  route(".well-known/assetlinks.json", "routes/assetlinks.ts"),
  route(
    ".well-known/apple-app-site-association",
    "routes/apple-app-site-association.ts",
  ),
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
  // Pinta la página de mantenimiento sin encender el modo. En producción
  // responde 404.
  route("dev/mantenimiento", "routes/dev-maintenance.tsx"),
  route("en/dev/mantenimiento", "routes/dev-maintenance.tsx", {
    id: "dev-maintenance-en",
  }),
] satisfies RouteConfig;
