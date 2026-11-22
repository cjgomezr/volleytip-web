import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import { LEGAL_DOCUMENTS } from "~/lib/legal/legal-documents";
import type { LegalDocumentId } from "~/lib/legal/legal-documents";

import { LegalPage, buildLegalPageData, buildLegalMeta } from "./legal-page";

type Language = "es" | "en";

function render(
  id: LegalDocumentId,
  language: Language,
  status: "provisional" | "final" = "provisional",
): string {
  const data = buildLegalPageData(id, language, status);
  return renderToStaticMarkup(
    <TranslationsProvider language={language} messages={getMessages(language)}>
      <LegalPage {...data} />
    </TranslationsProvider>,
  );
}

describe("página legal", () => {
  it("shows the Spanish title, version and date in Spanish", () => {
    const html = render("terms", "es");

    expect(html).toContain("Términos y condiciones");
    expect(html).toContain(LEGAL_DOCUMENTS.terms.version);
    expect(html).toContain("noviembre de 2026");
  });

  it("shows the English title and an English date", () => {
    const html = render("privacy", "en");

    expect(html).toContain("Privacy policy");
    expect(html).toContain("November 23, 2026");
  });

  it("has one h1 and no heading level skipped", () => {
    const html = render("privacy", "es");
    const levels = [...html.matchAll(/<h([1-6])/g)].map((m) => Number(m[1]));

    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    levels.slice(1).forEach((level, index) => {
      expect(level).toBeLessThanOrEqual((levels[index] ?? 0) + 1);
    });
  });

  it("shows a visible notice while the document is provisional", () => {
    expect(render("terms", "es")).toContain("texto provisional");
    expect(render("terms", "en")).toContain("provisional text");
  });

  it("shows no notice once the document is final", () => {
    expect(render("terms", "es", "final")).not.toContain("provisional");
  });

  it("asks not to index while provisional and not once final", () => {
    const provisional = buildLegalMeta(
      buildLegalPageData("terms", "es", "provisional"),
    );
    const final = buildLegalMeta(buildLegalPageData("terms", "es", "final"));

    expect(provisional).toContainEqual({
      name: "robots",
      content: "noindex",
    });
    expect(JSON.stringify(final)).not.toContain("noindex");
  });

  it("gives its own title and description in each language", () => {
    const es = buildLegalMeta(buildLegalPageData("privacy", "es", "final"));
    const en = buildLegalMeta(buildLegalPageData("privacy", "en", "final"));

    expect(es).toContainEqual({ title: expect.stringContaining("privacidad") });
    expect(en).toContainEqual({ title: expect.stringContaining("Privacy") });
    expect(JSON.stringify(es)).toContain('"name":"description"');
  });
});
