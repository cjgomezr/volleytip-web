import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import type { GoogleNotice } from "~/lib/panel/google-notice";
import { SignInScreen } from "~/routes/panel/sign-in";

const PROTECTION = { siteKey: "llave", timestamp: "marca" };

interface Options {
  readonly isGoogleEnabled?: boolean;
  readonly googleNotice?: GoogleNotice | null;
  readonly isSent?: boolean;
  readonly language?: Language;
  readonly entry?: string;
}

function render({
  isGoogleEnabled = true,
  googleNotice = null,
  isSent = false,
  language = "es",
  entry = "/",
}: Options = {}): string {
  const screen: ReactElement = (
    <TranslationsProvider language={language} messages={getMessages(language)}>
      <SignInScreen
        protection={PROTECTION}
        outcome={isSent ? { status: "sent" } : undefined}
        isGoogleEnabled={isGoogleEnabled}
        googleNotice={googleNotice}
      />
    </TranslationsProvider>
  );
  const Stub = createRoutesStub([{ path: "*", Component: () => screen }]);
  return renderToStaticMarkup(<Stub initialEntries={[entry]} />);
}

describe("google: botón", () => {
  it.each([
    ["es", "/admin/entrar", "Continuar con Google", "/admin/entrar/google"],
    [
      "en",
      "/en/admin/sign-in",
      "Continue with Google",
      "/en/admin/sign-in/google",
    ],
  ] as const)(
    "con Google configurado se pinta junto al formulario del enlace (%s)",
    (language, entry, label, action) => {
      const html = render({ language, entry });

      expect(html).toContain('name="email"');
      expect(html).toContain(`action="${action}"`);
      expect(html).toMatch(
        new RegExp(`<button type="submit"[^>]*><img[^>]*/>${label}</button>`),
      );
    },
  );

  it("sin Google configurado no se pinta y queda el enlace al correo", () => {
    const html = render({ isGoogleEnabled: false });

    expect(html).not.toContain("Google");
    expect(html).toContain('name="email"');
    expect(html).toContain("Enviarme el enlace");
    expect(html).toContain("Solo entran los correos autorizados");
  });

  it("el logo es decorativo: el nombre accesible es el texto", () => {
    const html = render();

    expect(html).toMatch(/<img src="\/brand\/google-g.svg" alt=""/);
  });

  it("usa el logo de cuatro colores de Google", () => {
    const logo = readFileSync(
      new URL("../../../public/brand/google-g.svg", import.meta.url),
      "utf8",
    );

    for (const color of ["#4285F4", "#34A853", "#FBBC05", "#EA4335"]) {
      expect(logo).toContain(color);
    }
  });

  it("lleva la página a la que se iba", () => {
    const html = render({ entry: "/admin/entrar?next=%2Fadmin%2Fmensajes" });

    expect(html).toContain(
      '<input type="hidden" name="next" value="/admin/mensajes"/>',
    );
  });

  it("enviado el enlace, la pantalla ya no ofrece Google", () => {
    const html = render({ isSent: true });

    expect(html).not.toContain("Continuar con Google");
  });
});

describe("google: mensaje", () => {
  it.each([
    ["denied", "es", "Ese correo no tiene acceso"],
    ["denied", "en", "That email address does not have access"],
    ["failed", "es", "No pudimos entrar con Google"],
    ["failed", "en", "We could not sign you in with Google"],
  ] as const)("con %s lo anuncia en %s", (googleNotice, language, text) => {
    const html = render({ googleNotice, language });

    expect(html).toMatch(new RegExp(`role="alert"[^>]*>${text}`));
  });

  it("el mensaje sale aunque el botón esté apagado", () => {
    const html = render({ googleNotice: "failed", isGoogleEnabled: false });

    expect(html).toContain("No pudimos entrar con Google");
  });

  it("tras enviar el enlace el mensaje desaparece", () => {
    const html = render({ googleNotice: "denied", isSent: true });

    expect(html).not.toContain("no tiene acceso");
  });
});
