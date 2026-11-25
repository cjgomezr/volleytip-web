import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import {
  panelMemberContext,
  panelSessionContext,
} from "~/lib/panel/panel-middleware.server";
import type { PanelMember } from "~/lib/panel/visitor.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import {
  ADMIN_PROFILE,
  buildSessionCookie,
  stubSupabase,
} from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";
import { HomeScreen, loader as homeLoader } from "./home";
import { loader as missingLoader } from "./missing";
import SessionLayout from "./session-layout";
import {
  shouldRevalidate,
  loader as signInLoader,
  SignInScreen,
} from "./sign-in";
import { action as signOut, loader as signOutLoader } from "./sign-out";

const ADMIN: PanelMember = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  email: "andres@prueba.volleytip.test",
  fullName: "Andrés Gómez",
  role: "admin",
};

const SIGNED_IN = buildSessionCookie(TEST_ENV.SUPABASE_URL);

function buildArgs<Args>(
  path: string,
  options: { member?: PanelMember; cookie?: string } = {},
): Args {
  const request = new Request(`http://localhost${path}`, {
    headers: options.cookie === undefined ? {} : { Cookie: options.cookie },
  });
  const context = new RouterContextProvider();
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  if (options.member) context.set(panelMemberContext, options.member);
  return { request, context, params: {} } as unknown as Args;
}

function render(element: ReactElement, language: Language = "es"): string {
  const path = getPanelPath("adminHome", language);
  const Stub = createRoutesStub([
    {
      path,
      Component: () => (
        <TranslationsProvider
          language={language}
          messages={getMessages(language)}
        >
          {element}
        </TranslationsProvider>
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={[path]} />);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("inicio del panel", () => {
  // El nombre, el rol y "Cerrar sesión" del admin los pone la cáscara
  // (panel-shell.test.tsx y panel-layout.test.ts).
  it("al admin le muestra el Resumen provisional", () => {
    const data = homeLoader(buildArgs("/admin", { member: ADMIN }));

    expect(data).toEqual({ view: "admin" });
    const html = render(<HomeScreen {...data} />);
    expect(html).toContain("<title>Resumen</title>");
    expect(html).toContain("Las secciones del panel llegan pronto.");
  });

  it("al staff solo le explica que su acceso es para el escáner", () => {
    const data = homeLoader(
      buildArgs("/admin", { member: { ...ADMIN, role: "staff" } }),
    );

    expect(data).toEqual({ view: "staff" });
    const html = render(<HomeScreen {...data} />);
    expect(html).toContain("escáner");
    expect(html).toContain("camp");
    expect(html).toContain("Cerrar sesión");
    expect(html).toContain('action="/admin/salir"');
    expect(html).not.toContain("Andrés Gómez");
  });

  it("sale en inglés bajo /en/", () => {
    const html = render(<HomeScreen view="staff" />, "en");

    expect(html).toContain("Sign out");
    expect(html).toContain('action="/en/admin/sign-out"');
  });
});

describe("pantalla de entrada", () => {
  it("responde sin sesión", async () => {
    stubSupabase();

    const data = await signInLoader(buildArgs("/admin/entrar"));

    expect(data.protection.timestamp).not.toBe("");
    const html = render(<SignInScreen {...data} outcome={undefined} />);
    expect(html).toContain("<title>Entrar al panel</title>");
    expect(html).toMatch(/<h1[^>]*>Entrar</);
  });

  it("existe en los dos idiomas, igual que la página del enlace", () => {
    expect(getPanelPath("adminSignIn", "es")).toBe("/admin/entrar");
    expect(getPanelPath("adminSignIn", "en")).toBe("/en/admin/sign-in");
    expect(getPanelPath("adminSignInLink", "es")).toBe("/admin/entrar/enlace");
    expect(getPanelPath("adminSignInLink", "en")).toBe(
      "/en/admin/sign-in/link",
    );
  });

  it.each([
    ["/admin/entrar", "/admin"],
    ["/en/admin/sign-in", "/en/admin"],
    ["/admin/entrar?next=%2Fadmin%2Fmensajes", "/admin/mensajes"],
    ["/admin/entrar?next=https%3A%2F%2Fsitio-ajeno.test", "/admin"],
    ["/en/admin/sign-in?next=%2Fcontacto", "/en/admin"],
  ])("con sesión de admin, %s redirige a %s", async (path, destination) => {
    stubSupabase();

    const thrown: unknown = await signInLoader(
      buildArgs(path, { cookie: SIGNED_IN }),
    ).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).headers.get("Location")).toBe(destination);
  });

  it.each([
    ["un buyer", { ...ADMIN_PROFILE, role: "buyer" as const }],
    ["un admin desactivado", { ...ADMIN_PROFILE, is_active: false }],
  ])("a %s le muestra la entrada, sin redirigir", async (_name, profile) => {
    stubSupabase({ profile });

    await expect(
      signInLoader(buildArgs("/admin/entrar", { cookie: SIGNED_IN })),
    ).resolves.toHaveProperty("protection");
  });
});

describe("pantalla de entrada: formulario vencido", () => {
  it.each([
    [{ status: "rejected", reason: "too_fast" }, true],
    [{ status: "rejected", reason: "rate_limited" }, false],
    [{ status: "invalid" }, false],
  ])("tras %j pide un formulario fresco: %s", (actionResult, expected) => {
    const args = { actionResult, defaultShouldRevalidate: false };

    expect(
      shouldRevalidate(args as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(expected);
  });
});

describe("cerrar sesión", () => {
  it.each([
    ["/admin/salir", "/admin/entrar"],
    ["/en/admin/sign-out", "/en/admin/sign-in"],
  ])("desde %s invalida la sesión y lleva a %s", async (path, destination) => {
    const supabase = stubSupabase();

    const response = await signOut(buildArgs(path, { cookie: SIGNED_IN }));

    expect(supabase.requests).toContain("POST /auth/v1/logout?scope=local");
    expect(response.headers.get("Location")).toBe(destination);
  });

  it("no da por cerrada una sesión que Supabase no pudo cerrar", async () => {
    stubSupabase({ authFailureStatus: 500 });

    await expect(
      signOut(buildArgs("/admin/salir", { cookie: SIGNED_IN })),
    ).rejects.toThrow(/cerrar la sesión/);
  });

  it("abrir la dirección sin enviar nada lleva al inicio del panel", () => {
    const response = signOutLoader(buildArgs("/en/admin/sign-out"));

    expect(response.headers.get("Location")).toBe("/en/admin");
  });
});

describe("dirección del panel que no existe", () => {
  it("responde 404 con la página de siempre", async () => {
    stubSupabase();

    const thrown: unknown = await missingLoader(
      buildArgs("/admin/no-existe"),
    ).catch((error: unknown) => error);

    expect(thrown).toMatchObject({
      data: { kind: "panel-not-found" },
      init: { status: 404 },
    });
  });
});

describe("404 del panel: aviso de idioma", () => {
  it("propone el idioma del navegador, como el 404 del sitio", async () => {
    stubSupabase();
    const args = buildArgs<Parameters<typeof missingLoader>[0]>("/admin/x");
    args.request.headers.set("Accept-Language", "en-US");
    args.request.headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0)");

    const thrown: unknown = await missingLoader(args).catch(
      (error: unknown) => error,
    );

    expect(thrown).toMatchObject({
      data: { languageSuggestion: { proposed: "en", pageLanguage: "es" } },
    });
  });
});

describe("noindex del panel", () => {
  it("lo declara en todas sus páginas", () => {
    const Stub = createRoutesStub([{ path: "/", Component: SessionLayout }]);

    expect(renderToStaticMarkup(<Stub />)).toContain(
      '<meta name="robots" content="noindex, nofollow"/>',
    );
  });
});
