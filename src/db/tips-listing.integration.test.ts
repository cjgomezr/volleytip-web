import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import { loadTipsListing } from "~/lib/tips-listing.server";
import { connectToLocalDatabase, type Database } from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import {
  createTipRows,
  daysFromNow,
  type SeededTip,
  type TipRows,
  type TipSeed,
} from "~/testing/tip-rows";

const PREFIX = "prueba-tips-listado";
const PAGE_SIZE = 20;

let database: Database;
let tips: TipRows;
// Va en los textos para buscar solo los tips de cada prueba.
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

function seedMarked(seed: TipSeed = {}): Promise<SeededTip> {
  return tips.insert({
    translations: { es: { title: `Saque ${mark}` } },
    ...seed,
  });
}

describeIntegration("listado de tips: lectura", () => {
  it("solo salen los publicados con fecha pasada, del más reciente al más antiguo", async () => {
    newMark();
    const older = await seedMarked({ publishedAt: daysFromNow(-3) });
    const newer = await seedMarked({ publishedAt: daysFromNow(-2) });
    await seedMarked({ publishedAt: daysFromNow(2) });
    await seedMarked({ status: "retired" });
    await seedMarked({ status: "draft" });

    const listing = await loadTipsListing("es", { query: mark, page: 1 });

    expect(listing.tips.map(({ slug }) => slug)).toEqual([
      newer.slug,
      older.slug,
    ]);
    expect(listing.total).toBe(2);
  });

  it("el contador del encabezado cuenta solo los publicados", async () => {
    newMark();
    const before = await loadTipsListing("es", { query: "", page: 1 });
    await seedMarked();
    await seedMarked({ status: "retired" });

    const after = await loadTipsListing("es", { query: mark, page: 1 });

    expect(after.publishedTotal).toBe(before.publishedTotal + 1);
  });
});

describeIntegration("listado de tips: paginación", () => {
  it("trae 20 por página, la segunda sigue donde quedó y la última no ofrece más", async () => {
    newMark();
    const seeded: SeededTip[] = [];
    for (let daysAgo = 1; daysAgo <= PAGE_SIZE + 2; daysAgo += 1) {
      seeded.push(await seedMarked({ publishedAt: daysFromNow(-daysAgo) }));
    }

    const first = await loadTipsListing("es", { query: mark, page: 1 });
    const second = await loadTipsListing("es", { query: mark, page: 2 });

    expect(first.tips).toHaveLength(PAGE_SIZE);
    expect(first.hasNextPage).toBe(true);
    expect(second.tips.map(({ slug }) => slug)).toEqual(
      seeded.slice(PAGE_SIZE).map(({ slug }) => slug),
    );
    expect(second.hasNextPage).toBe(false);
  });
});

describeIntegration("listado de tips: último video", () => {
  it("el destacado gana al más reciente", async () => {
    newMark();
    const featured = await seedMarked({
      publishedAt: daysFromNow(-5),
      isFeatured: true,
    });
    await seedMarked({ publishedAt: new Date() });

    const listing = await loadTipsListing("es", { query: "", page: 1 });

    expect(listing.latestTip?.slug).toBe(featured.slug);
  });

  it("sin destacado es el más reciente", async () => {
    newMark();
    await seedMarked({ publishedAt: daysFromNow(-5) });
    const newest = await seedMarked({ publishedAt: new Date() });

    const listing = await loadTipsListing("es", { query: "", page: 1 });

    expect(listing.latestTip?.slug).toBe(newest.slug);
  });

  it("un destacado programado no se adelanta", async () => {
    newMark();
    await seedMarked({ publishedAt: daysFromNow(5), isFeatured: true });
    const newest = await seedMarked({ publishedAt: new Date() });

    const listing = await loadTipsListing("es", { query: "", page: 1 });

    expect(listing.latestTip?.slug).toBe(newest.slug);
  });
});
