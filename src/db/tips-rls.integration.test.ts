import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";

import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  runAs,
  takeOnlyRow,
  type Database,
  type Session,
  type UserRole,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import {
  createTipRows,
  daysFromNow,
  type SeededTip,
  type TipRows,
} from "~/testing/tip-rows";

const PREFIX = "prueba-tips-rls";
const LIKE_PREFIX = `${PREFIX}-%`;
const PERMISSION_DENIED = /permission denied|row-level security/i;

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

async function signIn(role: UserRole): Promise<Session> {
  const user = await createTestUser(database, { role });
  return { kind: "signedIn", userId: user.id };
}

type Visitor = UserRole | "anonymous" | "service";

async function openSession(who: Visitor): Promise<Session> {
  return who === "anonymous" || who === "service" ? { kind: who } : signIn(who);
}

/** Un publicado y, detrás, todo lo que el público no debe ver. */
async function seedEveryState(): Promise<readonly [SeededTip, SeededTip[]]> {
  const published = await tips.insert();
  const hidden = [
    await tips.insert({ status: "draft", publishedAt: null }),
    // Un borrador o un retirado con fecha pasada tampoco se ven.
    await tips.insert({ status: "draft" }),
    await tips.insert({ status: "retired" }),
    await tips.insert({ publishedAt: daysFromNow(1) }),
  ];
  return [published, hidden];
}

async function readVisibleSlugs(session: Session): Promise<string[]> {
  const rows = await runAs(
    database,
    session,
    (transaction) =>
      transaction<{ slug: string }[]>`
        select slug from public.tips where slug like ${LIKE_PREFIX}
      `,
  );
  return rows.map(({ slug }) => slug);
}

/** De los tips dados, de cuáles ve textos esta sesión. */
async function readTranslatedIds(
  session: Session,
  seeded: readonly SeededTip[],
): Promise<string[]> {
  const ids = seeded.map(({ id }) => id);
  const rows = await runAs(
    database,
    session,
    (transaction) =>
      transaction<{ tip_id: string }[]>`
        select tip_id from public.tip_translations
        where tip_id in ${transaction(ids)}
      `,
  );
  return rows.map(({ tip_id }) => tip_id);
}

describeIntegration("tips: RLS", () => {
  it.each(["anonymous", "buyer", "staff"] as const)(
    "%s lee solo los publicados con fecha pasada y sus textos",
    async (who) => {
      const [published, hidden] = await seedEveryState();
      const session = await openSession(who);

      const slugs = await readVisibleSlugs(session);
      const translated = await readTranslatedIds(session, [
        published,
        ...hidden,
      ]);

      expect(slugs).toEqual([published.slug]);
      expect(translated).toEqual([published.id]);
    },
  );

  it.each(["anonymous", "buyer", "staff"] as const)(
    "%s no crea tips ni traducciones",
    async (who) => {
      const { id } = await tips.insert();
      const session = await openSession(who);
      const slug = `${PREFIX}-${randomUUID()}`;

      await expect(
        runAs(
          database,
          session,
          (transaction) =>
            transaction`insert into public.tips (slug) values (${slug})`,
        ),
      ).rejects.toThrow(PERMISSION_DENIED);
      await expect(
        runAs(
          database,
          session,
          (transaction) =>
            transaction`
              insert into public.tip_translations (tip_id, locale, title)
              values (${id}, 'en', 'Intruder')
            `,
        ),
      ).rejects.toThrow(PERMISSION_DENIED);
    },
  );

  it.each(["buyer", "staff"] as const)(
    "un %s no cambia ni quita nada",
    async (role) => {
      const { id } = await tips.insert();
      const session = await signIn(role);

      // Sin política que le dé la fila, el cambio no toca ninguna.
      const changed = await runAs(database, session, async (transaction) => [
        ...(await transaction`
          update public.tips set duration_seconds = 1 where id = ${id}
          returning id
        `),
        ...(await transaction`
          update public.tip_translations set title = 'Intruso'
          where tip_id = ${id} returning tip_id
        `),
        ...(await transaction`
          delete from public.tip_translations where tip_id = ${id}
          returning tip_id
        `),
      ]);

      expect(changed).toEqual([]);
    },
  );

  it("un admin lee todos los tips y sus textos", async () => {
    const [published, hidden] = await seedEveryState();
    const all = [published, ...hidden];
    const session = await signIn("admin");

    const slugs = await readVisibleSlugs(session);
    const translated = await readTranslatedIds(session, all);

    expect(slugs.sort()).toEqual(all.map(({ slug }) => slug).sort());
    expect(translated.sort()).toEqual(all.map(({ id }) => id).sort());
  });

  it("un admin crea y cambia tips y traducciones", async () => {
    const session = await signIn("admin");
    const slug = `${PREFIX}-${randomUUID()}`;

    const saved = await runAs(database, session, async (transaction) => {
      const { id } = takeOnlyRow(
        await transaction<{ id: string }[]>`
          insert into public.tips (slug) values (${slug}) returning id
        `,
        "tips",
      );
      await transaction`
        insert into public.tip_translations (tip_id, locale, title)
        values (${id}, 'es', 'Saque'), (${id}, 'en', 'Serve')
      `;
      await transaction`
        update public.tips set fundamental = 'block' where id = ${id}
      `;
      await transaction`
        update public.tip_translations set title = 'Saque alto'
        where tip_id = ${id} and locale = 'es'
      `;
      // Un idioma que se vacía en el editor se quita.
      await transaction`
        delete from public.tip_translations
        where tip_id = ${id} and locale = 'en'
      `;
      return transaction`
        select tip.fundamental, translation.title
        from public.tips as tip
        join public.tip_translations as translation on translation.tip_id = tip.id
        where tip.id = ${id}
      `;
    });

    expect([...saved]).toEqual([{ fundamental: "block", title: "Saque alto" }]);
  });

  it.each(["anonymous", "buyer", "staff", "admin", "service"] as const)(
    "%s no borra un tip",
    async (who) => {
      const { id } = await tips.insert();
      const session = await openSession(who);

      await expect(
        runAs(
          database,
          session,
          (transaction) =>
            transaction`delete from public.tips where id = ${id}`,
        ),
      ).rejects.toThrow(PERMISSION_DENIED);
    },
  );

  it.each(["anon", "authenticated", "service_role"])(
    "el rol %s no puede borrar ni vaciar la tabla de tips",
    async (role) => {
      const rows = await database<{ can_remove: boolean }[]>`
        select has_table_privilege(${role}, 'public.tips', 'delete, truncate')
          as can_remove
      `;

      expect(takeOnlyRow(rows, "privilegios").can_remove).toBe(false);
    },
  );

  it.each(["public.tips", "public.tip_translations"])(
    "sin sesión no hay permiso de escribir en %s",
    async (table) => {
      const rows = await database<{ can_write: boolean }[]>`
        select has_table_privilege(
          'anon', ${table}, 'insert, update, delete, truncate'
        ) as can_write
      `;

      expect(takeOnlyRow(rows, "privilegios").can_write).toBe(false);
    },
  );

  it("ninguna función de public borra tips", async () => {
    const rows = await database<{ name: string }[]>`
      select proname::text as name from pg_proc
      where pronamespace = 'public'::regnamespace
        and prosrc ~* 'delete\\s+from\\s+(public\\.)?tips\\M'
    `;

    expect([...rows]).toEqual([]);
  });
});
