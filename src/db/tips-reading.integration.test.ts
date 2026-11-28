import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import type { Language } from "~/lib/i18n/languages";
import {
  listPublishedTips,
  readTipBySlug,
  type ListPublishedTipsOptions,
  type TipPage,
} from "~/lib/tips.server";
import { connectToLocalDatabase, type Database } from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import {
  createTipRows,
  daysFromNow,
  type SeededTip,
  type TipRows,
  type TipSeed,
} from "~/testing/tip-rows";

const PREFIX = "prueba-tips-lectura";

let database: Database;
let tips: TipRows;
// Va en los textos de los tips de una prueba para buscar solo los suyos: otros
// archivos siembran tips en la misma base.
let mark: string;

beforeAll(() => {
  database = connectToLocalDatabase();
  tips = createTipRows(database, PREFIX);
});

afterEach(() => tips.removeAll());

afterAll(async () => {
  await database.end();
});

function newMark(): void {
  mark = `zz${randomUUID().slice(0, 8)}`;
}

/** Un tip que lleva la marca en la frase de logro. */
function seedMarked(title: string, rest: TipSeed = {}): Promise<SeededTip> {
  return tips.insert({
    translations: { es: { title, achievement: mark } },
    ...rest,
  });
}

async function search(
  query: string,
  language: Language = "es",
  options: ListPublishedTipsOptions = {},
): Promise<TipPage & { titles: string[] }> {
  const page = await listPublishedTips(language, { query, ...options });
  return { ...page, titles: page.tips.map(({ text }) => text.title) };
}

describeIntegration("tips: búsqueda", () => {
  it.each(["recepcion", "RECEPCIÓN", "Recepción", "  cepci  "])(
    "%j encuentra 'Recepción' sin distinguir mayúsculas ni tildes",
    async (query) => {
      newMark();
      const found = await seedMarked(`Recepción ${mark}`);
      const other = await seedMarked(`Bloqueo ${mark}`);

      const { tips: listed } = await search(query);
      const slugs = listed.map(({ slug }) => slug);

      expect(slugs).toContain(found.slug);
      expect(slugs).not.toContain(other.slug);
    },
  );

  it("encuentra una tilde escrita como carácter combinado", async () => {
    newMark();
    await seedMarked(`Recepción ${mark}`.normalize("NFD"));

    const { total } = await search(`recepcion ${mark}`);

    expect(total).toBe(1);
  });

  it("busca en el título, la frase de logro y las claves", async () => {
    newMark();
    await tips.insert({ translations: { es: { title: `${mark} título` } } });
    await tips.insert({
      translations: { es: { title: "Dos", achievement: `${mark} logro` } },
    });
    await tips.insert({
      translations: { es: { title: "Tres", keys: ["uno", `${mark} clave`] } },
    });

    const { total } = await search(mark);

    expect(total).toBe(3);
  });

  it("no busca en 'Error común' ni en 'Practícalo'", async () => {
    newMark();
    await tips.insert({
      translations: {
        es: { title: "Uno", commonError: mark, practice: mark },
      },
    });

    expect((await search(mark)).total).toBe(0);
  });

  it("no junta el final de un campo con el comienzo del siguiente", async () => {
    newMark();
    await tips.insert({
      translations: { es: { title: `${mark}al`, achievement: "to" } },
    });

    expect((await search(`${mark}alto`)).total).toBe(0);
  });

  it("ignora tabuladores, saltos de línea y el carácter nulo", async () => {
    newMark();
    await seedMarked("Uno");

    expect(
      (
        await search(`	${mark}\u0000
`)
      ).total,
    ).toBe(1);
  });

  it("trata los comodines como texto", async () => {
    newMark();
    await seedMarked(`${mark} cien`);

    expect((await search(`${mark}%`)).total).toBe(0);
    expect((await search(`${mark}_cien`)).total).toBe(0);
  });

  it("en inglés busca en los textos en inglés y no en los que tapan", async () => {
    newMark();
    await tips.insert({
      translations: {
        es: { title: `${mark} saque` },
        en: { title: `${mark} serve` },
      },
    });

    expect((await search(`${mark} serve`, "en")).total).toBe(1);
    expect((await search(`${mark} saque`, "en")).total).toBe(0);
    expect((await search(`${mark} serve`, "es")).total).toBe(0);
  });

  it("en inglés busca en español los campos que no tienen inglés", async () => {
    newMark();
    await tips.insert({
      translations: {
        es: {
          title: "Saque",
          achievement: `${mark} logro`,
          keys: [`${mark} clave`],
        },
        en: { title: "Serve", achievement: "  " },
      },
    });

    expect((await search(`${mark} logro`, "en")).total).toBe(1);
    expect((await search(`${mark} clave`, "en")).total).toBe(1);
  });

  it("combina la búsqueda con el fundamento y el nivel", async () => {
    newMark();
    await seedMarked("Uno", { fundamental: "reception", level: "basic" });
    await seedMarked("Dos", { fundamental: "reception", level: "advanced" });
    await seedMarked("Tres", { fundamental: "block", level: "basic" });

    const { titles } = await search(mark, "es", {
      fundamental: "reception",
      level: "basic",
    });

    expect(titles).toEqual(["Uno"]);
  });

  it("solo encuentra publicados con fecha pasada", async () => {
    newMark();
    await seedMarked("Publicado");
    await seedMarked("Borrador", { status: "draft", publishedAt: null });
    await seedMarked("Retirado", { status: "retired" });
    await seedMarked("Programado", { publishedAt: daysFromNow(1) });

    expect((await search(mark)).titles).toEqual(["Publicado"]);
  });
});

describeIntegration("tips: listar y leer", () => {
  it("lista del más reciente al más antiguo y cuenta el total al paginar", async () => {
    newMark();
    await seedMarked("Antiguo", { publishedAt: daysFromNow(-3) });
    await seedMarked("Nuevo", { publishedAt: daysFromNow(-1) });
    await seedMarked("Medio", { publishedAt: daysFromNow(-2) });

    const first = await search(mark, "es", { limit: 2 });
    const second = await search(mark, "es", { limit: 2, offset: 2 });

    expect(first.titles).toEqual(["Nuevo", "Medio"]);
    expect(second.titles).toEqual(["Antiguo"]);
    expect([first.total, second.total]).toEqual([3, 3]);
  });

  it.each([1, 40])(
    "una página que empieza en %i, pasado el final, llega vacía con el total",
    async (offset) => {
      newMark();
      await seedMarked("Único");

      const page = await search(mark, "es", { offset });

      expect(page).toMatchObject({ tips: [], total: 1 });
    },
  );

  it.each([-5, Number.NaN, 0.5])(
    "un comienzo de %s se lee como la primera página",
    async (offset) => {
      newMark();
      await seedMarked("Único");

      expect((await search(mark, "es", { offset })).titles).toEqual(["Único"]);
    },
  );

  it.each([1e20, Number.POSITIVE_INFINITY])(
    "un comienzo de %s llega vacío con el total",
    async (offset) => {
      newMark();
      await seedMarked("Único");

      expect(await search(mark, "es", { offset })).toMatchObject({
        tips: [],
        total: 1,
      });
    },
  );

  it.each([0, -1, Number.NaN, 1e20])(
    "un tamaño de página de %s no rompe la lectura",
    async (limit) => {
      newMark();
      await seedMarked("Único");

      expect((await search(mark, "es", { limit })).titles).toEqual(["Único"]);
    },
  );

  it("sin búsqueda ni filtros incluye los publicados", async () => {
    const { slug } = await tips.insert({ publishedAt: new Date() });

    const { tips: listed } = await listPublishedTips("es");

    expect(listed.map((tip) => tip.slug)).toContain(slug);
  });

  it("no cuenta un tip sin español", async () => {
    newMark();
    await tips.insert({ translations: { en: { title: mark } } });

    expect(await search(mark, "en")).toMatchObject({ tips: [], total: 0 });
  });

  it("lee un tip por su slug con sus datos y textos", async () => {
    const { slug, bunnyVideoId } = await tips.insert({
      translations: { es: { title: "Saque" }, en: { title: "Serve" } },
    });

    const tip = await readTipBySlug("en", slug);

    expect(tip).toMatchObject({
      slug,
      bunnyVideoId,
      orientation: "vertical",
      durationSeconds: 42,
      fundamental: "serve",
      level: "basic",
      text: { title: "Serve" },
    });
  });

  it.each([
    ["en borrador", { status: "draft" }],
    ["retirado", { status: "retired" }],
    ["programado", { publishedAt: daysFromNow(1) }],
  ] satisfies [string, TipSeed][])(
    "no lee por slug un tip %s",
    async (_what, rest) => {
      const { slug } = await tips.insert(rest);

      expect(await readTipBySlug("es", slug)).toBeNull();
    },
  );

  it("no encuentra un slug que no existe", async () => {
    expect(await readTipBySlug("es", `${PREFIX}-no-existe`)).toBeNull();
  });
});
