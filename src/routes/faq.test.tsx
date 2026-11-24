import { afterEach, describe, expect, it, vi } from "vitest";

import type { Faq } from "~/lib/faqs.server";

import { loader, meta } from "./faq";

vi.mock("~/lib/faqs.server", () => ({ readFaqs: vi.fn() }));
const { readFaqs } = await import("~/lib/faqs.server");
const readFaqsMock = vi.mocked(readFaqs);

const FAQ: Faq = {
  id: "1",
  question: "¿Cuánto cuesta?",
  questionLanguage: "es",
  answer: "Nada.",
  answerLanguage: "es",
};

function loadFaq(path: string): ReturnType<typeof loader> {
  return loader({
    request: new Request(`http://localhost${path}`),
  } as Parameters<typeof loader>[0]);
}

afterEach(() => {
  readFaqsMock.mockReset();
});

describe("preguntas frecuentes: loader", () => {
  it("lee las preguntas en el idioma de la petición", async () => {
    readFaqsMock.mockResolvedValue([FAQ]);

    const data = await loadFaq("/en/faq");

    expect(readFaqsMock).toHaveBeenCalledWith("en");
    expect(data.faqs).toEqual([FAQ]);
    expect(data.language).toBe("en");
  });

  it("devuelve una lista vacía cuando no hay preguntas publicadas", async () => {
    readFaqsMock.mockResolvedValue([]);

    const data = await loadFaq("/preguntas-frecuentes");

    expect(data.faqs).toEqual([]);
  });

  it("da título y descripción en el idioma de la dirección", async () => {
    readFaqsMock.mockResolvedValue([]);

    const spanish = await loadFaq("/preguntas-frecuentes");
    const english = await loadFaq("/en/faq");

    expect(spanish.title).not.toBe(english.title);
    expect(spanish.description).not.toBe(english.description);
    expect(meta({ loaderData: english } as Parameters<typeof meta>[0])).toEqual(
      [
        { title: english.title },
        { name: "description", content: english.description },
      ],
    );
  });
});
