import { SUPPORTED_LANGUAGES, type Language } from "./languages";
import {
  buildPagePath,
  type PageDeclaration,
  type PageParams,
} from "./page-path";
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
  // Entrar con Google (#132): a donde envía el botón y a donde vuelve la
  // persona desde Google.
  {
    id: "adminSignInGoogle",
    file: "routes/panel/sign-in-google.tsx",
    path: { es: "admin/entrar/google", en: "admin/sign-in/google" },
  },
  {
    id: "adminSignInGoogleReturn",
    file: "routes/panel/sign-in-google-return.ts",
    path: {
      es: "admin/entrar/google/vuelta",
      en: "admin/sign-in/google/return",
    },
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
    id: "adminMessages",
    file: "routes/panel/messages.tsx",
    path: { es: "admin/mensajes", en: "admin/messages" },
  },
  {
    id: "adminMessage",
    file: "routes/panel/message.tsx",
    path: {
      es: "admin/mensajes/:messageId",
      en: "admin/messages/:messageId",
    },
  },
  // Cada cambio de estado tiene su ruta: una ruta, una acción.
  {
    id: "adminMessageAnswer",
    file: "routes/panel/message-answer.tsx",
    path: {
      es: "admin/mensajes/:messageId/responder",
      en: "admin/messages/:messageId/answer",
    },
  },
  {
    id: "adminMessageArchive",
    file: "routes/panel/message-archive.tsx",
    path: {
      es: "admin/mensajes/:messageId/archivar",
      en: "admin/messages/:messageId/archive",
    },
  },
  {
    id: "adminMessageReopen",
    file: "routes/panel/message-reopen.tsx",
    path: {
      es: "admin/mensajes/:messageId/reabrir",
      en: "admin/messages/:messageId/reopen",
    },
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
    id: "adminFaqs",
    file: "routes/panel/faqs.tsx",
    path: { es: "admin/preguntas", en: "admin/faqs" },
  },
  {
    id: "adminFaqNew",
    file: "routes/panel/faq-new.tsx",
    path: { es: "admin/preguntas/nueva", en: "admin/faqs/new" },
  },
  {
    id: "adminFaq",
    file: "routes/panel/faq-edit.tsx",
    path: { es: "admin/preguntas/:faqId", en: "admin/faqs/:faqId" },
  },
  // Cada botón de la lista envía a la suya: una ruta, una acción.
  {
    id: "adminFaqPublish",
    file: "routes/panel/faq-publish.tsx",
    path: {
      es: "admin/preguntas/:faqId/publicar",
      en: "admin/faqs/:faqId/publish",
    },
  },
  {
    id: "adminFaqRetire",
    file: "routes/panel/faq-retire.tsx",
    path: {
      es: "admin/preguntas/:faqId/retirar",
      en: "admin/faqs/:faqId/retire",
    },
  },
  {
    id: "adminFaqMove",
    file: "routes/panel/faq-move.tsx",
    path: { es: "admin/preguntas/:faqId/mover", en: "admin/faqs/:faqId/move" },
  },
  {
    id: "adminMarkets",
    file: "routes/panel/markets.tsx",
    path: { es: "admin/mercados", en: "admin/markets" },
  },
  // Cada formulario de la pantalla envía a la suya: una ruta, una acción.
  {
    id: "adminMarketsLanguage",
    file: "routes/panel/markets-language.tsx",
    path: { es: "admin/mercados/idioma", en: "admin/markets/language" },
  },
  {
    id: "adminMarketsMarket",
    file: "routes/panel/markets-market.tsx",
    path: { es: "admin/mercados/mercado", en: "admin/markets/market" },
  },
  {
    id: "adminMarketsRate",
    file: "routes/panel/markets-rate.tsx",
    path: { es: "admin/mercados/tasa", en: "admin/markets/usd-rate" },
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
  {
    id: "adminTeam",
    file: "routes/panel/team.tsx",
    path: { es: "admin/equipo", en: "admin/team" },
  },
  {
    id: "adminTeamInvite",
    file: "routes/panel/team-invite.tsx",
    path: { es: "admin/equipo/invitar", en: "admin/team/invite" },
  },
  // Cada cambio sobre un miembro tiene su ruta: una ruta, una acción. La de
  // desactivar es además la confirmación.
  {
    id: "adminTeamRole",
    file: "routes/panel/team-role.tsx",
    path: {
      es: "admin/equipo/:memberId/rol",
      en: "admin/team/:memberId/role",
    },
  },
  {
    id: "adminTeamDeactivate",
    file: "routes/panel/team-deactivate.tsx",
    path: {
      es: "admin/equipo/:memberId/desactivar",
      en: "admin/team/:memberId/deactivate",
    },
  },
  {
    id: "adminTeamActivate",
    file: "routes/panel/team-activate.tsx",
    path: {
      es: "admin/equipo/:memberId/activar",
      en: "admin/team/:memberId/activate",
    },
  },
  {
    id: "adminAuditLog",
    file: "routes/panel/audit-log.tsx",
    path: { es: "admin/bitacora", en: "admin/audit-log" },
  },
  {
    id: "adminAuditLogEntry",
    file: "routes/panel/audit-log-entry.tsx",
    path: { es: "admin/bitacora/:id", en: "admin/audit-log/:id" },
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
export function getPanelPath(
  id: PanelPageId,
  language: Language,
  params?: PageParams,
): string {
  return buildPagePath(findPanelPage(id), findLanguage(language), params);
}

/** Dice si una dirección es del panel o cuelga de él, en cualquier idioma.
 * Va por segmento completo: `/administracion` no es del panel. */
export function isPanelPath(pathname: string): boolean {
  return SUPPORTED_LANGUAGES.some(({ code }) => {
    const home = getPanelPath("adminHome", code);
    return pathname === home || pathname.startsWith(`${home}/`);
  });
}
