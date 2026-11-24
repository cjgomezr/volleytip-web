import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";

import { readFaqs } from "~/lib/faqs.server";
import { createAnonSupabaseClient } from "~/lib/supabase/anon-client.server";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";
import {
  connectToLocalDatabase,
  createTestUser,
  deleteTestUsers,
  runAs,
  takeOnlyRow,
  type Database,
  type Session,
  type TestUser,
} from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";

type FaqStatus = "draft" | "published" | "retired";

interface TranslationSeed {
  readonly locale: "es" | "en";
  readonly question: string;
  readonly answer: string;
}

const ANONYMOUS: Session = { kind: "anonymous" };
const PERMISSION_DENIED = /permission denied|row-level security/i;
// Las preguntas de prueba llevan esta marca para borrarlas sin tocar otras.
const TEST_MARK = "[prueba-faqs]";
const LIKE_TEST_MARK = `${TEST_MARK}%`;

let database: Database;
let anon: TypedSupabaseClient;

function signedInAs(user: TestUser): Session {
  return { kind: "signedIn", userId: user.id };
}

async function seedFaq(
  status: FaqStatus,
  sortOrder: number,
  translations: readonly TranslationSeed[],
): Promise<string> {
  const { id } = takeOnlyRow(
    await database<{ id: string }[]>`
      insert into public.faqs (status, sort_order)
      values (${status}, ${sortOrder}) returning id
    `,
    "faqs",
  );
  for (const { locale, question, answer } of translations) {
    await database`
      insert into public.faq_translations (faq_id, locale, question, answer)
      values (${id}, ${locale}, ${`${TEST_MARK} ${question}`}, ${answer})
    `;
  }
  return id;
}

function spanish(question: string, answer = "Respuesta"): TranslationSeed {
  return { locale: "es", question, answer };
}

async function readMarkedQuestions(language: "es" | "en"): Promise<string[]> {
  const faqs = await readFaqs(language, { client: anon });
  return faqs
    .map(({ question }) => question)
    .filter((question) => question.startsWith(TEST_MARK));
}

beforeAll(() => {
  database = connectToLocalDatabase();
  anon = createAnonSupabaseClient();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await database`
    delete from public.faqs where id in (
      select faq_id from public.faq_translations where question like ${LIKE_TEST_MARK}
    )
  `;
});

afterAll(async () => {
  await deleteTestUsers(database);
  await database.end();
});

describeIntegration("faqs: esquema", () => {
  it("nace sin preguntas ni traducciones", async () => {
    const [counts] = await database<{ faqs: number; translations: number }[]>`
      select (select count(*)::int from public.faqs) as faqs,
             (select count(*)::int from public.faq_translations) as translations
    `;

    expect(counts).toEqual({ faqs: 0, translations: 0 });
  });

  it("usa el tipo publish_status en status", async () => {
    const rows = await database<{ udt_name: string }[]>`
      select udt_name from information_schema.columns
      where table_schema = 'public' and table_name = 'faqs' and column_name = 'status'
    `;

    expect(takeOnlyRow(rows, "columna status").udt_name).toBe("publish_status");
  });

  it("admite una sola traducción por pregunta e idioma", async () => {
    const id = await seedFaq("draft", 1, [spanish("Única")]);

    await expect(
      database`
        insert into public.faq_translations (faq_id, locale, question, answer)
        values (${id}, 'es', ${`${TEST_MARK} otra`}, 'otra')
      `,
    ).rejects.toThrow(/faq_translations_pkey/);
  });

  it("tiene RLS activado y comentario de ámbito en las dos tablas", async () => {
    const rows = await database<
      { name: string; has_rls: boolean; comment: string | null }[]
    >`
      select c.relname::text as name, c.relrowsecurity as has_rls,
             obj_description(c.oid, 'pg_class') as comment
      from pg_class c
      where c.relnamespace = 'public'::regnamespace
        and c.relname in ('faqs', 'faq_translations')
    `;

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.has_rls).toBe(true);
      expect(row.comment).toMatch(/^scope: web\./);
    }
  });
});

describeIntegration("faqs: permisos", () => {
  it("el anónimo lee las publicadas y sus traducciones", async () => {
    await seedFaq("published", 1, [spanish("Publicada")]);

    const rows = await runAs(
      database,
      ANONYMOUS,
      (transaction) =>
        transaction`select question from public.faq_translations where question like ${LIKE_TEST_MARK}`,
    );

    expect(rows).toHaveLength(1);
  });

  it("el anónimo no ve borradores ni retiradas ni sus traducciones", async () => {
    await seedFaq("draft", 1, [spanish("Borrador")]);
    await seedFaq("retired", 2, [spanish("Retirada")]);

    const translations = await runAs(
      database,
      ANONYMOUS,
      (transaction) =>
        transaction`select question from public.faq_translations where question like ${LIKE_TEST_MARK}`,
    );
    const faqs = await runAs(
      database,
      ANONYMOUS,
      (transaction) =>
        transaction`select id from public.faqs where status <> 'published'`,
    );

    expect(translations).toEqual([]);
    expect(faqs).toEqual([]);
  });

  it("el anónimo no puede escribir", async () => {
    await expect(
      runAs(
        database,
        ANONYMOUS,
        (transaction) =>
          transaction`insert into public.faqs (status) values ('published')`,
      ),
    ).rejects.toThrow(PERMISSION_DENIED);
  });

  it("un comprador no puede escribir", async () => {
    const buyer = await createTestUser(database, { role: "buyer" });

    await expect(
      runAs(
        database,
        signedInAs(buyer),
        (transaction) =>
          transaction`insert into public.faqs (status) values ('published')`,
      ),
    ).rejects.toThrow(PERMISSION_DENIED);
  });

  it("un admin lee todo y escribe", async () => {
    const admin = await createTestUser(database, { role: "admin" });
    await seedFaq("draft", 1, [spanish("Borrador")]);

    const visible = await runAs(
      database,
      signedInAs(admin),
      (transaction) =>
        transaction`select question from public.faq_translations where question like ${LIKE_TEST_MARK}`,
    );
    const inserted = await runAs(
      database,
      signedInAs(admin),
      (transaction) =>
        transaction`insert into public.faqs (status) values ('draft') returning id`,
    );
    await database`delete from public.faqs where id = ${takeOnlyRow(inserted, "faqs").id}`;

    expect(visible).toHaveLength(1);
  });
});

describeIntegration("faqs: lector", () => {
  it("devuelve las publicadas en el orden de sort_order", async () => {
    await seedFaq("published", 3, [spanish("Tercera")]);
    await seedFaq("published", 1, [spanish("Primera")]);
    await seedFaq("published", 2, [spanish("Segunda")]);

    expect(await readMarkedQuestions("es")).toEqual([
      `${TEST_MARK} Primera`,
      `${TEST_MARK} Segunda`,
      `${TEST_MARK} Tercera`,
    ]);
  });

  it("no devuelve borradores ni retiradas", async () => {
    await seedFaq("draft", 1, [spanish("Borrador")]);
    await seedFaq("retired", 2, [spanish("Retirada")]);

    expect(await readMarkedQuestions("es")).toEqual([]);
  });

  it("usa el inglés cuando existe", async () => {
    await seedFaq("published", 1, [
      spanish("Hola", "Respuesta es"),
      { locale: "en", question: "Hello", answer: "Answer en" },
    ]);

    const [faq] = await readFaqs("en", { client: anon });

    expect(faq).toMatchObject({
      question: `${TEST_MARK} Hello`,
      questionLanguage: "en",
      answer: "Answer en",
      answerLanguage: "en",
    });
  });

  it("cae al español cuando no hay versión en inglés", async () => {
    await seedFaq("published", 1, [spanish("Solo español", "Solo respuesta")]);

    const [faq] = await readFaqs("en", { client: anon });

    expect(faq).toMatchObject({
      questionLanguage: "es",
      answer: "Solo respuesta",
      answerLanguage: "es",
    });
  });

  it("resuelve campo por campo: pregunta en inglés y respuesta en español", async () => {
    await seedFaq("published", 1, [
      spanish("Pregunta", "Respuesta en español"),
      { locale: "en", question: "Question", answer: "   " },
    ]);

    const [faq] = await readFaqs("en", { client: anon });

    expect(faq).toMatchObject({
      question: `${TEST_MARK} Question`,
      questionLanguage: "en",
      answer: "Respuesta en español",
      answerLanguage: "es",
    });
  });

  it("omite la pregunta sin español y deja el error en el registro", async () => {
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    await seedFaq("published", 1, [
      { locale: "en", question: "Only English", answer: "Only" },
    ]);
    await seedFaq("published", 2, [spanish("Con español")]);

    const questions = await readMarkedQuestions("en");

    expect(questions).toEqual([`${TEST_MARK} Con español`]);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("acepta un límite y devuelve solo las primeras", async () => {
    await seedFaq("published", 1, [spanish("Una")]);
    await seedFaq("published", 2, [spanish("Dos")]);
    await seedFaq("published", 3, [spanish("Tres")]);

    const faqs = await readFaqs("es", { client: anon, limit: 2 });

    expect(faqs.map(({ question }) => question)).toEqual([
      `${TEST_MARK} Una`,
      `${TEST_MARK} Dos`,
    ]);
  });
});
