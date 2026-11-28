import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import { TIP_FUNDAMENTALS, TIP_LEVELS, TIP_ORIENTATIONS } from "~/lib/tips";
import {
  connectToLocalDatabase,
  takeOnlyRow,
  type Database,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import { createTipRows, type TipRows } from "~/testing/tip-rows";

// El destacado es uno en toda la base: solo este archivo marca tips.
const PREFIX = "prueba-tips-tablas";

let database: Database;
let tips: TipRows;

beforeAll(() => {
  database = connectToLocalDatabase();
  tips = createTipRows(database, PREFIX);
});

afterEach(() => tips.removeAll());

afterAll(async () => {
  await database.end();
});

async function readEnumValues(name: string): Promise<string[]> {
  const rows = await database<{ value: string }[]>`
    select enumlabel::text as value from pg_enum
    where enumtypid = ${`public.${name}`}::regtype
    order by enumsortorder
  `;
  return rows.map(({ value }) => value);
}

describeIntegration("tips: tablas", () => {
  it("crea un tip con sus traducciones", async () => {
    const { id } = await tips.insert({
      translations: {
        es: {
          title: "Saque flotado",
          achievement: "El balón no gira",
          keys: ["Mano firme", "Golpe seco", "Frena el brazo"],
          commonError: "Acompañar el golpe",
          practice: "Diez saques contra la pared",
        },
        en: { title: "Float serve" },
      },
    });

    const rows = await database<{ locale: string; keys: string[] }[]>`
      select locale, keys from public.tip_translations
      where tip_id = ${id} order by locale
    `;

    expect(rows.map(({ locale }) => locale)).toEqual(["en", "es"]);
    expect(rows[1]?.keys).toHaveLength(3);
  });

  it("nace como borrador, sin destacar y sin video, fundamento ni nivel", async () => {
    const slug = `${PREFIX}-${randomUUID()}`;

    const rows = await database<Record<string, unknown>[]>`
      insert into public.tips (slug) values (${slug})
      returning status, is_featured, bunny_video_id, fundamental, level,
        promo, tiktok_url, published_at
    `;

    expect(takeOnlyRow(rows, "tips")).toEqual({
      status: "draft",
      is_featured: false,
      bunny_video_id: null,
      fundamental: null,
      level: null,
      promo: null,
      tiktok_url: null,
      published_at: null,
    });
  });

  it("admite exactamente las listas de fundamentos, niveles y orientaciones del código", async () => {
    expect(await readEnumValues("tip_fundamental")).toEqual([
      ...TIP_FUNDAMENTALS,
    ]);
    expect(await readEnumValues("tip_level")).toEqual([...TIP_LEVELS]);
    expect(await readEnumValues("tip_orientation")).toEqual([
      ...TIP_ORIENTATIONS,
    ]);
  });

  it.each([
    ["fundamental", "dig"],
    ["level", "expert"],
    ["orientation", "square"],
  ])("rechaza un valor desconocido de %s", async (column, value) => {
    const { id } = await tips.insert();

    await expect(
      database`
        update public.tips set ${database(column)} = ${value} where id = ${id}
      `,
    ).rejects.toThrow(/invalid input value for enum/);
  });

  it("rechaza un segundo tip con el mismo video", async () => {
    const { bunnyVideoId } = await tips.insert();

    await expect(tips.insert({ bunnyVideoId })).rejects.toThrow(
      /tips_bunny_video_id_key/,
    );
  });

  it("rechaza un segundo tip con el mismo slug", async () => {
    const { slug } = await tips.insert();

    await expect(
      database`insert into public.tips (slug) values (${slug})`,
    ).rejects.toThrow(/tips_slug_key/);
  });

  it.each(["Con Mayúsculas", "con/barra", "-guion", "doble--guion", ""])(
    "rechaza el slug %j",
    async (slug) => {
      await expect(
        database`insert into public.tips (slug) values (${slug})`,
      ).rejects.toThrow(/tips_slug_check/);
    },
  );

  it("rechaza un segundo destacado", async () => {
    await tips.insert({ isFeatured: true });

    await expect(tips.insert({ isFeatured: true })).rejects.toThrow(
      /tips_one_featured_idx/,
    );
  });

  it("admite un borrador sin fundamento ni nivel", async () => {
    await expect(
      tips.insert({
        status: "draft",
        publishedAt: null,
        fundamental: null,
        level: null,
      }),
    ).resolves.toBeDefined();
  });

  it.each([
    ["fundamento", { fundamental: null }],
    ["nivel", { level: null }],
    ["fecha de publicación", { publishedAt: null }],
    ["video", { bunnyVideoId: null }],
  ])("rechaza publicar sin %s", async (_what, seed) => {
    await expect(tips.insert(seed)).rejects.toThrow(
      /tips_published_complete_check/,
    );
  });

  it.each(["orientation", "duration_seconds", "thumbnail_url"])(
    "rechaza dejar un publicado sin %s",
    async (column) => {
      const { id } = await tips.insert();

      await expect(
        database`
          update public.tips set ${database(column)} = null where id = ${id}
        `,
      ).rejects.toThrow(/tips_published_complete_check/);
    },
  );

  it("rechaza publicar un borrador sin clasificar", async () => {
    const { id } = await tips.insert({
      status: "draft",
      fundamental: null,
      level: null,
    });

    await expect(
      database`update public.tips set status = 'published' where id = ${id}`,
    ).rejects.toThrow(/tips_published_complete_check/);
  });

  it.each([0, -3])("rechaza una duración de %i segundos", async (seconds) => {
    const { id } = await tips.insert();

    await expect(
      database`
        update public.tips set duration_seconds = ${seconds} where id = ${id}
      `,
    ).rejects.toThrow(/tips_duration_seconds_check/);
  });

  it.each(["bunny_video_id", "thumbnail_url", "tiktok_url"])(
    "rechaza %s en blanco",
    async (column) => {
      const { id } = await tips.insert();

      await expect(
        database`
          update public.tips set ${database(column)} = '  ' where id = ${id}
        `,
      ).rejects.toThrow(new RegExp(`tips_${column}_check`));
    },
  );

  it.each(["app", "social"])("admite la promo de tipo %s", async (type) => {
    const { id } = await tips.insert();

    await expect(
      database`
        update public.tips set promo = ${database.json({ type })} where id = ${id}
      `,
    ).resolves.toBeDefined();
  });

  it.each([
    ["un tipo desconocido", { type: "camp" }],
    ["sin tipo", { kind: "app" }],
    ["una lista", ["app"]],
    ["un texto", "app"],
  ])("rechaza una promo con %s", async (_what, promo) => {
    const { id } = await tips.insert();

    await expect(
      database`
        update public.tips set promo = ${database.json(promo)} where id = ${id}
      `,
    ).rejects.toThrow(/tips_promo_check/);
  });

  it("admite una sola traducción por tip e idioma", async () => {
    const { id } = await tips.insert();

    await expect(
      database`
        insert into public.tip_translations (tip_id, locale, title)
        values (${id}, 'es', 'Otra')
      `,
    ).rejects.toThrow(/tip_translations_pkey/);
  });

  it("rechaza un idioma que no existe", async () => {
    const { id } = await tips.insert();

    await expect(
      database`
        insert into public.tip_translations (tip_id, locale, title)
        values (${id}, 'xx', 'Otra')
      `,
    ).rejects.toThrow(/tip_translations_locale_fkey/);
  });

  it("rechaza un título en blanco", async () => {
    await expect(
      tips.insert({ translations: { es: { title: "   " } } }),
    ).rejects.toThrow(/tip_translations_title_check/);
  });

  it.each([
    ["cuatro claves", ["a", "b", "c", "d"]],
    ["una clave en blanco", ["a", " "]],
  ])("rechaza %s", async (_what, keys) => {
    await expect(
      tips.insert({ translations: { es: { title: "Saque", keys } } }),
    ).rejects.toThrow(/tip_translations_keys_check/);
  });

  it("actualiza updated_at al editar un tip", async () => {
    const { id } = await tips.insert();

    const rows = await database<{ was_touched: boolean }[]>`
      update public.tips set duration_seconds = 50 where id = ${id}
      returning updated_at > created_at as was_touched
    `;

    expect(takeOnlyRow(rows, "tips").was_touched).toBe(true);
  });

  it("tiene RLS y ámbito compartido en las dos tablas", async () => {
    const rows = await database<{ has_rls: boolean; comment: string | null }[]>`
      select relrowsecurity as has_rls,
             obj_description(oid, 'pg_class') as comment
      from pg_class
      where relnamespace = 'public'::regnamespace
        and relname in ('tips', 'tip_translations')
    `;

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.has_rls).toBe(true);
      expect(row.comment).toMatch(/^scope: shared\./);
    }
  });
});
