import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { SignInForm } from "./sign-in-form";
import { SignInLinkScreen } from "./sign-in-link-screen";

const PROTECTION = { siteKey: "llave", timestamp: "marca" };

function render(element: ReactElement, language: Language = "es"): string {
  const Stub = createRoutesStub([
    {
      path: "/",
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
  return renderToStaticMarkup(<Stub initialEntries={["/"]} />);
}

describe("pantalla de entrada: formulario", () => {
  it("pide el correo, con la protección y sin botón de Google", () => {
    const html = render(
      <SignInForm protection={PROTECTION} outcome={undefined} />,
    );

    expect(html).toContain('name="email"');
    expect(html).toContain('value="marca"');
    expect(html).toContain("Enviarme el enlace");
    expect(html).not.toContain("Google");
  });

  it("enviado, pide revisar el correo en una región de estado", () => {
    const html = render(
      <SignInForm protection={PROTECTION} outcome={{ status: "sent" }} />,
    );

    expect(html).toMatch(/role="status".*Revisa tu correo/);
    expect(html).not.toContain('name="email"');
  });

  it("marca el error junto al campo y conserva lo escrito", () => {
    const html = render(
      <SignInForm
        protection={PROTECTION}
        outcome={{
          status: "invalid",
          fieldErrors: { email: "panel.signIn.error.email" },
          values: { email: "ana@" },
        }}
      />,
    );

    expect(html).toContain('value="ana@"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Escribe un correo válido.");
  });

  it.each([
    ["rate_limited", "Demasiados intentos"],
    ["too_fast", "demasiado rápido"],
    ["verification_failed", "No pudimos verificar"],
  ] as const)("un rechazo %s se explica en una alerta", (reason, text) => {
    const html = render(
      <SignInForm
        protection={PROTECTION}
        outcome={{ status: "rejected", reason }}
      />,
    );

    expect(html).toMatch(new RegExp(`role="alert"[^<]*>[^<]*${text}`));
  });

  it("si no se pudo enviar, lo dice y conserva el correo", () => {
    const html = render(
      <SignInForm
        protection={PROTECTION}
        outcome={{ status: "unavailable", values: { email: "a@b.co" } }}
      />,
    );

    expect(html).toContain("No se pudo enviar el enlace");
    expect(html).toContain("más tarde");
    expect(html).toContain('value="a@b.co"');
  });

  it("sale en inglés", () => {
    const html = render(
      <SignInForm protection={PROTECTION} outcome={undefined} />,
      "en",
    );

    expect(html).toContain("Send me the link");
  });
});

describe("pantalla de entrada: página del enlace", () => {
  it("con un enlace muestra el botón Entrar, que envía el token", () => {
    const html = render(
      <SignInLinkScreen
        tokenHash="token-de-prueba"
        signInPath="/admin/entrar"
        outcome={undefined}
      />,
    );

    expect(html).toMatch(/<form[^>]*method="post"/);
    expect(html).toContain('value="token-de-prueba"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Entrar</);
  });

  it.each([
    ["sin token", null, undefined],
    ["con un enlace rechazado", "t", { status: "invalid_link" }],
  ] as const)("%s lo explica y ofrece pedir otro", (_name, token, outcome) => {
    const html = render(
      <SignInLinkScreen
        tokenHash={token}
        signInPath="/admin/entrar"
        outcome={outcome}
      />,
    );

    expect(html).toContain("Este enlace ya no sirve");
    expect(html).toMatch(/href="\/admin\/entrar"[^>]*>Pedir otro enlace/);
    expect(html).not.toContain("<form");
  });

  it("si no se pudo entrar, lo dice y deja reintentar", () => {
    const html = render(
      <SignInLinkScreen
        tokenHash="t"
        signInPath="/admin/entrar"
        outcome={{ status: "unavailable" }}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("<form");
  });
});
