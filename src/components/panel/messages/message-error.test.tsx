import { renderToStaticMarkup } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  data,
  StaticRouterProvider,
} from "react-router";
import { describe, expect, it } from "vitest";

import { ReferenceCodeContext } from "~/lib/error-reference";
import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { MessageErrorBoundary } from "./message-error";

const ID = "0b7c1f9e-3f0a-4c1e-9a7d-2f4b6c8d0e12";
const REFERENCE = "ABC123";

/** Pinta la ruta de un mensaje cuyo loader lanza `thrown`. */
async function renderFailure(
  thrown: unknown,
  language: Language = "es",
): Promise<string> {
  const path = language === "es" ? "admin/mensajes" : "en/admin/messages";
  const routes = [
    {
      path: `/${path}/:messageId`,
      loader: () => {
        throw thrown;
      },
      Component: () => null,
      ErrorBoundary: MessageErrorBoundary,
    },
  ];
  const handler = createStaticHandler(routes);
  const context = await handler.query(
    new Request(`http://localhost/${path}/${ID}`),
  );
  if (context instanceof Response) throw new Error("No se esperaba respuesta");
  const router = createStaticRouter(handler.dataRoutes, context);
  return renderToStaticMarkup(
    <ReferenceCodeContext value={() => REFERENCE}>
      <TranslationsProvider
        language={language}
        messages={getMessages(language)}
      >
        <StaticRouterProvider
          router={router}
          context={context}
          hydrate={false}
        />
      </TranslationsProvider>
    </ReferenceCodeContext>,
  );
}

describe("bandeja: errores de un mensaje", () => {
  it("un mensaje que no existe lo dice y solo lleva a la bandeja", async () => {
    const html = await renderFailure(data(null, { status: 404 }));

    expect(html).toContain("Ese mensaje no existe");
    expect(html).toContain('href="/admin/mensajes"');
    expect(html).not.toContain(`href="/admin/mensajes/${ID}"`);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(REFERENCE);
  });

  it.each([
    ["es", "Algo falló", `/admin/mensajes/${ID}`],
    ["en", "Something went wrong", `/en/admin/messages/${ID}`],
  ] as const)(
    "un cambio que falló lo avisa, vuelve al mensaje y da el código (%s)",
    async (language, title, href) => {
      const html = await renderFailure(new Error("bitácora caída"), language);

      expect(html).toContain(title);
      expect(html).toContain('role="alert"');
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain(REFERENCE);
      expect(html).not.toContain("bitácora caída");
    },
  );
});
