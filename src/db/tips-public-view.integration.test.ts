import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import type { Database as GeneratedDatabase } from "~/lib/database.types";
import { createAnonSupabaseClient } from "~/lib/supabase/anon-client.server";
import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  runAs,
  takeOnlyRow,
  type Database,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import { createTipRows, daysFromNow, type TipRows } from "~/testing/tip-rows";

type PublicTipRow = GeneratedDatabase["public"]["Views"]["public_tips"]["Row"];

const PREFIX = "prueba-tips-vista";
const LIKE_PREFIX = `${PREFIX}-%`;
// Lo que lee la app. Cambiar esta lista es un cambio que la puede romper.
const VIEW_COLUMNS = [
  "bunny_video_id",
  "duration_seconds",
  "fundamental",
  "id",
  "is_featured",
  "level",
  "orientation",
  "promo",
  "published_at",
  "slug",
  "thumbnail_url",
  "tiktok_url",
  "translations",
];

let database: Database;
let tips: TipRows;

beforeAll(() => {
  database = connectToLocalDatabase();
  tips = createTipRows(database, PREFIX);
});

afterEach(() => tips.removeAll());

afterAll(async () => {
  await deleteTestUsers(database);
  await database.end();
});

async function readPublicView(): Promise<PublicTipRow[]> {
  const { data, error } = await createAnonSupabaseClient()
    .from("public_tips")
    .select("*")
    .like("slug", LIKE_PREFIX);
  if (error !== null) {
    throw error;
  }
  return data;
}

describeIntegration("tips: public_tips", () => {
  it("con la llave pública devuelve solo los publicados, con traducciones y video (AC-034)", async () => {
    const published = await tips.insert({
      translations: {
        es: { title: "Saque", keys: ["Mano firme"] },
        en: { title: "Serve", achievement: "No spin" },
      },
    });
    await tips.insert({ status: "draft", publishedAt: null });
    await tips.insert({ status: "retired" });
    await tips.insert({ publishedAt: daysFromNow(1) });

    const rows = await readPublicView();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      slug: published.slug,
      bunny_video_id: published.bunnyVideoId,
      translations: {
        es: {
          title: "Saque",
          achievement: null,
          keys: ["Mano firme"],
          common_error: null,
          practice: null,
        },
        en: { title: "Serve", achievement: "No spin", keys: [] },
      },
    });
  });

  it("no expone el estado ni las fechas internas", async () => {
    await tips.insert();

    const [row] = await readPublicView();

    expect(Object.keys(row ?? {}).sort()).toEqual(VIEW_COLUMNS);
  });

  it("trae un objeto vacío de traducciones en un tip sin textos", async () => {
    await tips.insert({ translations: {} });

    const [row] = await readPublicView();

    expect(row?.translations).toEqual({});
  });

  it("a un admin tampoco le muestra lo que no está publicado", async () => {
    await tips.insert({ status: "draft", publishedAt: null });
    await tips.insert({ publishedAt: daysFromNow(1) });
    const admin = await createTestUser(database, { role: "admin" });

    const rows = await runAs(
      database,
      { kind: "signedIn", userId: admin.id },
      (transaction) =>
        transaction`select id from public.public_tips where slug like ${LIKE_PREFIX}`,
    );

    expect([...rows]).toEqual([]);
  });

  it("respeta el RLS de quien consulta", async () => {
    const rows = await database<{ options: string[] | null }[]>`
      select reloptions as options from pg_class
      where oid = 'public.public_tips'::regclass
    `;

    expect(takeOnlyRow(rows, "public_tips").options).toContain(
      "security_invoker=true",
    );
  });

  it.each(["anon", "authenticated"])(
    "el rol %s solo puede leer la vista",
    async (role) => {
      const rows = await database<{ can_read: boolean; can_write: boolean }[]>`
        select
          has_table_privilege(${role}, 'public.public_tips', 'select') as can_read,
          has_table_privilege(
            ${role}, 'public.public_tips', 'insert, update, delete'
          ) as can_write
      `;

      expect(takeOnlyRow(rows, "privilegios")).toEqual({
        can_read: true,
        can_write: false,
      });
    },
  );
});
