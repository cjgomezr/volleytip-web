/**
 * Un idioma desactivado desde el panel (#128): el sitio deja de ofrecerlo y
 * sus páginas responden como las de un prefijo que el sitio no sirve, con el
 * 404 en el idioma por defecto (RF-1 del PRD de W2). El panel sigue en los
 * dos idiomas.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createStaticHandler,
  MemoryRouter,
  RouterContextProvider,
  type MiddlewareFunction,
} from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LanguageAlternates } from "~/components/language-alternates";
import { LanguageSwitcher } from "~/components/language-switcher";
import { activeLanguagesContext } from "~/lib/active-languages.server";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import { enforceSiteAvailability } from "~/lib/language-middleware.server";
import { buildPanelNotFound } from "~/lib/panel/panel-not-found.server";
import { useLanguage } from "~/lib/i18n/use-language";
import { ErrorBoundary, middleware as rootMiddleware } from "~/root";
import { action as chooseLanguage } from "~/routes/language-choice";
import { stubMarketsApi } from "~/testing/fake-markets-api";
import { ENGLISH_ROW, SPANISH_ROW } from "~/testing/fake-markets-api";

import { ActiveLanguagesProvider } from "./active-languages-context";
import { getServedLanguage, type ActiveLanguages } from "./active-languages";
import { readDocumentLanguages } from "./document-languages";
import { buildInactiveLanguageData } from "./inactive-language-not-found";
import {
  getLanguageProposal,
  redirectRootToChosenLanguage,
} from "./language-choice.server";

const ONLY_SPANISH: ActiveLanguages = ["es"];
const BOTH: ActiveLanguages = ["es", "en"];
const BROWSER = "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0 Safari/537.36";

// La fila apagada la oculta RLS a un anónimo: la base de mentira, igual.
function stubEnglishOff(): void {
  stubMarketsApi({ languages: [SPANISH_ROW] });
}

function visitorRequest(
  path: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, {
    headers: { "User-Agent": BROWSER, ...headers },
  });
}

async function runMiddleware(
  path: string,
  method = "GET",
): Promise<{ thrown: unknown; active: ActiveLanguages }> {
  const context = new RouterContextProvider();
  const request = new Request(`http://localhost${path}`, { method });
  let thrown: unknown;
  try {
    await enforceSiteAvailability({ request, context });
  } catch (error) {
    thrown = error;
  }
  return { thrown, active: context.get(activeLanguagesContext) };
}

function renderAt(
  path: string,
  active: ActiveLanguages,
  element: ReactElement,
): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <ActiveLanguagesProvider languages={active}>
        <TranslationsProvider language="es" messages={getMessages("es")}>
          {element}
        </TranslationsProvider>
      </ActiveLanguagesProvider>
    </MemoryRouter>,
  );
}

function CurrentLanguage(): ReactElement {
  return <p>{useLanguage()}</p>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("idiomas: el sitio con un idioma desactivado", () => {
  it.each(["/en", "/en/", "/en/contact", "/en/no-existe", "/en/_.data"])(
    "%s responde 404 con los textos en español",
    async (path) => {
      stubEnglishOff();

      const { thrown } = await runMiddleware(path);

      expect(thrown).toMatchObject({
        init: { status: 404 },
        data: {
          kind: "inactive-language",
          activeLanguages: ["es"],
          messages: getMessages("es"),
        },
      });
    },
  );

  it("tampoco recibe envíos", async () => {
    stubEnglishOff();

    const { thrown } = await runMiddleware("/en/contact", "POST");

    expect(thrown).toMatchObject({ init: { status: 404 } });
  });

  it.each(["/", "/contacto", "/es-algo", "/EN/"])(
    "%s sigue su camino y sabe qué idiomas hay",
    async (path) => {
      stubEnglishOff();

      const result = await runMiddleware(path);

      expect(result).toEqual({ thrown: undefined, active: ["es"] });
    },
  );

  it.each(["/en/admin", "/en/admin/markets", "/admin"])(
    "el panel en %s no se entera",
    async (path) => {
      stubEnglishOff();

      const { thrown, active } = await runMiddleware(path);

      expect(thrown).toBeUndefined();
      expect(active).toEqual(BOTH);
    },
  );

  it("con el idioma activo la página en inglés se sirve", async () => {
    stubMarketsApi({ languages: [SPANISH_ROW, ENGLISH_ROW] });

    const { thrown, active } = await runMiddleware("/en/contact");

    expect(thrown).toBeUndefined();
    expect(active).toEqual(BOTH);
  });

  it("si la base falla, el sitio sirve todos sus idiomas y lo registra", async () => {
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ message: "caída" }, { status: 500 })),
    );

    const { thrown, active } = await runMiddleware("/en/contact");

    expect(thrown).toBeUndefined();
    expect(active).toEqual(BOTH);
    expect(logged).toHaveBeenCalledWith(
      "No se pudieron leer los idiomas activos",
      expect.any(Error),
    );
  });

  it("la dirección de un idioma apagado cuenta como del idioma por defecto", () => {
    expect(getServedLanguage("/en/contact", ONLY_SPANISH)).toBe("es");
    expect(getServedLanguage("/en/contact", BOTH)).toBe("en");
    expect(getServedLanguage("/en/admin", ONLY_SPANISH)).toBe("en");
    expect(
      renderAt("/en/contact", ONLY_SPANISH, <CurrentLanguage />),
    ).toContain("<p>es</p>");
  });

  it("el selector deja de ofrecerlo", () => {
    const html = renderAt("/contacto", ONLY_SPANISH, <LanguageSwitcher />);

    expect(html).toContain('hrefLang="es"');
    expect(html).not.toContain('hrefLang="en"');
  });

  it("las páginas no lo declaran a los buscadores", () => {
    const html = renderAt(
      "/contacto",
      ONLY_SPANISH,
      <LanguageAlternates siteOrigin="https://volleytip.test" />,
    );

    expect(html).toContain('hrefLang="es"');
    expect(html).toContain('hrefLang="x-default"');
    expect(html).not.toContain('hrefLang="en"');
  });

  it("no se le propone a quien tiene el navegador en ese idioma", async () => {
    const request = visitorRequest("/", { "Accept-Language": "en-US" });

    await expect(getLanguageProposal(request, ONLY_SPANISH)).resolves.toBe(
      undefined,
    );
    await expect(getLanguageProposal(request, BOTH)).resolves.toBe("en");
  });

  it("la raíz no lleva a quien lo tenía elegido", async () => {
    const request = visitorRequest("/", { Cookie: await englishCookie() });

    await expect(
      redirectRootToChosenLanguage(request, ONLY_SPANISH),
    ).resolves.toBeNull();
  });

  it("no se puede elegir", async () => {
    const context = new RouterContextProvider();
    context.set(activeLanguagesContext, ONLY_SPANISH);
    const request = new Request("http://localhost/idioma", {
      method: "POST",
      body: new URLSearchParams({ language: "en", from: "/contacto" }),
    });

    const response = await chooseLanguage({
      request,
      context,
      params: {},
    } as unknown as Parameters<typeof chooseLanguage>[0]);

    expect(response.status).toBe(400);
  });

  it.each(["/en/admin", "/en/admin/no-existe"])(
    "el 404 del panel en %s es el mismo de cualquier página de ese idioma",
    async (path) => {
      stubEnglishOff();
      const request = visitorRequest(path, { "Accept-Language": "es" });

      const panel = await buildPanelNotFound(request);
      const { thrown } = await runMiddleware("/en/no-existe");

      expect(panel).toEqual(thrown);
    },
  );

  it("ese 404 se pinta en español también bajo la dirección del panel", () => {
    const languages = readDocumentLanguages({
      pathname: "/en/admin",
      error: {
        status: 404,
        statusText: "",
        internal: false,
        data: buildInactiveLanguageData({
          activeLanguages: ONLY_SPANISH,
          messages: getMessages("es"),
          year: 2026,
          announcements: [],
        }),
      },
      rootLanguages: undefined,
    });
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/en/admin"]}>
        <ActiveLanguagesProvider
          languages={languages.activeLanguages}
          forcedLanguage={languages.forcedLanguage}
        >
          <CurrentLanguage />
        </ActiveLanguagesProvider>
      </MemoryRouter>,
    );

    expect(languages.language).toBe("es");
    expect(html).toContain("<p>es</p>");
  });

  it.each(["/en/contact", "/en/_.data"])(
    "el 404 de %s pide a los buscadores no indexarlo",
    async (path) => {
      stubEnglishOff();
      const handler = createStaticHandler([
        {
          id: "root",
          path: "*",
          middleware: rootMiddleware as unknown as MiddlewareFunction[],
          loader: () => null,
        },
      ]);

      const response = (await handler.query(
        new Request(`http://localhost${path}`),
        {
          requestContext: new RouterContextProvider(),
          generateMiddlewareResponse: async (query) => {
            const result = await query(new Request(`http://localhost${path}`));
            const status = "statusCode" in result ? result.statusCode : 200;
            return new Response(null, { status });
          },
        },
      )) as Response;

      expect(response.status).toBe(404);
      expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    },
  );

  it("la página del 404 sale en español y sin enlaces a ese idioma", async () => {
    stubEnglishOff();
    const { thrown } = await runMiddleware("/en/contact");
    const { data } = thrown as { data: unknown };
    const props = {
      error: { status: 404, statusText: "", internal: false, data },
      params: {},
    } as unknown as Parameters<typeof ErrorBoundary>[0];

    const html = renderAt(
      "/en/contact",
      ONLY_SPANISH,
      <ErrorBoundary {...props} />,
    );

    expect(html).toContain("Balón fuera");
    expect(html).not.toContain('href="/en');
  });
});

async function englishCookie(): Promise<string> {
  const { serializeLanguageChoice } = await import("./language-choice.server");
  const cookie = await serializeLanguageChoice("en", "test");
  return cookie.split(";")[0] ?? "";
}
