import { RouterContextProvider } from "react-router";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";

import { connectToLocalDatabase, type Database } from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import {
  createTestSession,
  toCookieHeader,
  type TestSession,
} from "~/testing/local-session";
import {
  readLocalSupabaseStatus,
  type LocalSupabaseStatus,
} from "~/testing/local-supabase-status";

// Las preguntas de prueba llevan esta marca para borrarlas sin tocar otras.
const TEST_MARK = "[prueba-panel-faqs]";

type Modules = {
  readonly newRoute: typeof import("~/routes/panel/faq-new");
  readonly editRoute: typeof import("~/routes/panel/faq-edit");
  readonly publishRoute: typeof import("~/routes/panel/faq-publish");
  readonly retireRoute: typeof import("~/routes/panel/faq-retire");
  readonly moveRoute: typeof import("~/routes/panel/faq-move");
  readonly listRoute: typeof import("~/routes/panel/faqs");
  readonly panel: typeof import("~/lib/panel/panel-middleware.server");
  readonly session: typeof import("~/lib/supabase/session-client.server");
  readonly publicFaqs: typeof import("~/lib/faqs.server");
};

// El entorno del servidor se lee al cargar sus módulos: se importan después
// de apuntar las variables a la base local.
async function loadModules(status: LocalSupabaseStatus): Promise<Modules> {
  vi.stubEnv("SUPABASE_URL", status.API_URL);
  vi.stubEnv("SUPABASE_ANON_KEY", status.PUBLISHABLE_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", status.SECRET_KEY);
  return {
    newRoute: await import("~/routes/panel/faq-new"),
    editRoute: await import("~/routes/panel/faq-edit"),
    publishRoute: await import("~/routes/panel/faq-publish"),
    retireRoute: await import("~/routes/panel/faq-retire"),
    moveRoute: await import("~/routes/panel/faq-move"),
    listRoute: await import("~/routes/panel/faqs"),
    panel: await import("~/lib/panel/panel-middleware.server"),
    session: await import("~/lib/supabase/session-client.server"),
    publicFaqs: await import("~/lib/faqs.server"),
  };
}

describeIntegration("preguntas del panel contra la base local", () => {
  let database: Database;
  let modules: Modules;
  let admin: TestSession;
  let staff: TestSession;
  let buyer: TestSession;

  function buildArgs<Args>(
    session: TestSession,
    { fields, faqId }: { fields?: Record<string, string>; faqId?: string } = {},
  ): Args {
    const request = new Request("http://localhost/admin/preguntas", {
      method: fields === undefined ? "GET" : "POST",
      headers: { Cookie: toCookieHeader(session.cookies) },
      body: fields === undefined ? undefined : new URLSearchParams(fields),
    });
    const context = new RouterContextProvider();
    context.set(
      modules.panel.panelSessionContext,
      modules.session.createSessionSupabaseClient(request),
    );
    return { request, context, params: { faqId } } as unknown as Args;
  }

  function clientOf(
    session: TestSession,
  ): ReturnType<Modules["session"]["createSessionSupabaseClient"]>["client"] {
    const request = new Request("http://localhost/admin", {
      headers: { Cookie: toCookieHeader(session.cookies) },
    });
    return modules.session.createSessionSupabaseClient(request).client;
  }

  function fieldsFor(question: string, english = ""): Record<string, string> {
    return {
      "question:es": `${TEST_MARK} ${question}`,
      "answer:es": "Respuesta",
      "question:en": english === "" ? "" : `${TEST_MARK} ${english}`,
      "answer:en": english === "" ? "" : "Answer",
    };
  }

  async function create(question: string, english?: string): Promise<string> {
    const response = (await modules.newRoute.action(
      buildArgs(admin, { fields: fieldsFor(question, english) }),
    )) as Response;
    const location = new URL(
      response.headers.get("Location") ?? "",
      "http://localhost",
    );
    return location.searchParams.get("creada") ?? "";
  }

  function publish(faqId: string): Promise<unknown> {
    return modules.publishRoute.action(buildArgs(admin, { fields: {}, faqId }));
  }

  function retire(faqId: string): Promise<unknown> {
    return modules.retireRoute.action(buildArgs(admin, { fields: {}, faqId }));
  }

  function move(faqId: string, direction: "up" | "down"): Promise<unknown> {
    return modules.moveRoute.action(
      buildArgs(admin, { fields: { direction }, faqId }),
    );
  }

  /** Lo que ve el sitio, solo las preguntas de esta prueba. */
  async function readSite(language: "es" | "en" = "es"): Promise<string[]> {
    const faqs = await modules.publicFaqs.readFaqs(language);
    return faqs
      .map(({ question }) => question)
      .filter((question) => question.startsWith(TEST_MARK))
      .map((question) => question.slice(TEST_MARK.length + 1));
  }

  async function readPanelOrder(): Promise<string[]> {
    const view = await modules.listRoute.loader(buildArgs(admin));
    return view.rows
      .filter(({ question }) => question.startsWith(TEST_MARK))
      .map(({ question }) => question.slice(TEST_MARK.length + 1));
  }

  async function readSortOrders(): Promise<number[]> {
    const rows = await database<{ sort_order: number }[]>`
      select sort_order from public.faqs order by sort_order`;
    return rows.map((row) => row.sort_order);
  }

  async function createThreePublished(): Promise<[string, string, string]> {
    const ids: [string, string, string] = [
      await create("Una"),
      await create("Dos"),
      await create("Tres"),
    ];
    for (const id of ids) await publish(id);
    return ids;
  }

  beforeAll(async () => {
    const status = readLocalSupabaseStatus();
    modules = await loadModules(status);
    database = connectToLocalDatabase();
    admin = await createTestSession(status, { role: "admin" });
    staff = await createTestSession(status, { role: "staff" });
    buyer = await createTestSession(status, { role: "buyer" });
  });

  afterEach(async () => {
    await database`
      delete from public.faqs where id in (
        select faq_id from public.faq_translations
        where question like ${`${TEST_MARK}%`}
      )`;
  });

  // El admin se queda: `audit_log` no deja borrar al autor de una entrada.
  afterAll(async () => {
    vi.unstubAllEnvs();
    await database.end();
  });

  it("nace en borrador, al final, y no sale en el sitio", async () => {
    await create("Una");
    const id = await create("Dos");

    const [row] = await database<{ status: string; is_last: boolean }[]>`
      select status::text as status,
             sort_order = (select max(sort_order) from public.faqs) as is_last
      from public.faqs where id = ${id}`;

    expect(row).toEqual({ status: "draft", is_last: true });
    expect(await readSite()).toEqual([]);
    expect(await readPanelOrder()).toEqual(["Una", "Dos"]);
  });

  it("publicada sale en el sitio en el orden esperado y una retirada no", async () => {
    const [, second] = await createThreePublished();
    expect(await readSite()).toEqual(["Una", "Dos", "Tres"]);

    await retire(second);

    expect(await readSite()).toEqual(["Una", "Tres"]);
    expect(await readPanelOrder()).toEqual(["Una", "Dos", "Tres"]);

    await publish(second);

    expect(await readSite()).toEqual(["Una", "Dos", "Tres"]);
  });

  it("publicada solo en español sale en español en inglés (AC-065)", async () => {
    await publish(await create("Solo español"));

    expect(await readSite("en")).toEqual(["Solo español"]);
  });

  it("con traducción sale en inglés y al quitarla vuelve al español", async () => {
    const id = await create("Envíos", "Shipping");
    await publish(id);
    expect(await readSite("en")).toEqual(["Shipping"]);

    await modules.editRoute.action(
      buildArgs(admin, { fields: fieldsFor("Envíos"), faqId: id }),
    );

    expect(await readSite("en")).toEqual(["Envíos"]);
  });

  it("no publica una pregunta sin español", async () => {
    const response = (await modules.newRoute.action(
      buildArgs(admin, {
        fields: {
          "question:es": "",
          "answer:es": "",
          "question:en": `${TEST_MARK} Only`,
          "answer:en": "Only",
        },
      }),
    )) as Response;
    const id = response.headers.get("Location")?.split("creada=")[1] ?? "";

    const result = await publish(id);

    expect(result).toMatchObject({
      data: { error: "missingDefaultText" },
      init: { status: 400 },
    });
    const [row] = await database<{ status: string }[]>`
      select status::text as status from public.faqs where id = ${id}`;
    expect(row?.status).toBe("draft");
  });

  it("la base no deja a una publicada sin español y no cambia nada", async () => {
    const id = await create("Fija", "Pinned");
    await publish(id);

    const { error } = await clientOf(admin).rpc("save_faq", {
      p_faq_id: id,
      p_translations: [],
      p_removed_locales: ["es"],
    });

    expect(error?.message).toContain("faqs_published_default_text_check");
    expect(await readSite()).toEqual(["Fija"]);
  });

  it("subir y bajar intercambian y el sitio lo refleja", async () => {
    const [first, , third] = await createThreePublished();

    await move(third, "up");
    expect(await readSite()).toEqual(["Una", "Tres", "Dos"]);

    await move(first, "down");
    expect(await readSite()).toEqual(["Tres", "Una", "Dos"]);
    expect(await readPanelOrder()).toEqual(["Tres", "Una", "Dos"]);
  });

  it("en los extremos no cambia nada", async () => {
    const [first, , third] = await createThreePublished();
    const before = await readSortOrders();

    await move(first, "up");
    await move(third, "down");

    expect(await readSite()).toEqual(["Una", "Dos", "Tres"]);
    expect(await readSortOrders()).toEqual(before);
  });

  it("dos cambios a la vez dejan un orden consistente", async () => {
    const [, second, third] = await createThreePublished();

    await Promise.all([move(second, "up"), move(third, "up")]);

    const orders = await readSortOrders();
    expect(new Set(orders).size).toBe(orders.length);
    expect(await readSite()).toHaveLength(3);
  });

  it("ordena también las que comparten el mismo número", async () => {
    const [, second] = await createThreePublished();
    await database`update public.faqs set sort_order = 0`;

    await move(second, "up");

    expect(await readSite()).toEqual(["Dos", "Una", "Tres"]);
    expect(new Set(await readSortOrders()).size).toBe(3);
  });

  it("crear dos a la vez no repite el lugar", async () => {
    await Promise.all([create("Una"), create("Dos"), create("Tres")]);

    const orders = await readSortOrders();

    expect(new Set(orders).size).toBe(orders.length);
  });

  it("cada acción deja su entrada en la bitácora", async () => {
    const id = await create("Registrada");
    await create("Otra");
    await modules.editRoute.action(
      buildArgs(admin, {
        fields: fieldsFor("Registrada", "Logged"),
        faqId: id,
      }),
    );
    await publish(id);
    await retire(id);
    await move(id, "down");

    const rows = await database<{ action: string }[]>`
      select action from public.audit_log
      where entity = 'faq' and entity_id = ${id} order by created_at, action`;

    expect(rows.map(({ action }) => action)).toEqual([
      "faq.create",
      "faq.update",
      "faq.publish",
      "faq.retire",
      "faq.reorder",
    ]);
  });

  it("un id que no existe responde 404", async () => {
    await expect(
      publish("99999999-9999-4999-8999-999999999999"),
    ).rejects.toMatchObject({ init: { status: 404 } });
    await expect(
      move("99999999-9999-4999-8999-999999999999", "up"),
    ).rejects.toMatchObject({ init: { status: 404 } });
  });

  it("ni un admin puede borrar una pregunta", async () => {
    const id = await create("Permanente");

    const { error } = await clientOf(admin).from("faqs").delete().eq("id", id);

    expect(error?.code).toBe("42501");
    expect(await readPanelOrder()).toEqual(["Permanente"]);
  });

  it.each(["staff", "buyer"] as const)(
    "%s no lee borradores ni escribe",
    async (role) => {
      const id = await create("Privada");
      const client = clientOf(role === "staff" ? staff : buyer);

      const read = await client.from("faqs").select("id").eq("id", id);
      const translations = await client
        .from("faq_translations")
        .select("question")
        .eq("faq_id", id);
      const writes = await Promise.all([
        client.rpc("create_faq", { p_translations: [] }),
        client.rpc("save_faq", {
          p_faq_id: id,
          p_translations: [],
          p_removed_locales: ["es"],
        }),
        client.rpc("set_faq_status", {
          p_faq_id: id,
          p_status: "published",
        }),
        client.rpc("move_faq", { p_faq_id: id, p_direction: "up" }),
      ]);

      expect(read.data).toEqual([]);
      expect(translations.data).toEqual([]);
      expect(writes.map(({ error }) => error?.code)).toEqual(
        Array(writes.length).fill("42501"),
      );
      expect(await readPanelOrder()).toEqual(["Privada"]);
      expect(await readSite()).toEqual([]);
    },
  );
});
