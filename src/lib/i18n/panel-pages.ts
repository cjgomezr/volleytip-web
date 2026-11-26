import { SUPPORTED_LANGUAGES, type Language } from "./languages";
import { buildPagePath, type PageDeclaration } from "./page-path";
import { findLanguage } from "./pages";

// El mapa de páginas del panel (decisión 4 del PRD de W10a). Tiene la forma
// del mapa del sitio, pero va aparte: estas páginas viven fuera de la
// cáscara, no se enlazan desde el sitio y no entran en el sitemap. Se
// agrupan por quién puede verlas, que es como se anidan en `src/routes.ts`.

/** Abiertas a quien no tiene sesión. */
export const PANEL_ENTRY_PAGES = [
  {
    id: "adminSignIn",
    file: "routes/panel/sign-in.tsx",
    path: { es: "admin/entrar", en: "admin/sign-in" },
  },
  // Adonde lleva el enlace del correo: la plantilla de
  // `supabase/templates/` escribe estas direcciones.
  {
    id: "adminSignInLink",
    file: "routes/panel/sign-in-link.tsx",
    path: { es: "admin/entrar/enlace", en: "admin/sign-in/link" },
  },
] as const satisfies readonly PageDeclaration[];

/** Para todo el equipo: admin y staff. */
export const PANEL_MEMBER_PAGES = [
  { id: "adminHome", file: "routes/panel/home.tsx", path: "admin" },
  {
    id: "adminSignOut",
    file: "routes/panel/sign-out.tsx",
    path: { es: "admin/salir", en: "admin/sign-out" },
  },
] as const satisfies readonly PageDeclaration[];

/** Solo para admin. Cada sección del panel se agrega aquí, antes del
 * comodín que responde por las direcciones que no existen. */
export const PANEL_ADMIN_PAGES = [
  {
    id: "adminMore",
    file: "routes/panel/more.tsx",
    path: { es: "admin/mas", en: "admin/more" },
  },
  {
    id: "adminLanguage",
    file: "routes/panel/language.ts",
    path: { es: "admin/idioma", en: "admin/language" },
  },
  {
    id: "adminSiteTexts",
    file: "routes/panel/site-texts.tsx",
    path: { es: "admin/textos", en: "admin/site-texts" },
  },
  // Cada formulario de la pantalla envía a la suya: una ruta, una acción.
  {
    id: "adminSiteTextsAnnouncements",
    file: "routes/panel/site-texts-announcements.tsx",
    path: { es: "admin/textos/barra", en: "admin/site-texts/announcements" },
  },
  {
    id: "adminSiteTextsStats",
    file: "routes/panel/site-texts-stats.tsx",
    path: { es: "admin/textos/cifras", en: "admin/site-texts/figures" },
  },
  {
    id: "adminSettings",
    file: "routes/panel/settings.tsx",
    path: { es: "admin/ajustes", en: "admin/settings" },
  },
  // La confirmación para encender el mantenimiento, y a donde envían sus
  // botones.
  {
    id: "adminSettingsMaintenance",
    file: "routes/panel/maintenance.tsx",
    path: {
      es: "admin/ajustes/mantenimiento",
      en: "admin/settings/maintenance",
    },
  },
  { id: "adminMissing", file: "routes/panel/missing.tsx", path: "admin/*" },
] as const satisfies readonly PageDeclaration[];

/** Todas las páginas del panel y de su entrada. */
export const PANEL_PAGES = [
  ...PANEL_ENTRY_PAGES,
  ...PANEL_MEMBER_PAGES,
  ...PANEL_ADMIN_PAGES,
] as const;

export type PanelPageId = (typeof PANEL_PAGES)[number]["id"];

/** La declaración de una página del panel. */
export function findPanelPage(id: PanelPageId): PageDeclaration {
  const page = PANEL_PAGES.find((candidate) => candidate.id === id);
  if (page === undefined) {
    throw new Error(`La página "${id}" no está en el mapa del panel.`);
  }
  return page;
}

/** La dirección de una página del panel en un idioma: `/en/admin/sign-in`. */
export function getPanelPath(id: PanelPageId, language: Language): string {
  return buildPagePath(findPanelPage(id), findLanguage(language));
}

/** Dice si una dirección es del panel o cuelga de él, en cualquier idioma.
 * Va por segmento completo: `/administracion` no es del panel. */
export function isPanelPath(pathname: string): boolean {
  return SUPPORTED_LANGUAGES.some(({ code }) => {
    const home = getPanelPath("adminHome", code);
    return pathname === home || pathname.startsWith(`${home}/`);
  });
}
