import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PANEL_ADMIN_PAGES } from "~/lib/i18n/panel-pages";
import {
  panelMemberContext,
  panelSessionContext,
  requireAdmin,
  requirePanelMember,
} from "~/lib/panel/panel-middleware.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import {
  BOTH_LANGUAGES,
  stubFaqsApi,
  type FakeFaqRow,
} from "~/testing/fake-faqs-api";
import {
  ADMIN_PROFILE,
  buildSessionCookie,
  FAKE_USER_ID,
} from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";
import { action as updateFaq, loader as loadEditor } from "./faq-edit";
import { action as moveFaq } from "./faq-move";
import { action as createFaq, loader as loadNew } from "./faq-new";
import { action as publishFaq } from "./faq-publish";
import { action as retireFaq } from "./faq-retire";
import { ErrorBoundary as listBoundary, loader as loadList } from "./faqs";

type Fields = Record<string, string>;

const FIRST_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const THIRD_ID = "33333333-3333-4333-8333-333333333333";
const MISSING_ID = "99999999-9999-4999-8999-999999999999";
const QUESTION_LIMIT = 200;
const ANSWER_LIMIT = 2000;

const SPANISH = { locale: "es", question: "¿Hacen envíos?", answer: "Sí." };
const ENGLISH = { locale: "en", question: "Do you ship?", answer: "Yes." };

const FAQS: readonly FakeFaqRow[] = [
  { id: FIRST_ID, status: "published", faq_translations: [SPANISH] },
  {
    id: SECOND_ID,
    status: "draft",
    faq_translations: [{ ...ENGLISH, question: "Only English" }],
  },
  { id: THIRD_ID, status: "retired", faq_translations: [SPANISH, ENGLISH] },
];

const DEFAULT_TEXT_REJECTION = {
  status: 400,
  code: "23514",
  message: "faqs_published_default_text_check: falta",
};

const STALE_REJECTION = {
  status: 400,
  code: "23514",
  message: "faqs_stale_translation_check: cambió",
};

const UNKNOWN_FAQ = { status: 400, code: "P0002", message: "no existe" };

function buildRequestArgs<Args>(
  path: string,
  { fields, faqId }: { fields?: Fields; faqId?: string } = {},
): Args {
  const request = new Request(`http://localhost${path}`, {
    method: fields === undefined ? "GET" : "POST",
    headers: { Cookie: buildSessionCookie(TEST_ENV.SUPABASE_URL) },
    body: fields === undefined ? undefined : new URLSearchParams(fields),
  });
  const context = new RouterContextProvider();
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  return { request, context, params: { faqId } } as unknown as Args;
}

function list(path = "/admin/preguntas"): ReturnType<typeof loadList> {
  return loadList(buildRequestArgs(path));
}

function edit(faqId: string): ReturnType<typeof loadEditor> {
  return loadEditor(buildRequestArgs(`/admin/preguntas/${faqId}`, { faqId }));
}

function texts(changes: Fields = {}): Fields {
  return {
    "question:es": SPANISH.question,
    "answer:es": SPANISH.answer,
    "question:en": "",
    "answer:en": "",
    ...changes,
  };
}

/** Los campos de una pregunta que solo está en inglés. */
function englishOnly(): Fields {
  return texts({
    "question:es": "",
    "answer:es": "",
    "question:en": ENGLISH.question,
    "answer:en": ENGLISH.answer,
  });
}

function submitNew(fields: Fields): ReturnType<typeof createFaq> {
  return createFaq(buildRequestArgs("/admin/preguntas/nueva", { fields }));
}

/** Lo que el editor mandó pintado: los textos guardados cuando se abrió. */
function paintedFields(faqId: string): Fields {
  const stored = FAQS.find(({ id }) => id === faqId)?.faq_translations ?? [];
  return Object.fromEntries(
    ["es", "en"].flatMap((code) => {
      const text = stored.find(({ locale }) => locale === code);
      return [
        [`base:question:${code}`, text?.question ?? ""],
        [`base:answer:${code}`, text?.answer ?? ""],
      ];
    }),
  );
}

function submitEdit(
  faqId: string,
  fields: Fields,
  painted: Fields = paintedFields(faqId),
): ReturnType<typeof updateFaq> {
  return updateFaq(
    buildRequestArgs(`/admin/preguntas/${faqId}`, {
      fields: { ...painted, ...fields },
      faqId,
    }),
  );
}

/** Lo que `save_faq` devuelve: las traducciones antes y después. */
function savedResult(
  before: object,
  after: object,
): Readonly<Record<string, unknown>> {
  return { save_faq: { before, after } };
}

type StatusArgs = Parameters<typeof publishFaq>[0] &
  Parameters<typeof retireFaq>[0];

function submitStatus(
  action: typeof publishFaq | typeof retireFaq,
  faqId: string,
): ReturnType<typeof publishFaq> {
  const args = buildRequestArgs<StatusArgs>(
    `/admin/preguntas/${faqId}/publicar`,
    { fields: {}, faqId },
  );
  return action(args);
}

function submitMove(
  faqId: string,
  direction: string,
): ReturnType<typeof moveFaq> {
  return moveFaq(
    buildRequestArgs(`/admin/preguntas/${faqId}/mover`, {
      fields: { direction },
      faqId,
    }),
  );
}

/** El estado y el cuerpo de lo que responde un `action`. */
function readResult(result: unknown): { status: number; body: unknown } {
  const { data, init } = result as {
    data?: unknown;
    init?: ResponseInit | null;
  };
  return data === undefined
    ? { status: 200, body: result }
    : { status: init?.status ?? 200, body: data };
}

const NOT_FOUND = { init: { status: 404 } };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("preguntas: lista", () => {
  it("muestra los tres estados en el orden de la base, con sus idiomas", async () => {
    stubFaqsApi({ faqs: FAQS });

    const { rows } = await list();

    expect(rows.map(({ id, status }) => [id, status])).toEqual([
      [FIRST_ID, "published"],
      [SECOND_ID, "draft"],
      [THIRD_ID, "retired"],
    ]);
    expect(rows[0]?.languages).toEqual([
      { code: "es", name: "español", isDefault: true, isTranslated: true },
      { code: "en", name: "inglés", isDefault: false, isTranslated: false },
    ]);
    expect(rows[2]?.languages.map(({ isTranslated }) => isTranslated)).toEqual([
      true,
      true,
    ]);
  });

  it("pide todas a la base, en el mismo orden que el sitio", async () => {
    const api = stubFaqsApi({ faqs: FAQS });

    await list();

    expect(api.faqReads).toHaveLength(1);
    expect(api.faqReads[0]).toContain(
      "order=sort_order.asc%2Ccreated_at.asc%2Cid.asc",
    );
    expect(api.faqReads[0]).not.toContain("status=");
  });

  it("la titula en español y, sin él, con el idioma que tenga", async () => {
    stubFaqsApi({ faqs: FAQS });

    const { rows } = await list();

    expect(rows[0]).toMatchObject({
      question: SPANISH.question,
      questionLanguage: "es",
    });
    expect(rows[1]).toMatchObject({
      question: "Only English",
      questionLanguage: "en",
    });
  });

  it("una traducción a medias no cuenta como idioma presente", async () => {
    stubFaqsApi({
      faqs: [
        {
          id: FIRST_ID,
          status: "published",
          faq_translations: [SPANISH, { ...ENGLISH, answer: "  " }],
        },
      ],
    });

    const { rows } = await list();

    expect(rows[0]?.languages[1]?.isTranslated).toBe(false);
  });

  it("no lista los idiomas desactivados", async () => {
    stubFaqsApi({
      faqs: FAQS,
      languages: [
        BOTH_LANGUAGES[0],
        { ...BOTH_LANGUAGES[1], is_active: false },
      ],
    });

    const { rows } = await list();

    expect(rows[0]?.languages.map(({ code }) => code)).toEqual(["es"]);
  });

  // El fallo de un botón va al límite de la ruta de la lista, no al de la
  // ruta que lo recibió: sin él se pierde la cáscara.
  it("tiene su límite de error dentro de la cáscara", () => {
    expect(listBoundary).toBeTypeOf("function");
  });

  it("vacía: no trae filas", async () => {
    stubFaqsApi();

    expect((await list()).rows).toEqual([]);
  });

  it("avisa de la pregunta recién creada que nombra la dirección", async () => {
    stubFaqsApi({ faqs: FAQS });

    const { createdId } = await list(`/admin/preguntas?creada=${SECOND_ID}`);

    expect(createdId).toBe(SECOND_ID);
  });

  it.each([MISSING_ID, FIRST_ID])(
    "no avisa si %s no es un borrador de la lista",
    async (id) => {
      stubFaqsApi({ faqs: FAQS });

      const { createdId } = await list(`/admin/preguntas?creada=${id}`);

      expect(createdId).toBeNull();
    },
  );
});

describe("preguntas: crear y editar", () => {
  it("el editor nuevo trae una pestaña vacía por idioma activo", async () => {
    stubFaqsApi();

    const view = await loadNew(buildRequestArgs("/admin/preguntas/nueva"));

    expect(view.faqId).toBeNull();
    expect(view.languages).toEqual([
      { code: "es", name: "Español", isDefault: true, isTranslated: false },
      { code: "en", name: "English", isDefault: false, isTranslated: false },
    ]);
    expect(view.limits).toEqual({
      question: QUESTION_LIMIT,
      answer: ANSWER_LIMIT,
    });
  });

  it("las pestañas salen de la tabla de idiomas", async () => {
    stubFaqsApi({
      languages: [
        ...BOTH_LANGUAGES,
        { code: "pt", name: "Português", is_default: false, is_active: true },
      ],
    });

    const view = await loadNew(buildRequestArgs("/admin/preguntas/nueva"));

    expect(view.languages.map(({ code }) => code)).toEqual(["es", "en", "pt"]);
  });

  it("el editor trae los textos y marca qué idiomas tienen traducción", async () => {
    stubFaqsApi({ faqs: FAQS });

    const view = await edit(FIRST_ID);

    expect(view).toMatchObject({
      faqId: FIRST_ID,
      status: "published",
      texts: { es: { question: SPANISH.question, answer: SPANISH.answer } },
    });
    expect(view.languages.map(({ isTranslated }) => isTranslated)).toEqual([
      true,
      false,
    ]);
  });

  it.each([MISSING_ID, "no-es-un-id"])(
    "un id que no existe (%s) responde 404",
    async (faqId) => {
      const api = stubFaqsApi({ faqs: FAQS });

      await expect(edit(faqId)).rejects.toMatchObject(NOT_FOUND);
      await expect(submitEdit(faqId, texts())).rejects.toMatchObject(NOT_FOUND);
      expect(api.rpcCalls).toEqual([]);
    },
  );

  it("crea con la función de la base, con la sesión, y vuelve a la lista", async () => {
    const api = stubFaqsApi({
      rpcResults: { create_faq: { id: THIRD_ID, sort_order: 4 } },
    });

    const result = (await submitNew(
      texts({ "question:es": `  ${SPANISH.question}\t` }),
    )) as Response;

    expect(result.status).toBe(303);
    expect(result.headers.get("Location")).toBe(
      `/admin/preguntas?creada=${THIRD_ID}`,
    );
    expect(api.rpcCalls).toEqual([
      {
        name: "create_faq",
        body: { p_translations: [SPANISH] },
        authorization: "Bearer acceso-vigente",
      },
    ]);
  });

  it("deja crear un borrador solo en inglés", async () => {
    const api = stubFaqsApi({
      rpcResults: { create_faq: { id: THIRD_ID, sort_order: 1 } },
    });

    await submitNew(englishOnly());

    expect(api.rpcCalls[0]?.body).toEqual({ p_translations: [ENGLISH] });
  });

  it.each([
    ["answer:en", { "question:en": "Do you ship?" }],
    ["question:en", { "answer:en": "Yes." }],
    ["answer:es", { "answer:es": "   " }],
    ["question:es", { "question:es": "​" }],
  ])(
    "una traducción lleva las dos mitades o ninguna: marca %s",
    async (field, changes) => {
      const api = stubFaqsApi();

      const { status, body } = readResult(await submitNew(texts(changes)));

      expect(status).toBe(400);
      expect(body).toMatchObject({
        status: "invalid",
        fieldErrors: { [field]: "required" },
      });
      expect(api.rpcCalls).toEqual([]);
    },
  );

  it("sin ningún idioma se rechaza", async () => {
    const api = stubFaqsApi();

    const { status, body } = readResult(
      await submitNew(texts({ "question:es": "", "answer:es": "" })),
    );

    expect(status).toBe(400);
    expect(body).toMatchObject({
      formError: "noLanguage",
      fieldErrors: { "question:es": "required", "answer:es": "required" },
    });
    expect(api.rpcCalls).toEqual([]);
  });

  it.each([
    ["question:es", QUESTION_LIMIT],
    ["answer:es", ANSWER_LIMIT],
    ["answer:en", ANSWER_LIMIT],
  ])(
    "%s más largo que %i responde 400, marca el campo y conserva lo escrito",
    async (field, limit) => {
      const api = stubFaqsApi({ faqs: FAQS });
      const fields = texts({
        "question:en": "Q",
        "answer:en": "A",
        [field]: "a".repeat(limit + 1),
      });

      const { status, body } = readResult(await submitEdit(FIRST_ID, fields));

      expect(status).toBe(400);
      expect(body).toMatchObject({
        fieldErrors: { [field]: "tooLong" },
        values: fields,
      });
      expect(api.rpcCalls).toEqual([]);
    },
  );

  it.each([
    ["saltos de línea seguidos", `a${"\r\n".repeat(ANSWER_LIMIT)}b`],
    ["párrafos", `${"a\n\n\n\n\n\n\n\n\n\n".repeat(900)}z`],
  ])("los %s cuentan para el límite de la respuesta", async (_case, long) => {
    const api = stubFaqsApi({ faqs: FAQS });

    const { status, body } = readResult(
      await submitEdit(FIRST_ID, texts({ "answer:es": long })),
    );

    expect(status).toBe(400);
    expect(body).toMatchObject({ fieldErrors: { "answer:es": "tooLong" } });
    expect(api.rpcCalls).toEqual([]);
  });

  it("justo en el límite se guarda, contando caracteres y saltos de una pieza", async () => {
    const api = stubFaqsApi({
      faqs: FAQS,
      rpcResults: savedResult({}, { es: {} }),
    });

    await submitEdit(
      FIRST_ID,
      texts({
        "question:es": "🏐".repeat(QUESTION_LIMIT),
        "answer:es": `${"a".repeat(ANSWER_LIMIT - 3)}\r\n\r\nb`,
      }),
    );

    expect(api.rpcCalls).toHaveLength(1);
  });

  it("guarda el HTML como texto y conserva los saltos de la respuesta", async () => {
    const api = stubFaqsApi({
      faqs: FAQS,
      rpcResults: savedResult({}, { es: {} }),
    });

    await submitEdit(
      FIRST_ID,
      texts({
        "question:es": "<b>Hola</b>\r\nmundo",
        "answer:es": "<script>alert(1)</script>\r\n\r\nSegundo\u0000párrafo",
      }),
    );

    expect(api.rpcCalls[0]?.body).toMatchObject({
      p_translations: [
        {
          locale: "es",
          question: "<b>Hola</b> mundo",
          answer: "<script>alert(1)</script>\n\nSegundo párrafo",
        },
      ],
    });
  });

  it("vaciar las dos mitades quita esa traducción", async () => {
    const api = stubFaqsApi({
      faqs: FAQS,
      rpcResults: savedResult({ en: {} }, {}),
    });

    const result = await submitEdit(THIRD_ID, texts());

    expect(readResult(result).body).toEqual({ status: "saved" });
    expect(api.rpcCalls[0]?.body).toEqual({
      p_faq_id: THIRD_ID,
      p_translations: [],
      p_removed_locales: ["en"],
      p_expected: [ENGLISH],
    });
  });

  it("vaciar una traducción que estaba a medias la quita", async () => {
    const half = { ...ENGLISH, answer: "" };
    const api = stubFaqsApi({
      faqs: [
        {
          id: FIRST_ID,
          status: "published",
          faq_translations: [SPANISH, half],
        },
      ],
      rpcResults: savedResult({ en: half }, {}),
    });

    await submitEdit(FIRST_ID, texts(), {
      ...paintedFields(FIRST_ID),
      "base:question:en": half.question,
      "base:answer:en": "",
    });

    expect(api.rpcCalls[0]?.body).toMatchObject({
      p_removed_locales: ["en"],
      p_expected: [half],
    });
  });

  // Quien abrió el editor antes de que existiera el inglés lo manda vacío.
  it("no borra la traducción que otra persona agregó mientras tanto", async () => {
    const api = stubFaqsApi({
      faqs: FAQS,
      rpcResults: savedResult({}, { es: {} }),
    });

    await submitEdit(THIRD_ID, texts({ "answer:es": "Nueva" }), {
      ...paintedFields(FIRST_ID),
    });

    expect(api.rpcCalls[0]?.body).toEqual({
      p_faq_id: THIRD_ID,
      p_translations: [{ ...SPANISH, answer: "Nueva" }],
      p_removed_locales: [],
      p_expected: [SPANISH],
    });
  });

  it("rechaza el cambio de un texto que otra persona ya había cambiado", async () => {
    const api = stubFaqsApi({ faqs: FAQS });

    const { status, body } = readResult(
      await submitEdit(FIRST_ID, texts({ "answer:es": "Mía" }), {
        ...paintedFields(FIRST_ID),
        "base:answer:es": "La que había antes",
      }),
    );

    expect(status).toBe(400);
    expect(body).toMatchObject({ formError: "stale" });
    expect(api.rpcCalls).toEqual([]);
  });

  it("explica el rechazo de la base si cambió justo antes de escribir", async () => {
    const api = stubFaqsApi({ faqs: FAQS, rpcFailure: STALE_REJECTION });

    const { status, body } = readResult(
      await submitEdit(FIRST_ID, texts({ "answer:es": "Mía" })),
    );

    expect(status).toBe(400);
    expect(body).toMatchObject({ formError: "stale" });
    expect(api.auditRows).toEqual([]);
  });

  it("no toca las traducciones de un idioma desactivado", async () => {
    const api = stubFaqsApi({
      faqs: FAQS,
      languages: [
        BOTH_LANGUAGES[0],
        { ...BOTH_LANGUAGES[1], is_active: false },
      ],
      rpcResults: savedResult({}, { es: {} }),
    });

    await submitEdit(THIRD_ID, texts({ "answer:es": "Nueva" }));

    expect(api.rpcCalls[0]?.body).toEqual({
      p_faq_id: THIRD_ID,
      p_translations: [{ ...SPANISH, answer: "Nueva" }],
      p_removed_locales: [],
      p_expected: [SPANISH],
    });
  });

  it("sin cambios no escribe", async () => {
    const api = stubFaqsApi({ faqs: FAQS });

    const result = await submitEdit(FIRST_ID, texts());

    expect(readResult(result).body).toEqual({ status: "unchanged" });
    expect(api.rpcCalls).toEqual([]);
    expect(api.auditRows).toEqual([]);
  });

  it("una publicada no se queda sin español", async () => {
    const api = stubFaqsApi({ faqs: FAQS });

    const { status, body } = readResult(
      await submitEdit(FIRST_ID, englishOnly()),
    );

    expect(status).toBe(400);
    expect(body).toMatchObject({
      formError: "publishedNeedsDefault",
      fieldErrors: { "question:es": "required", "answer:es": "required" },
    });
    expect(api.rpcCalls).toEqual([]);
  });

  it("explica el rechazo de la base si la publicaron mientras se editaba", async () => {
    stubFaqsApi({ faqs: FAQS, rpcFailure: DEFAULT_TEXT_REJECTION });

    const { status, body } = readResult(
      await submitEdit(SECOND_ID, englishOnly()),
    );

    expect(status).toBe(400);
    expect(body).toMatchObject({ formError: "publishedNeedsDefault" });
  });

  it("un envío al que le falta un campo no borra nada", async () => {
    const api = stubFaqsApi({ faqs: FAQS });

    const { status, body } = readResult(
      await submitEdit(THIRD_ID, { "question:es": "Q", "answer:es": "A" }, {}),
    );

    expect(status).toBe(400);
    expect(body).toMatchObject({ formError: "malformed" });
    expect(api.rpcCalls).toEqual([]);
  });

  it("si la base falla, lanza y no registra", async () => {
    const api = stubFaqsApi({
      faqs: FAQS,
      rpcFailure: { status: 500, code: "XX000", message: "falló" },
    });

    await expect(
      submitEdit(FIRST_ID, texts({ "answer:es": "Nueva" })),
    ).rejects.toThrow(/No se pudo guardar la pregunta/);
    expect(api.auditRows).toEqual([]);
  });
});

describe("preguntas: publicar", () => {
  it("publica una pregunta", async () => {
    const api = stubFaqsApi({ rpcResults: { set_faq_status: "retired" } });

    const result = await submitStatus(publishFaq, THIRD_ID);

    expect(readResult(result)).toEqual({
      status: 200,
      body: { status: "published", faqId: THIRD_ID },
    });
    expect(api.rpcCalls[0]).toMatchObject({
      name: "set_faq_status",
      body: { p_faq_id: THIRD_ID, p_status: "published" },
    });
  });

  it("sin español se rechaza con su error", async () => {
    const api = stubFaqsApi({ rpcFailure: DEFAULT_TEXT_REJECTION });

    const result = await submitStatus(publishFaq, SECOND_ID);

    expect(readResult(result)).toEqual({
      status: 400,
      body: {
        status: "invalid",
        faqId: SECOND_ID,
        error: "missingDefaultText",
      },
    });
    expect(api.auditRows).toEqual([]);
  });

  it("retira una publicada", async () => {
    const api = stubFaqsApi({ rpcResults: { set_faq_status: "published" } });

    const result = await submitStatus(retireFaq, FIRST_ID);

    expect(readResult(result).body).toEqual({
      status: "retired",
      faqId: FIRST_ID,
    });
    expect(api.rpcCalls[0]?.body).toEqual({
      p_faq_id: FIRST_ID,
      p_status: "retired",
    });
  });

  it("si el cambio ya no aplica lo dice y no registra", async () => {
    const api = stubFaqsApi();

    const result = await submitStatus(publishFaq, FIRST_ID);

    expect(readResult(result).body).toEqual({
      status: "unchanged",
      faqId: FIRST_ID,
    });
    expect(api.auditRows).toEqual([]);
  });

  it("un id que no existe responde 404", async () => {
    stubFaqsApi({ rpcFailure: UNKNOWN_FAQ });

    await expect(submitStatus(publishFaq, MISSING_ID)).rejects.toMatchObject(
      NOT_FOUND,
    );
  });

  it("algo que no es un id responde 404 sin llegar a la base", async () => {
    const api = stubFaqsApi();

    await expect(submitStatus(retireFaq, "otra-cosa")).rejects.toMatchObject(
      NOT_FOUND,
    );
    expect(api.rpcCalls).toEqual([]);
  });
});

describe("preguntas: orden", () => {
  it.each([
    ["up", 1],
    ["down", 3],
  ])("pide a la base mover %s", async (direction, position) => {
    const api = stubFaqsApi({
      rpcResults: { move_faq: { from: 2, to: position } },
    });

    const result = await submitMove(SECOND_ID, direction);

    expect(readResult(result).body).toEqual({
      status: "moved",
      faqId: SECOND_ID,
      direction,
      position,
    });
    expect(api.rpcCalls).toEqual([
      expect.objectContaining({
        name: "move_faq",
        body: { p_faq_id: SECOND_ID, p_direction: direction },
      }),
    ]);
  });

  it("en un extremo no cambia nada ni registra", async () => {
    const api = stubFaqsApi();

    const result = await submitMove(FIRST_ID, "up");

    expect(readResult(result).body).toEqual({
      status: "unchanged",
      faqId: FIRST_ID,
    });
    expect(api.auditRows).toEqual([]);
  });

  it("una dirección desconocida responde 400", async () => {
    const api = stubFaqsApi();

    const { status, body } = readResult(await submitMove(FIRST_ID, "otra"));

    expect(status).toBe(400);
    expect(body).toMatchObject({ status: "invalid", error: "malformed" });
    expect(api.rpcCalls).toEqual([]);
  });

  it("mover un id que no existe responde 404", async () => {
    stubFaqsApi({ rpcFailure: UNKNOWN_FAQ });

    await expect(submitMove(MISSING_ID, "up")).rejects.toMatchObject(NOT_FOUND);
  });
});

describe("preguntas: bitácora", () => {
  function auditRow(
    action: string,
    entityId: string,
    details: unknown,
  ): object {
    return {
      actor_id: FAKE_USER_ID,
      action,
      entity: "faq",
      entity_id: entityId,
      details,
    };
  }

  const STORED = {
    es: { question: SPANISH.question, answer: SPANISH.answer },
  };

  it("crear registra la pregunta nueva", async () => {
    const api = stubFaqsApi({
      rpcResults: { create_faq: { id: THIRD_ID, sort_order: 4 } },
    });

    await submitNew(texts());

    expect(api.auditRows).toEqual([
      auditRow("faq.create", THIRD_ID, {
        before: null,
        after: { status: "draft", sort_order: 4, translations: STORED },
      }),
    ]);
  });

  it("editar registra el antes y el después que vio la base", async () => {
    const api = stubFaqsApi({
      faqs: FAQS,
      rpcResults: savedResult(STORED, {
        es: { ...STORED.es, answer: "Nueva" },
      }),
    });

    await submitEdit(FIRST_ID, texts({ "answer:es": "Nueva" }));

    expect(api.auditRows).toEqual([
      auditRow("faq.update", FIRST_ID, {
        before: { translations: STORED },
        after: { translations: { es: { ...STORED.es, answer: "Nueva" } } },
      }),
    ]);
  });

  it.each([
    ["faq.publish", publishFaq, "draft", "published"],
    ["faq.retire", retireFaq, "published", "retired"],
  ])("%s registra el cambio de estado", async (name, action, from, to) => {
    const api = stubFaqsApi({ rpcResults: { set_faq_status: from } });

    await submitStatus(action, FIRST_ID);

    expect(api.auditRows).toEqual([
      auditRow(name, FIRST_ID, {
        before: { status: from },
        after: { status: to },
      }),
    ]);
  });

  it("reordenar registra la posición anterior y la nueva", async () => {
    const api = stubFaqsApi({ rpcResults: { move_faq: { from: 2, to: 1 } } });

    await submitMove(SECOND_ID, "up");

    expect(api.auditRows).toEqual([
      auditRow("faq.reorder", SECOND_ID, {
        before: { position: 2 },
        after: { position: 1 },
      }),
    ]);
  });
});

describe("preguntas: permisos", () => {
  const OUTSIDERS = [
    ["un buyer", "buyer", 404],
    ["el staff", "staff", 302],
  ] as const;

  const WRITES: readonly [string, () => Promise<unknown>][] = [
    ["crear", () => submitNew(texts())],
    ["editar", () => submitEdit(FIRST_ID, texts({ "answer:es": "x" }))],
    ["publicar", () => submitStatus(publishFaq, FIRST_ID)],
    ["retirar", () => submitStatus(retireFaq, FIRST_ID)],
    ["reordenar", () => submitMove(FIRST_ID, "down")],
  ];

  async function readStatus(work: () => Promise<unknown>): Promise<number> {
    try {
      await work();
    } catch (thrown) {
      if (thrown instanceof Response) return thrown.status;
      return (thrown as { init: ResponseInit }).init.status ?? 200;
    }
    throw new Error("Se esperaba que la guardia cortara la petición");
  }

  it("las pantallas y sus envíos están bajo la guardia de admin", () => {
    expect(PANEL_ADMIN_PAGES.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "adminFaqs",
        "adminFaqNew",
        "adminFaq",
        "adminFaqPublish",
        "adminFaqRetire",
        "adminFaqMove",
      ]),
    );
  });

  it.each(OUTSIDERS)("%s no llega a leer", async (_case, role, code) => {
    const api = stubFaqsApi({
      faqs: FAQS,
      profile: { ...ADMIN_PROFILE, role },
    });
    const args =
      buildRequestArgs<Parameters<typeof requirePanelMember>[0]>(
        "/admin/preguntas",
      );
    const next = vi.fn();

    const status = await readStatus(async () => {
      await requirePanelMember(args, next);
      expect(args.context.get(panelMemberContext).role).toBe(role);
      await requireAdmin(args, next);
    });

    expect(status).toBe(code);
    expect(api.faqReads).toEqual([]);
  });

  describe.each(OUTSIDERS)("%s", (_case, role, code) => {
    it.each(WRITES)("no puede %s", async (_name, write) => {
      const api = stubFaqsApi({
        faqs: FAQS,
        profile: { ...ADMIN_PROFILE, role },
      });

      expect(await readStatus(write)).toBe(code);
      expect(api.rpcCalls).toEqual([]);
      expect(api.auditRows).toEqual([]);
    });
  });
});
