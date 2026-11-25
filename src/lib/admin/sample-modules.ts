import type { PageDeclaration } from "../i18n/page-path";
import type { MessageKey } from "../i18n/translate";
import { defineModules, type AdminModule } from "./modules";

// Los módulos de la página de muestra (/dev/panel): el menú que tendrá el
// panel cuando existan las demás secciones (RF-6 del PRD de W10a). Sirven
// para ver la cáscara llena. El panel real no los usa.
const SAMPLE_ROUTE_FILE = "routes/dev-panel.tsx";

interface SectionPaths {
  readonly es: string;
  readonly en: string;
}

function samplePage(id: string, path: SectionPaths): PageDeclaration {
  return { id, file: SAMPLE_ROUTE_FILE, path: { ...path } };
}

/** La pantalla "Más" de la muestra. */
export const SAMPLE_MORE_PAGE = samplePage("sample-more", {
  es: "dev/panel/mas",
  en: "dev/panel/more",
});

function sampleModule(
  name: string,
  labelKey: MessageKey,
  path: SectionPaths,
): AdminModule {
  const id = `sample-${name}`;
  return {
    id,
    page: samplePage(id, path),
    labelKey,
    requiredRole: "admin",
  };
}

export const SAMPLE_MODULES = defineModules([
  {
    ...sampleModule("overview", "panel.module.overview", {
      es: "dev/panel",
      en: "dev/panel",
    }),
    bottomBar: { glyph: "⌂" },
  },
  {
    ...sampleModule("messages", "panel.sample.messages", {
      es: "dev/panel/mensajes",
      en: "dev/panel/messages",
    }),
    bottomBar: { glyph: "✉" },
    hasPendingCounter: true,
  },
  sampleModule("site-texts", "panel.sample.siteTexts", {
    es: "dev/panel/textos",
    en: "dev/panel/site-texts",
  }),
  sampleModule("faqs", "panel.sample.faqs", {
    es: "dev/panel/preguntas",
    en: "dev/panel/faqs",
  }),
  sampleModule("markets", "panel.sample.markets", {
    es: "dev/panel/mercados",
    en: "dev/panel/markets",
  }),
  sampleModule("settings", "panel.sample.settings", {
    es: "dev/panel/ajustes",
    en: "dev/panel/settings",
  }),
  sampleModule("team", "panel.sample.team", {
    es: "dev/panel/equipo",
    en: "dev/panel/team",
  }),
  sampleModule("audit-log", "panel.sample.auditLog", {
    es: "dev/panel/bitacora",
    en: "dev/panel/audit-log",
  }),
]);
