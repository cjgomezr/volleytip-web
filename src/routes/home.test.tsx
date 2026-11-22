import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import Home, { loader, meta } from "./home";

type Language = "es" | "en";

function renderHome(language: Language): string {
  return renderToStaticMarkup(
    <TranslationsProvider language={language} messages={getMessages(language)}>
      <Home />
    </TranslationsProvider>,
  );
}

function loadHome(path: string): ReturnType<typeof loader> {
  return loader({
    request: new Request(`http://localhost${path}`),
  } as Parameters<typeof loader>[0]);
}

describe("home", () => {
  it("renders a single main heading in Spanish", () => {
    const html = renderHome("es");

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Aprende voley en");
  });

  it("renders its visible text in English", () => {
    const html = renderHome("en");

    expect(html).toContain("Learn volleyball in");
    expect(html).toContain("Site under construction");
    expect(html).not.toContain("Aprende voley");
  });

  it("links to the health check, the route that walks end to end", () => {
    expect(renderHome("en")).toMatch(/<a[^>]+href="\/healthz"/);
  });

  it("gives its title and description in the language of the address", () => {
    const spanish = loadHome("/");
    const english = loadHome("/en/");

    expect(spanish.description).toContain("Tips de voleibol");
    expect(english.description).toContain("Volleyball tips");
    expect(meta({ loaderData: english } as Parameters<typeof meta>[0])).toEqual(
      [
        { title: english.title },
        { name: "description", content: english.description },
      ],
    );
  });
});
