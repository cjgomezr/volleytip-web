import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { AppSettingsView, SettingsView } from "~/lib/admin/settings-view";
import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { MaintenanceConfirmation } from "./maintenance-confirmation";
import { SettingsScreen, type SettingsScreenProps } from "./settings-screen";

const WAITLIST: AppSettingsView = {
  state: "waitlist",
  values: { status: "waitlist", appStoreUrl: "", playStoreUrl: "" },
};

const VIEW: SettingsView = { maintenance: "off", app: WAITLIST, saved: null };

function render(element: ReactElement, language: Language = "es"): string {
  const Stub = createRoutesStub([
    {
      path: "*",
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
  const path = language === "es" ? "/admin/ajustes" : "/en/admin/settings";
  return renderToStaticMarkup(<Stub initialEntries={[path]} />);
}

function renderScreen(
  props: Partial<SettingsScreenProps> = {},
  language: Language = "es",
): string {
  return render(<SettingsScreen {...VIEW} {...props} />, language);
}

function findInput(html: string, name: string): string {
  const inputs = html.match(/<input[^>]*>/g) ?? [];
  const input = inputs.find((tag) => tag.includes(`name="${name}"`));
  if (input === undefined) throw new Error(`No hay un campo "${name}"`);
  return input;
}

describe("pantalla de ajustes", () => {
  it("muestra el estado actual del mantenimiento y de la app", () => {
    const html = renderScreen();

    expect(html).toContain("<title>Ajustes</title>");
    expect(html).toContain('data-setting-state="off"');
    expect(html).toContain('data-setting-state="waitlist"');
    expect(html).toContain("Apagado");
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="waitlist"/);
  });

  it("apagado, encender es un enlace a la confirmación, sin formulario", () => {
    const html = renderScreen();

    expect(html).toContain('href="/admin/ajustes/mantenimiento"');
    expect(html).not.toContain('name="enabled"');
  });

  it("encendido, apagar es un envío directo y no pide confirmación", () => {
    const html = renderScreen({ maintenance: "on" });

    expect(html).toContain('action="/admin/ajustes/mantenimiento"');
    expect(html).toContain('name="enabled" value="false"');
    expect(html).not.toContain('href="/admin/ajustes/mantenimiento"');
  });

  it("con un mantenimiento inválido lo dice y ofrece las dos salidas", () => {
    const html = renderScreen({ maintenance: "invalid" });

    expect(html).toContain("Valor inválido");
    expect(html).toContain('href="/admin/ajustes/mantenimiento"');
    expect(html).toContain('name="enabled" value="false"');
  });

  it("con un estado de la app inválido lo dice y muestra lo guardado", () => {
    const html = renderScreen({
      app: {
        state: "invalid",
        values: {
          status: "available",
          appStoreUrl: "http://sitio-ajeno.test",
          playStoreUrl: "",
        },
      },
    });

    expect(html).toContain("Valor inválido");
    expect(html).toContain('value="http://sitio-ajeno.test"');
  });

  it("pinta cada error junto a su campo y conserva lo escrito", () => {
    const html = renderScreen({
      rejection: {
        errors: { playStoreUrl: "panel.settings.app.error.playStoreUrl" },
        values: {
          status: "available",
          appStoreUrl: "",
          playStoreUrl: "http://mal",
        },
      },
    });

    expect(findInput(html, "playStoreUrl")).toContain('aria-invalid="true"');
    expect(findInput(html, "appStoreUrl")).not.toContain("aria-invalid");
    expect(html).toContain('value="http://mal"');
    expect(html).toContain("Google Play que empiece");
    expect(html).toContain('role="alert"');
  });

  it("anuncia el guardado en una región de estado que siempre existe", () => {
    expect(renderScreen()).toContain('role="status"');
    expect(renderScreen({ saved: "app" })).toContain(
      "El estado de la app quedó guardado.",
    );
  });

  it("en inglés usa las direcciones y los textos en inglés", () => {
    const html = renderScreen({}, "en");

    expect(html).toContain('href="/en/admin/settings/maintenance"');
    expect(html).toContain("Maintenance mode");
  });
});

describe("confirmación del mantenimiento", () => {
  it("dice que el sitio público dejará de verse", () => {
    const html = render(<MaintenanceConfirmation />);

    expect(html).toContain("El sitio público dejará de verse");
  });

  it("es un formulario que envía la confirmación, y deja cancelar", () => {
    const html = render(<MaintenanceConfirmation />);

    expect(html).toContain('method="post"');
    expect(html).toContain('name="enabled" value="true"');
    expect(html).toContain('name="confirm" value="yes"');
    expect(html).toMatch(/<button[^>]*type="submit"/);
    expect(html).toContain('href="/admin/ajustes"');
  });
});
