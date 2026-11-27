// Los fallos del panel (#143): qué se pinta cuando un loader o un action
// lanza, y qué sigue pintándose como antes. Se monta el árbol de rutas del
// panel con sus layouts y límites reales y se renderiza como en el servidor.
import { renderToStaticMarkup } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  data,
  Outlet,
  RouterContextProvider,
  StaticRouterProvider,
  type MiddlewareFunction,
  type RouteObject,
  type StaticHandlerContext,
} from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReferenceCodeContext } from "~/lib/error-reference";
import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import { buildPanelNotFoundData } from "~/lib/panel/panel-not-found";
import {
  panelMemberContext,
  panelSessionContext,
  requirePanelMember,
} from "~/lib/panel/panel-middleware.server";
import type { PanelMember } from "~/lib/panel/visitor.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import {
  ADMIN_PROFILE,
  buildSessionCookie,
  stubSupabase,
} from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";
import MemberLayout, { loader as memberLoader } from "./member-layout";
import ShellLayout, { ErrorBoundary as ShellBoundary } from "./shell-layout";

const ADMIN: PanelMember = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  email: "andres@prueba.volleytip.test",
  fullName: "Andrés Gómez",
  role: "admin",
};
const REFERENCE = "ABC123";
const SECRET = "detalle interno de la base";

interface Scenario {
  readonly path: string;
  /** El patrón de la ruta, si no es la dirección tal cual. */
  readonly pattern?: string;
  readonly language?: Language;
  readonly method?: "GET" | "POST";
  readonly member?: PanelMember;
  readonly loader?: () => unknown;
  readonly action?: () => unknown;
  /** Con la guardia real delante, sin persona en el contexto. */
  readonly isGuarded?: boolean;
}

function fail(): never {
  throw new Error(SECRET);
}

function buildRoutes(scenario: Scenario): RouteObject[] {
  const page: RouteObject = {
    id: "page",
    path: scenario.pattern ?? scenario.path.split("?")[0],
    loader: scenario.loader ?? (() => null),
    action: scenario.action,
    Component: () => <p>pantalla</p>,
  };
  return [
    {
      id: "root",
      path: "/",
      loader: () => null,
      Component: Outlet,
      ErrorBoundary: () => <p>limite-de-la-raiz</p>,
      children: [
        {
          id: "routes/panel/member-layout",
          middleware: scenario.isGuarded
            ? [requirePanelMember as MiddlewareFunction]
            : [],
          loader: memberLoader,
          Component: MemberLayout as RouteObject["Component"],
          children: [
            {
              id: "routes/panel/shell-layout",
              Component: ShellLayout,
              ErrorBoundary: ShellBoundary,
              children: [page],
            },
          ],
        },
      ],
    },
  ];
}

function buildContext(
  scenario: Scenario,
  request: Request,
): RouterContextProvider {
  const context = new RouterContextProvider();
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  if (!scenario.isGuarded) {
    context.set(panelMemberContext, scenario.member ?? ADMIN);
  }
  return context;
}

async function visit(
  scenario: Scenario,
): Promise<{ status: number; html: string }> {
  const language = scenario.language ?? "es";
  const handler = createStaticHandler(buildRoutes(scenario));
  const request = new Request(`http://localhost${scenario.path}`, {
    method: scenario.method ?? "GET",
    headers: { Cookie: buildSessionCookie(TEST_ENV.SUPABASE_URL) },
    body: scenario.method === "POST" ? new URLSearchParams() : undefined,
  });
  let rendered: StaticHandlerContext | undefined;
  await handler.query(request, {
    requestContext: buildContext(scenario, request),
    generateMiddlewareResponse: async (query) => {
      const result = await query(request);
      if (!(result instanceof Response)) rendered = result;
      return new Response(null);
    },
  });
  if (rendered === undefined) throw new Error("No se esperaba una respuesta");
  const router = createStaticRouter(handler.dataRoutes, rendered);
  const html = renderToStaticMarkup(
    <ReferenceCodeContext value={() => REFERENCE}>
      <TranslationsProvider
        language={language}
        messages={getMessages(language)}
      >
        <StaticRouterProvider
          router={router}
          context={rendered}
          hydrate={false}
        />
      </TranslationsProvider>
    </ReferenceCodeContext>,
  );
  return { status: rendered.statusCode, html };
}

function expectShell(html: string): void {
  expect(html).toContain("data-panel-shell");
  expect(html).toContain('data-panel-region="sidebar-nav"');
  expect(html).toContain('data-panel-region="bottom-bar"');
  expect(html).toContain("<header");
  expect(html).toContain("Andrés Gómez");
}

function expectNoPanel(html: string): void {
  expect(html).not.toContain("data-panel-shell");
  expect(html).not.toContain("data-panel-region");
  expect(html).not.toContain("Andrés Gómez");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fallo inesperado en un action del panel", () => {
  it("responde 500 con la cáscara y el aviso de que no se guardó", async () => {
    stubSupabase({});

    const { status, html } = await visit({
      path: "/admin/textos/barra",
      method: "POST",
      action: fail,
    });

    expect(status).toBe(500);
    expectShell(html);
    expect(html).toContain('role="alert"');
    expect(html).toContain("El cambio no se pudo guardar");
    expect(html).toContain("quedó registrado");
    expect(html).toContain(REFERENCE);
    expect(html).not.toContain(SECRET);
    expect(html).not.toContain("limite-de-la-raiz");
  });

  it.each([
    ["/admin/textos/barra", "/admin/textos"],
    ["/admin/mercados/tasa", "/admin/mercados"],
    ["/admin/ajustes/mantenimiento", "/admin/ajustes"],
  ])("desde %s enlaza de vuelta a %s", async (path, back) => {
    stubSupabase({});

    const { html } = await visit({ path, method: "POST", action: fail });

    expect(html).toMatch(
      new RegExp(`href="${back}"[^>]*>Volver a la pantalla</a>`),
    );
  });
});

describe("fallo inesperado en un loader del panel", () => {
  it("responde 500 con la cáscara y la pantalla de fallo", async () => {
    stubSupabase({});

    const { status, html } = await visit({
      path: "/admin/mercados",
      loader: fail,
    });

    expect(status).toBe(500);
    expectShell(html);
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/href="\/admin\/mercados"[^>]*>Volver a la pantalla/);
    expect(html).not.toContain(SECRET);
  });

  it("conserva los filtros al volver a la pantalla", async () => {
    stubSupabase({});

    const { html } = await visit({
      path: "/admin/bitacora?pagina=2",
      loader: fail,
    });

    expect(html).toContain('href="/admin/bitacora?pagina=2"');
  });

  it("sin conexión no dice que el fallo quedó registrado", async () => {
    stubSupabase({});

    const { html } = await visit({
      path: "/admin/mercados",
      loader: () => {
        throw new TypeError("Failed to fetch");
      },
    });

    expectShell(html);
    expect(html).toContain("No hay conexión");
    expect(html).not.toContain("registrado");
    expect(html).not.toContain(REFERENCE);
  });

  it("al staff le muestra el fallo sin la cáscara", async () => {
    stubSupabase({});

    const { html } = await visit({
      path: "/admin",
      member: { ...ADMIN, role: "staff" },
      loader: fail,
    });

    expect(html).toContain("El cambio no se pudo guardar");
    expectNoPanel(html);
  });
});

describe("fallo del panel en inglés", () => {
  it("bajo /en/admin los textos y el enlace salen en inglés", async () => {
    stubSupabase({});

    const { html } = await visit({
      path: "/en/admin/site-texts/figures",
      language: "en",
      method: "POST",
      action: fail,
    });

    expect(html).toContain("Something went wrong");
    expect(html).toContain("The change could not be saved");
    expect(html).toContain("has been logged");
    expect(html).toMatch(
      /href="\/en\/admin\/site-texts"[^>]*>Back to the screen<\/a>/,
    );
  });
});

describe("404 y guardia del panel", () => {
  function notFound(): never {
    throw data(
      buildPanelNotFoundData({
        activeLanguages: ["es", "en"],
        messages: getMessages("es"),
        year: 2026,
        announcements: [],
        languageSuggestion: null,
      }),
      { status: 404 },
    );
  }

  it("el 404 de una pantalla sale como cualquier otro, sin la cáscara del panel", async () => {
    stubSupabase({});

    const { status, html } = await visit({
      path: "/admin/bitacora/9",
      loader: notFound,
    });

    expect(status).toBe(404);
    expect(html).toContain("Balón fuera");
    expectNoPanel(html);
    expect(html).not.toContain("no se pudo guardar");
  });

  it("otra respuesta de error conserva su estado y su página", async () => {
    stubSupabase({});

    const { status, html } = await visit({
      path: "/admin/mercados",
      method: "POST",
      action: () => {
        throw data(null, { status: 403 });
      },
    });

    expect(status).toBe(403);
    expect(html).toContain("No pudimos mostrar esta página");
    expectNoPanel(html);
  });
});

describe("fallos de un mensaje", () => {
  const message = {
    path: "/admin/mensajes/42",
    pattern: "/admin/mensajes/:messageId",
  } as const;

  it("un cambio que falló usa la pantalla del mensaje, dentro del panel", async () => {
    stubSupabase({});

    const { status, html } = await visit({
      ...message,
      method: "POST",
      action: fail,
    });

    expect(status).toBe(500);
    expectShell(html);
    expect(html).toContain("el mensaje no se pudo cargar");
    expect(html).toContain('href="/admin/mensajes/42"');
  });

  it("un mensaje que no existe lo dice dentro del panel", async () => {
    stubSupabase({});

    const { status, html } = await visit({
      ...message,
      loader: () => {
        throw data(null, { status: 404 });
      },
    });

    expect(status).toBe(404);
    expectShell(html);
    expect(html).toContain("Ese mensaje no existe");
  });

  it.each([
    ["el 403 del origen", 403, null, "No pudimos mostrar esta página"],
    [
      "el 404 del panel",
      404,
      buildPanelNotFoundData({
        activeLanguages: ["es", "en"],
        messages: getMessages("es"),
        year: 2026,
        announcements: [],
        languageSuggestion: null,
      }),
      "Balón fuera",
    ],
  ])(
    "%s sale como siempre, sin la cáscara",
    async (_case, code, body, title) => {
      stubSupabase({});

      const { status, html } = await visit({
        ...message,
        method: "POST",
        action: () => {
          throw data(body, { status: code });
        },
      });

      expect(status).toBe(code);
      expect(html).toContain(title);
      expectNoPanel(html);
    },
  );
});

describe("quien no es del equipo", () => {
  it("recibe el 404 de la guardia aunque la pantalla fuera a fallar", async () => {
    stubSupabase({ profile: { ...ADMIN_PROFILE, role: "buyer" } });
    const loader = vi.fn(fail);

    const { status, html } = await visit({
      path: "/admin/mercados",
      isGuarded: true,
      loader,
    });

    expect(status).toBe(404);
    expect(loader).not.toHaveBeenCalled();
    expectNoPanel(html);
  });

  it("si la guardia misma falla, no ve la cáscara", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(null, { status: 500 })),
    );

    const { status, html } = await visit({
      path: "/admin/mercados",
      isGuarded: true,
    });

    expect(status).toBe(500);
    expect(html).toContain("limite-de-la-raiz");
    expectNoPanel(html);
  });
});
