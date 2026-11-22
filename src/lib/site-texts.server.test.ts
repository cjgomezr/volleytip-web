import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTestServerEnv } from "~/testing/test-server-env";

import { readSiteTexts } from "./site-texts.server";
import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

const DATABASE_ERROR_STATUS = 500;

function createClientAnswering(response: Response): TypedSupabaseClient {
  vi.stubGlobal("fetch", (): Promise<Response> => Promise.resolve(response));
  return createAnonSupabaseClient(buildTestServerEnv());
}

describe("textos editables: base caída", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("propaga el error con la clave en el mensaje", async () => {
    const client = createClientAnswering(
      Response.json(
        { code: "XX000", message: "la base no responde" },
        { status: DATABASE_ERROR_STATUS },
      ),
    );

    await expect(readSiteTexts(["home.title"], "en", client)).rejects.toThrow(
      /home\.title.*la base no responde/,
    );
  });
});

// De qué idioma salió cada texto: la página lo necesita para poner `lang` en
// un texto que cayó al español dentro de una página en inglés (WCAG 3.1.2).
describe("textos editables: idioma de cada texto", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function clientWithRows(
    rows: readonly { key: string; locale: string; value: string }[],
  ): TypedSupabaseClient {
    return createClientAnswering(Response.json(rows));
  }

  it("un texto traducido sale en el idioma pedido y lo dice", async () => {
    const client = clientWithRows([
      { key: "home.title", locale: "es", value: "Hola" },
      { key: "home.title", locale: "en", value: "Hello" },
    ]);

    expect(await readSiteTexts(["home.title"], "en", client)).toEqual({
      "home.title": { text: "Hello", language: "en" },
    });
  });

  it("un texto sin traducción sale en español y lo dice", async () => {
    const client = clientWithRows([
      { key: "home.title", locale: "es", value: "Hola" },
    ]);

    expect(await readSiteTexts(["home.title"], "en", client)).toEqual({
      "home.title": { text: "Hola", language: "es" },
    });
  });

  it("una traducción en blanco cuenta como ausente: español, y lo dice", async () => {
    const client = clientWithRows([
      { key: "home.title", locale: "es", value: "Hola" },
      { key: "home.title", locale: "en", value: "   " },
    ]);

    expect(await readSiteTexts(["home.title"], "en", client)).toEqual({
      "home.title": { text: "Hola", language: "es" },
    });
  });

  it("cada clave lleva su propio idioma cuando unas están traducidas y otras no", async () => {
    const client = clientWithRows([
      { key: "home.title", locale: "es", value: "Hola" },
      { key: "home.title", locale: "en", value: "Hello" },
      { key: "home.intro", locale: "es", value: "Bienvenida" },
    ]);

    expect(
      await readSiteTexts(["home.title", "home.intro"], "en", client),
    ).toEqual({
      "home.title": { text: "Hello", language: "en" },
      "home.intro": { text: "Bienvenida", language: "es" },
    });
  });

  it("pedido en español, todo sale en español", async () => {
    const client = clientWithRows([
      { key: "home.title", locale: "es", value: "Hola" },
    ]);

    expect(await readSiteTexts(["home.title"], "es", client)).toEqual({
      "home.title": { text: "Hola", language: "es" },
    });
  });

  it("una clave que no existe en ningún idioma lanza un error que la nombra", async () => {
    const client = clientWithRows([
      { key: "home.title", locale: "es", value: "Hola" },
    ]);

    await expect(
      readSiteTexts(["home.title", "home.no_existe"], "en", client),
    ).rejects.toThrow(/home\.no_existe/);
  });
});
