import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { SaveBar } from "./editor-section";
import { UnsentNotice } from "./unsent-notice";

function render(element: ReactElement, language: Language = "es"): string {
  return renderToStaticMarkup(
    <TranslationsProvider language={language} messages={getMessages(language)}>
      {element}
    </TranslationsProvider>,
  );
}

describe("aviso de envío que no llegó", () => {
  it.each([
    ["es", "No se pudo enviar", "registrado"],
    ["en", "It could not be sent", "logged"],
  ] as const)(
    "es una alerta que no dice que el fallo quedó registrado (%s)",
    (language, text, claim) => {
      const html = render(<UnsentNotice />, language);

      expect(html).toContain('role="alert"');
      expect(html).toContain(text);
      expect(html).not.toContain(claim);
    },
  );

  const bar = { submitLabel: "Guardar", isEdited: false } as const;

  it("el pie de un formulario lo muestra en vez del resultado", () => {
    const html = render(
      <SaveBar {...bar} isSaving={false} isUnsent status="saved" />,
    );

    expect(html).toContain("No se pudo enviar");
    expect(html).not.toContain("Cambios guardados");
  });

  it("mientras se reintenta, el aviso del intento anterior no se ve", () => {
    const html = render(
      <SaveBar {...bar} isSaving isUnsent status={undefined} />,
    );

    expect(html).not.toContain('role="alert"');
  });
});
