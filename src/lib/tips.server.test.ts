import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "./database.types";
import type { TypedSupabaseClient } from "./supabase/typed-client";
import {
  countPublishedTips,
  listPublishedTips,
  readLatestTip,
  readTipBySlug,
} from "./tips.server";

const SPANISH = {
  title: "Saque flotado",
  achievement: "El balón no gira",
  keys: ["Mano firme"],
  common_error: "Acompañar el golpe",
  practice: "Contra la pared",
};

function buildRow(translations: unknown, overrides: object = {}): object {
  return {
    id: "5f0c8a52-2f0e-4a53-9d3c-3f6f2f6a0c11",
    slug: "saque-flotado",
    bunny_video_id: "video-1",
    orientation: "vertical",
    duration_seconds: 42,
    thumbnail_url: "https://miniaturas.prueba.volleytip.test/uno.jpg",
    fundamental: "serve",
    level: "basic",
    tiktok_url: null,
    promo: null,
    is_featured: false,
    published_at: "2026-11-01T12:00:00+00:00",
    translations,
    ...overrides,
  };
}

// Un cliente de verdad cuyo `fetch` contesta las filas dadas: nada sale a la
// red. La lectura contra la base está en `src/db/tips-reading.integration.test.ts`.
function fakeClient(
  rows: readonly unknown[],
  status = 200,
): TypedSupabaseClient {
  const body = status === 200 ? rows : { message: "la base no responde" };
  return createClient<Database>("http://supabase.prueba", "llave-publica", {
    global: {
      fetch: async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: {
            "Content-Type": "application/json",
            "Content-Range": `0-${rows.length - 1}/${rows.length}`,
          },
        }),
    },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("tips: lectura por idioma", () => {
  it("devuelve el inglés cuando existe", async () => {
    const client = fakeClient([
      buildRow({ es: SPANISH, en: { ...SPANISH, title: "Float serve" } }),
    ]);

    const tip = await readTipBySlug("en", "saque-flotado", { client });

    expect(tip?.text.title).toBe("Float serve");
    expect(tip?.textLanguages.title).toBe("en");
  });

  it("devuelve el español cuando falta el inglés (FR-007)", async () => {
    const client = fakeClient([buildRow({ es: SPANISH })]);

    const tip = await readTipBySlug("en", "saque-flotado", { client });

    expect(tip?.text).toEqual({
      title: "Saque flotado",
      achievement: "El balón no gira",
      keys: ["Mano firme"],
      commonError: "Acompañar el golpe",
      practice: "Contra la pared",
    });
    expect(tip?.textLanguages.title).toBe("es");
  });

  it("resuelve campo por campo una traducción a medias", async () => {
    const english = {
      title: "Float serve",
      achievement: null,
      keys: [],
      common_error: "  ",
      practice: "Against the wall",
    };
    const client = fakeClient([buildRow({ es: SPANISH, en: english })]);

    const tip = await readTipBySlug("en", "saque-flotado", { client });

    expect(tip?.text).toMatchObject({
      title: "Float serve",
      achievement: "El balón no gira",
      keys: ["Mano firme"],
      commonError: "Acompañar el golpe",
      practice: "Against the wall",
    });
    expect(tip?.textLanguages).toMatchObject({
      achievement: "es",
      practice: "en",
    });
  });

  it("usa un campo en inglés que el español dejó vacío", async () => {
    const client = fakeClient([
      buildRow({
        es: { ...SPANISH, achievement: null },
        en: { ...SPANISH, achievement: "No spin" },
      }),
    ]);

    const tip = await readTipBySlug("en", "saque-flotado", { client });

    expect(tip?.text.achievement).toBe("No spin");
  });

  it("un tip sin ninguna traducción no rompe: se omite y queda en el registro", async () => {
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const client = fakeClient([buildRow({})]);

    const tip = await readTipBySlug("es", "saque-flotado", { client });
    const page = await listPublishedTips("es", { client });

    expect(tip).toBeNull();
    expect(page.tips).toEqual([]);
    expect(logged).toHaveBeenCalledTimes(2);
  });

  it.each([
    [null, null],
    [{ type: "app" }, "app"],
    [{ type: "social" }, "social"],
  ])("lee la promo %j como %j", async (promo, expected) => {
    const client = fakeClient([buildRow({ es: SPANISH }, { promo })]);

    const tip = await readTipBySlug("es", "saque-flotado", { client });

    expect(tip?.promo).toBe(expected);
  });

  it("lanza con una fila que no cumple lo que la base garantiza", async () => {
    const client = fakeClient([
      buildRow({ es: SPANISH }, { bunny_video_id: null }),
    ]);

    await expect(
      readTipBySlug("es", "saque-flotado", { client }),
    ).rejects.toThrow(/saque-flotado/);
  });

  it("lanza cuando la base falla", async () => {
    const client = fakeClient([], 500);

    await expect(
      readTipBySlug("es", "saque-flotado", { client }),
    ).rejects.toThrow(/No se pudo leer el tip/);
    await expect(listPublishedTips("es", { client })).rejects.toThrow(
      /No se pudieron leer los tips/,
    );
  });
});

describe("listado de tips: lectura del último video", () => {
  it("pide primero el destacado y después el más reciente", async () => {
    const requested: URL[] = [];
    const client = createClient<Database>(
      "http://supabase.prueba",
      "llave-publica",
      {
        global: {
          fetch: async (input) => {
            requested.push(new URL(String(input)));
            return Response.json([buildRow({ es: SPANISH })]);
          },
        },
      },
    );

    const tip = await readLatestTip("es", { client });

    expect(tip?.slug).toBe("saque-flotado");
    expect(requested[0]?.searchParams.get("order")).toBe(
      "is_featured.desc,published_at.desc,id.asc",
    );
    expect(requested[0]?.searchParams.get("limit")).toBe("1");
  });

  it("sin tips publicados devuelve nulo", async () => {
    const client = fakeClient([]);

    await expect(readLatestTip("es", { client })).resolves.toBeNull();
  });

  it("si la base falla, lanza", async () => {
    const client = fakeClient([], 500);

    await expect(readLatestTip("es", { client })).rejects.toThrow(/último tip/);
    await expect(countPublishedTips("es", { client })).rejects.toThrow(
      /No se pudieron leer los tips/,
    );
  });
});
