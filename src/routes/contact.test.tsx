import { afterEach, describe, expect, it, vi } from "vitest";

import type { Faq } from "~/lib/faqs.server";

import { loader, meta } from "./contact";

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

function loadContact(path: string): ReturnType<typeof loader> {
  return loader({
    request: new Request(`http://localhost${path}`),
  } as Parameters<typeof loader>[0]);
}

afterEach(() => {
  readFaqsMock.mockReset();
});

describe("contacto: loader", () => {
  it("toma el motivo del parámetro de la dirección", async () => {
    readFaqsMock.mockResolvedValue([]);

    expect((await loadContact("/contacto?motivo=pedido")).reason).toBe("order");
    expect((await loadContact("/contacto?motivo=marcas")).reason).toBe(
      "brands",
    );
    expect((await loadContact("/en/contact?motivo=order")).reason).toBe(
      "order",
    );
  });

  it("usa 'Otro' sin motivo o con uno desconocido", async () => {
    readFaqsMock.mockResolvedValue([]);

    expect((await loadContact("/contacto")).reason).toBe("other");
    expect((await loadContact("/contacto?motivo=pizza")).reason).toBe("other");
  });

  it("pide como máximo tres preguntas en el idioma de la dirección", async () => {
    readFaqsMock.mockResolvedValue([FAQ]);

    const data = await loadContact("/en/contact");

    expect(readFaqsMock).toHaveBeenCalledWith("en", { limit: 3 });
    expect(data.faqs).toEqual([FAQ]);
    expect(data.language).toBe("en");
  });

  it("da título y descripción en el idioma de la dirección", async () => {
    readFaqsMock.mockResolvedValue([]);

    const spanish = await loadContact("/contacto");
    const english = await loadContact("/en/contact");

    expect(spanish.title).not.toBe(english.title);
    expect(spanish.description).not.toBe(english.description);
    expect(meta({ loaderData: english } as Parameters<typeof meta>[0])).toEqual(
      [
        { title: english.title },
        { name: "description", content: english.description },
      ],
    );
  });

  it("emite la protección del formulario", async () => {
    readFaqsMock.mockResolvedValue([]);

    const data = await loadContact("/contacto");

    expect(data.protection.siteKey).not.toBe("");
    expect(data.protection.timestamp).not.toBe("");
  });
});
