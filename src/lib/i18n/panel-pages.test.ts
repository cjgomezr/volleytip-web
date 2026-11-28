import type { RouteConfigEntry } from "@react-router/dev/routes";
import { describe, expect, it } from "vitest";

import routes from "../../routes";
import { getPageAtPath, PAGES } from "./pages";
import { getPanelPath, isPanelPath } from "./panel-pages";

function flatten(entries: readonly RouteConfigEntry[]): RouteConfigEntry[] {
  return entries.flatMap((entry) => [entry, ...flatten(entry.children ?? [])]);
}

function pathsInside(file: string): string[] {
  const layout = flatten(routes).find((entry) => entry.file === file);
  if (layout === undefined) throw new Error(`No hay una ruta con ${file}`);
  return flatten(layout.children ?? [])
    .flatMap((entry) => (entry.path === undefined ? [] : [entry.path]))
    .sort();
}

describe("direcciones del panel", () => {
  it.each([
    ["adminHome", "/admin", "/en/admin"],
    ["adminSignIn", "/admin/entrar", "/en/admin/sign-in"],
    ["adminSignInLink", "/admin/entrar/enlace", "/en/admin/sign-in/link"],
    ["adminSignInGoogle", "/admin/entrar/google", "/en/admin/sign-in/google"],
    [
      "adminSignInGoogleReturn",
      "/admin/entrar/google/vuelta",
      "/en/admin/sign-in/google/return",
    ],
    ["adminSignOut", "/admin/salir", "/en/admin/sign-out"],
    ["adminMore", "/admin/mas", "/en/admin/more"],
    ["adminLanguage", "/admin/idioma", "/en/admin/language"],
    ["adminSettings", "/admin/ajustes", "/en/admin/settings"],
    ["adminMessages", "/admin/mensajes", "/en/admin/messages"],
    ["adminAuditLog", "/admin/bitacora", "/en/admin/audit-log"],
    ["adminFaqs", "/admin/preguntas", "/en/admin/faqs"],
    ["adminFaqNew", "/admin/preguntas/nueva", "/en/admin/faqs/new"],
    [
      "adminSettingsMaintenance",
      "/admin/ajustes/mantenimiento",
      "/en/admin/settings/maintenance",
    ],
  ] as const)("%s vive en %s y %s", (page, spanish, english) => {
    expect(getPanelPath(page, "es")).toBe(spanish);
    expect(getPanelPath(page, "en")).toBe(english);
  });

  it.each(["/admin", "/admin/", "/admin/a/b", "/en/admin", "/en/admin/x"])(
    "%s es del panel",
    (path) => {
      expect(isPanelPath(path)).toBe(true);
    },
  );

  it.each(["/", "/administracion", "/en/administration", "/es/admin"])(
    "%s no es del panel",
    (path) => {
      expect(isPanelPath(path)).toBe(false);
    },
  );
});

describe("rutas del panel", () => {
  it("van fuera de la cáscara del sitio", () => {
    expect(
      pathsInside("routes/site-layout.tsx").filter((path) =>
        path.includes("admin"),
      ),
    ).toEqual([]);
  });

  it("todas pasan por la sesión del panel, en los dos idiomas", () => {
    expect(pathsInside("routes/panel/session-layout.tsx")).toEqual([
      "admin",
      "admin/*",
      "admin/ajustes",
      "admin/ajustes/mantenimiento",
      "admin/bitacora",
      "admin/bitacora/:id",
      "admin/entrar",
      "admin/entrar/enlace",
      "admin/entrar/google",
      "admin/entrar/google/vuelta",
      "admin/idioma",
      "admin/mas",
      "admin/mensajes",
      "admin/mensajes/:messageId",
      "admin/mensajes/:messageId/archivar",
      "admin/mensajes/:messageId/reabrir",
      "admin/mensajes/:messageId/responder",
      "admin/mercados",
      "admin/mercados/idioma",
      "admin/mercados/mercado",
      "admin/mercados/tasa",
      "admin/preguntas",
      "admin/preguntas/:faqId",
      "admin/preguntas/:faqId/mover",
      "admin/preguntas/:faqId/publicar",
      "admin/preguntas/:faqId/retirar",
      "admin/preguntas/nueva",
      "admin/salir",
      "admin/textos",
      "admin/textos/barra",
      "admin/textos/cifras",
      "en/admin",
      "en/admin/*",
      "en/admin/audit-log",
      "en/admin/audit-log/:id",
      "en/admin/faqs",
      "en/admin/faqs/:faqId",
      "en/admin/faqs/:faqId/move",
      "en/admin/faqs/:faqId/publish",
      "en/admin/faqs/:faqId/retire",
      "en/admin/faqs/new",
      "en/admin/language",
      "en/admin/markets",
      "en/admin/markets/language",
      "en/admin/markets/market",
      "en/admin/markets/usd-rate",
      "en/admin/messages",
      "en/admin/messages/:messageId",
      "en/admin/messages/:messageId/answer",
      "en/admin/messages/:messageId/archive",
      "en/admin/messages/:messageId/reopen",
      "en/admin/more",
      "en/admin/settings",
      "en/admin/settings/maintenance",
      "en/admin/sign-in",
      "en/admin/sign-in/google",
      "en/admin/sign-in/google/return",
      "en/admin/sign-in/link",
      "en/admin/sign-out",
      "en/admin/site-texts",
      "en/admin/site-texts/announcements",
      "en/admin/site-texts/figures",
    ]);
  });

  it("solo la entrada queda fuera de la guardia", () => {
    expect(pathsInside("routes/panel/member-layout.tsx")).toEqual([
      "admin",
      "admin/*",
      "admin/ajustes",
      "admin/ajustes/mantenimiento",
      "admin/bitacora",
      "admin/bitacora/:id",
      "admin/idioma",
      "admin/mas",
      "admin/mensajes",
      "admin/mensajes/:messageId",
      "admin/mensajes/:messageId/archivar",
      "admin/mensajes/:messageId/reabrir",
      "admin/mensajes/:messageId/responder",
      "admin/mercados",
      "admin/mercados/idioma",
      "admin/mercados/mercado",
      "admin/mercados/tasa",
      "admin/preguntas",
      "admin/preguntas/:faqId",
      "admin/preguntas/:faqId/mover",
      "admin/preguntas/:faqId/publicar",
      "admin/preguntas/:faqId/retirar",
      "admin/preguntas/nueva",
      "admin/salir",
      "admin/textos",
      "admin/textos/barra",
      "admin/textos/cifras",
      "en/admin",
      "en/admin/*",
      "en/admin/audit-log",
      "en/admin/audit-log/:id",
      "en/admin/faqs",
      "en/admin/faqs/:faqId",
      "en/admin/faqs/:faqId/move",
      "en/admin/faqs/:faqId/publish",
      "en/admin/faqs/:faqId/retire",
      "en/admin/faqs/new",
      "en/admin/language",
      "en/admin/markets",
      "en/admin/markets/language",
      "en/admin/markets/market",
      "en/admin/markets/usd-rate",
      "en/admin/messages",
      "en/admin/messages/:messageId",
      "en/admin/messages/:messageId/answer",
      "en/admin/messages/:messageId/archive",
      "en/admin/messages/:messageId/reopen",
      "en/admin/more",
      "en/admin/settings",
      "en/admin/settings/maintenance",
      "en/admin/sign-out",
      "en/admin/site-texts",
      "en/admin/site-texts/announcements",
      "en/admin/site-texts/figures",
    ]);
  });

  it("lo que cuelga del panel es solo de admin", () => {
    expect(pathsInside("routes/panel/admin-layout.tsx")).toEqual([
      "admin/*",
      "admin/ajustes",
      "admin/ajustes/mantenimiento",
      "admin/bitacora",
      "admin/bitacora/:id",
      "admin/idioma",
      "admin/mas",
      "admin/mensajes",
      "admin/mensajes/:messageId",
      "admin/mensajes/:messageId/archivar",
      "admin/mensajes/:messageId/reabrir",
      "admin/mensajes/:messageId/responder",
      "admin/mercados",
      "admin/mercados/idioma",
      "admin/mercados/mercado",
      "admin/mercados/tasa",
      "admin/preguntas",
      "admin/preguntas/:faqId",
      "admin/preguntas/:faqId/mover",
      "admin/preguntas/:faqId/publicar",
      "admin/preguntas/:faqId/retirar",
      "admin/preguntas/nueva",
      "admin/textos",
      "admin/textos/barra",
      "admin/textos/cifras",
      "en/admin/*",
      "en/admin/audit-log",
      "en/admin/audit-log/:id",
      "en/admin/faqs",
      "en/admin/faqs/:faqId",
      "en/admin/faqs/:faqId/move",
      "en/admin/faqs/:faqId/publish",
      "en/admin/faqs/:faqId/retire",
      "en/admin/faqs/new",
      "en/admin/language",
      "en/admin/markets",
      "en/admin/markets/language",
      "en/admin/markets/market",
      "en/admin/markets/usd-rate",
      "en/admin/messages",
      "en/admin/messages/:messageId",
      "en/admin/messages/:messageId/answer",
      "en/admin/messages/:messageId/archive",
      "en/admin/messages/:messageId/reopen",
      "en/admin/more",
      "en/admin/settings",
      "en/admin/settings/maintenance",
      "en/admin/site-texts",
      "en/admin/site-texts/announcements",
      "en/admin/site-texts/figures",
    ]);
  });

  it("no están en el mapa de páginas del que saldrá el sitemap", () => {
    expect(PAGES.filter(({ id }) => id.startsWith("admin"))).toEqual([]);
    expect(getPageAtPath("/admin")).toBeUndefined();
    expect(getPageAtPath("/en/admin/sign-in")).toBeUndefined();
  });
});
