import { afterEach, describe, expect, it, vi } from "vitest";

import { readSiteStats, SITE_STAT_IDS } from "./site-stats.server";
import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";
import { buildTestServerEnv } from "~/testing/test-server-env";

interface Row {
  readonly key: string;
  readonly locale: string;
  readonly value: string;
}

function createClientWithRows(rows: readonly Row[]): TypedSupabaseClient {
  vi.stubGlobal("fetch", (): Promise<Response> => {
    return Promise.resolve(Response.json(rows));
  });
  return createAnonSupabaseClient(buildTestServerEnv());
}

function rowsFor(
  id: string,
  locale: string,
  value: string,
  label: string,
): Row[] {
  return [
    { key: `stats.${id}.value`, locale, value },
    { key: `stats.${id}.label`, locale, value: label },
  ];
}

const ALL_STATS_IN_SPANISH: readonly Row[] = [
  ...rowsFor("instagram", "es", "116K", "seguidores en Instagram"),
  ...rowsFor("tiktok", "es", "530K", "seguidores en TikTok"),
  ...rowsFor("views", "es", "Millones", "de vistas"),
  ...rowsFor("region", "es", "LATAM", "desde Colombia"),
];

describe("cifras del sitio", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve las cuatro cifras con su valor y su leyenda", async () => {
    const client = createClientWithRows(ALL_STATS_IN_SPANISH);

    const stats = await readSiteStats("es", client);

    expect(stats.map(({ id }) => id)).toEqual([...SITE_STAT_IDS]);
    expect(stats[0]).toMatchObject({
      value: "116K",
      label: "seguidores en Instagram",
    });
    expect(stats[3]).toMatchObject({ value: "LATAM" });
  });

  it("usa la leyenda en español cuando falta la de inglés", async () => {
    const client = createClientWithRows([
      ...ALL_STATS_IN_SPANISH,
      { key: "stats.instagram.value", locale: "en", value: "116K" },
    ]);

    const [instagram] = await readSiteStats("en", client);

    expect(instagram).toMatchObject({
      label: "seguidores en Instagram",
      labelLanguage: "es",
      valueLanguage: "en",
    });
  });

  it("omite la cifra cuyo valor falta", async () => {
    const withoutTiktokValue = ALL_STATS_IN_SPANISH.filter(
      ({ key }) => key !== "stats.tiktok.value",
    );
    const client = createClientWithRows(withoutTiktokValue);

    const stats = await readSiteStats("es", client);

    expect(stats.map(({ id }) => id)).toEqual(["instagram", "views", "region"]);
  });

  it("devuelve una lista vacía cuando no hay ninguna cifra", async () => {
    const client = createClientWithRows([]);

    await expect(readSiteStats("es", client)).resolves.toEqual([]);
  });

  it("propaga el fallo de la base", async () => {
    vi.stubGlobal("fetch", (): Promise<Response> =>
      Promise.resolve(Response.json({ message: "caída" }, { status: 500 })),
    );
    const client = createAnonSupabaseClient(buildTestServerEnv());

    await expect(readSiteStats("es", client)).rejects.toThrow(/caída/);
  });
});
