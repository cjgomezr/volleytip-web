import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { connectToLocalDatabase, type Database } from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import { createLocalServiceClient } from "~/testing/local-supabase.server";

import {
  ANNOUNCEMENT_BAR_KEY,
  ANNOUNCEMENT_BAR_SETTING,
  MAX_ANNOUNCEMENT_MESSAGES,
  loadAnnouncementMessages,
  pickAnnouncementMessages,
} from "./announcement-bar.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

describe("ajuste de la barra de anuncios", () => {
  const isValid = ANNOUNCEMENT_BAR_SETTING.isValid;

  it("acepta una lista de mensajes con su texto por idioma", () => {
    expect(isValid([{ text: { es: "Hola", en: "Hi" } }])).toBe(true);
    expect(isValid([{ text: { es: "Hola" } }])).toBe(true);
  });

  it("acepta la lista vacía y el ajuste no existente cae a lista vacía", () => {
    expect(isValid([])).toBe(true);
    expect(ANNOUNCEMENT_BAR_SETTING.fallback).toEqual([]);
    expect(ANNOUNCEMENT_BAR_SETTING.key).toBe(ANNOUNCEMENT_BAR_KEY);
  });

  it.each([
    ["no es lista", { text: { es: "Hola" } }],
    ["un mensaje sin texto", [{}]],
    ["sin español", [{ text: { en: "Hi" } }]],
    ["texto que no es cadena", [{ text: { es: 3 } }]],
    ["traducción que no es cadena", [{ text: { es: "Hola", en: 3 } }]],
    ["nulo", null],
  ])("rechaza una forma inválida: %s", (_case, value) => {
    expect(isValid(value)).toBe(false);
  });

  it("se queda con los tres primeros mensajes", () => {
    const messages = Array.from({ length: 5 }, (_, index) => ({
      text: { es: `m${index}` },
    }));

    expect(pickAnnouncementMessages(messages, "es")).toEqual(["m0", "m1", "m2"]);
    expect(MAX_ANNOUNCEMENT_MESSAGES).toBe(3);
  });
});

describe("mensajes de la barra por idioma", () => {
  const messages = [{ text: { es: "Hola", en: "Hi" } }];

  it("usa el español en la página en español", () => {
    expect(pickAnnouncementMessages(messages, "es")).toEqual(["Hola"]);
  });

  it("usa la traducción en inglés cuando existe", () => {
    expect(pickAnnouncementMessages(messages, "en")).toEqual(["Hi"]);
  });

  it("cae al español cuando no hay inglés", () => {
    expect(pickAnnouncementMessages([{ text: { es: "Hola" } }], "en")).toEqual([
      "Hola",
    ]);
  });

  it("cuenta como ausente el inglés vacío o de solo espacios", () => {
    expect(
      pickAnnouncementMessages([{ text: { es: "Hola", en: "   " } }], "en"),
    ).toEqual(["Hola"]);
    expect(
      pickAnnouncementMessages([{ text: { es: "Hola", en: "" } }], "en"),
    ).toEqual(["Hola"]);
  });
});

describe("carga de la barra sin romper la página", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function clientReturning(result: {
    data: unknown;
    error: unknown;
  }): TypedSupabaseClient {
    const query = {
      select: () => query,
      in: () => Promise.resolve(result),
    };
    return { from: () => query } as unknown as TypedSupabaseClient;
  }

  it("devuelve los mensajes del idioma", async () => {
    const client = clientReturning({
      data: [
        { key: ANNOUNCEMENT_BAR_KEY, value: [{ text: { es: "Hola", en: "Hi" } }] },
      ],
      error: null,
    });

    await expect(loadAnnouncementMessages("en", client)).resolves.toEqual([
      "Hi",
    ]);
  });

  it("devuelve lista vacía cuando el ajuste no existe", async () => {
    const client = clientReturning({ data: [], error: null });

    await expect(loadAnnouncementMessages("es", client)).resolves.toEqual([]);
  });

  it("registra el error y devuelve lista vacía con una forma inválida", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = clientReturning({
      data: [{ key: ANNOUNCEMENT_BAR_KEY, value: "roto" }],
      error: null,
    });

    await expect(loadAnnouncementMessages("es", client)).resolves.toEqual([]);
    expect(logged).toHaveBeenCalledOnce();
  });

  it("registra el error y devuelve lista vacía cuando la base falla", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = clientReturning({ data: null, error: { message: "caída" } });

    await expect(loadAnnouncementMessages("es", client)).resolves.toEqual([]);
    expect(logged).toHaveBeenCalledOnce();
  });
});

describeIntegration("announcement_bar", () => {
  let database: Database;
  let client: TypedSupabaseClient;
  let original: string | undefined;

  beforeAll(async () => {
    database = connectToLocalDatabase();
    client = createLocalServiceClient();
    const rows = await database<{ value: unknown }[]>`
      select value from public.settings where key = ${ANNOUNCEMENT_BAR_KEY}
    `;
    original = rows[0] === undefined ? undefined : JSON.stringify(rows[0].value);
  });

  afterAll(async () => {
    await database`delete from public.settings where key = ${ANNOUNCEMENT_BAR_KEY}`;
    if (original !== undefined) {
      await database`insert into public.settings (key, value) values (${ANNOUNCEMENT_BAR_KEY}, ${original}::text::jsonb)`;
    }
    await database.end();
  });

  async function store(value: unknown): Promise<void> {
    await database`
      insert into public.settings (key, value)
      values (${ANNOUNCEMENT_BAR_KEY}, ${JSON.stringify(value)}::text::jsonb)
      on conflict (key) do update set value = excluded.value
    `;
  }

  it("devuelve los mensajes de la fila y, al cambiarla, el cambio", async () => {
    await store([{ text: { es: "Uno" } }]);
    await expect(loadAnnouncementMessages("es", client)).resolves.toEqual(["Uno"]);

    await store([{ text: { es: "Dos" } }]);
    await expect(loadAnnouncementMessages("es", client)).resolves.toEqual(["Dos"]);
  });
});
