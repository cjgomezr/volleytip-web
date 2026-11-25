import {
  data,
  redirect,
  RouterContextProvider,
  type ActionFunctionArgs,
} from "react-router";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { handleError } from "~/entry.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import {
  ADMIN_PROFILE,
  buildSessionCookie,
  FAKE_USER_ID,
  stubSupabase,
  type FakeProfile,
} from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";
import {
  defineAdminAction,
  type AdminAction,
  type AuditedChange,
} from "./admin-action.server";
import { panelSessionContext } from "./panel-middleware.server";

const SIGNED_IN = buildSessionCookie(TEST_ENV.SUPABASE_URL);
const FAQ_ID = "0b6f1f0a-3f0e-4f43-9a55-3c1f7f2f9d10";
const SIGN_IN_PATH = "/admin/entrar";

type FaqField = "question" | "position" | "tags";

interface Faq {
  readonly question: string;
  readonly position: number;
  readonly tags: string[];
  readonly secretToken: string;
}

const STORED_FAQ: Faq = {
  question: "¿Cuándo es el camp?",
  position: 1,
  tags: ["camps"],
  secretToken: "no-debe-salir",
};

function buildArgs(
  cookie: string | null = SIGNED_IN,
  signal?: AbortSignal,
): ActionFunctionArgs {
  const request = new Request("http://localhost/admin/preguntas", {
    method: "POST",
    headers: cookie === null ? {} : { Cookie: cookie },
    signal,
  });
  const context = new RouterContextProvider();
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  return { request, context, params: {} } as unknown as ActionFunctionArgs;
}

/** Una acción de muestra que dice haber hecho `change`. */
function buildFaqAction(change: AuditedChange<FaqField> | null): {
  action: AdminAction<string>;
  run: Mock;
} {
  const run = vi.fn(async () => ({ result: "hecho", change }));
  const action = defineAdminAction({
    name: "faq.update",
    auditedFields: ["question", "position", "tags"],
    run,
  });
  return { action, run };
}

function editFaq(after: Partial<Faq>): AuditedChange<FaqField> {
  return {
    entityId: FAQ_ID,
    before: STORED_FAQ,
    after: { ...STORED_FAQ, ...after },
  };
}

async function catchThrown(work: Promise<unknown>): Promise<unknown> {
  try {
    await work;
  } catch (error) {
    return error;
  }
  throw new Error("Se esperaba que la acción fallara");
}

// La guardia lanza una `Response` (redirección) o un `data()` (el 404).
function readStatusAndLocation(thrown: unknown): {
  status: number | undefined;
  location: string | null;
} {
  if (thrown instanceof Response) {
    return {
      status: thrown.status,
      location: thrown.headers.get("Location"),
    };
  }
  const { init } = thrown as { init?: ResponseInit };
  return { status: init?.status, location: null };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("acción del admin", () => {
  it("ejecuta el cambio y devuelve su resultado", async () => {
    stubSupabase();
    const { action, run } = buildFaqAction(editFaq({ position: 2 }));
    const args = buildArgs();

    await expect(action(args)).resolves.toBe("hecho");
    expect(run).toHaveBeenCalledExactlyOnceWith(args);
  });

  it("registra actor, acción, entidad, id y el antes y el después de lo que cambió", async () => {
    const supabase = stubSupabase();
    const { action } = buildFaqAction(editFaq({ position: 2 }));

    await action(buildArgs());

    expect(supabase.auditRows).toEqual([
      {
        actor_id: FAKE_USER_ID,
        action: "faq.update",
        entity: "faq",
        entity_id: FAQ_ID,
        details: { before: { position: 1 }, after: { position: 2 } },
      },
    ]);
  });

  it.each<[string, AuditedChange<FaqField>, "before" | "after"]>([
    [
      "una creación",
      { entityId: FAQ_ID, before: null, after: STORED_FAQ },
      "after",
    ],
    [
      "un borrado",
      { entityId: FAQ_ID, before: STORED_FAQ, after: null },
      "before",
    ],
  ])(
    "%s registra todos los campos declarados de un solo lado",
    async (_name, change, side) => {
      const supabase = stubSupabase();
      const { action } = buildFaqAction(change);

      await action(buildArgs());

      expect(supabase.auditRows).toMatchObject([
        {
          details: {
            before: null,
            after: null,
            [side]: {
              question: STORED_FAQ.question,
              position: 1,
              tags: ["camps"],
            },
          },
        },
      ]);
    },
  );

  it("una entidad sin uuid queda identificada por su clave", async () => {
    const supabase = stubSupabase();
    const { action } = buildFaqAction({
      entityId: null,
      entityKey: "es:camps",
      before: STORED_FAQ,
      after: { ...STORED_FAQ, position: 2 },
    });

    await action(buildArgs());

    expect(supabase.auditRows).toMatchObject([
      {
        entity_id: null,
        details: {
          key: "es:camps",
          before: { position: 1 },
          after: { position: 2 },
        },
      },
    ]);
  });

  it("sin uuid ni clave no compila: no se sabría qué cambió", () => {
    // @ts-expect-error: falta `entityKey`.
    const change: AuditedChange<FaqField> = {
      entityId: null,
      before: null,
      after: STORED_FAQ,
    };

    expect(change.entityId).toBeNull();
  });
});

describe("acción del admin: permisos", () => {
  const rejected: [
    string,
    FakeProfile,
    string | null,
    number,
    string | null,
  ][] = [
    ["sin sesión", ADMIN_PROFILE, null, 302, SIGN_IN_PATH],
    ["un buyer", { ...ADMIN_PROFILE, role: "buyer" }, SIGNED_IN, 404, null],
    ["un staff", { ...ADMIN_PROFILE, role: "staff" }, SIGNED_IN, 302, "/admin"],
    [
      "un admin desactivado",
      { ...ADMIN_PROFILE, is_active: false },
      SIGNED_IN,
      302,
      SIGN_IN_PATH,
    ],
  ];

  it.each(rejected)(
    "%s no ejecuta ni registra, y recibe la respuesta de la guardia",
    async (_name, profile, cookie, status, location) => {
      const supabase = stubSupabase({ profile });
      const { action, run } = buildFaqAction(editFaq({ position: 2 }));

      const thrown = await catchThrown(action(buildArgs(cookie)));

      expect(readStatusAndLocation(thrown)).toEqual({ status, location });
      expect(run).not.toHaveBeenCalled();
      expect(supabase.auditRows).toEqual([]);
    },
  );

  it("a un buyer le lanza el mismo 404 del panel", async () => {
    stubSupabase({ profile: { ...ADMIN_PROFILE, role: "buyer" } });
    const { action } = buildFaqAction(null);

    const thrown = await catchThrown(action(buildArgs()));

    expect(thrown).toMatchObject({ data: { kind: "panel-not-found" } });
  });

  it("a un admin desactivado le cierra la sesión", async () => {
    const supabase = stubSupabase({
      profile: { ...ADMIN_PROFILE, is_active: false },
    });
    const { action } = buildFaqAction(null);

    await catchThrown(action(buildArgs()));

    expect(supabase.requests).toContain("POST /auth/v1/logout?scope=local");
  });
});

describe("acción del admin: fallos", () => {
  it("si el cambio falla, el error llega a quien llamó y no hay entrada", async () => {
    const supabase = stubSupabase();
    const failure = new Error("la base rechazó el cambio");
    const action = defineAdminAction({
      name: "faq.update",
      auditedFields: ["question"],
      run: () => Promise.reject(failure),
    });

    await expect(action(buildArgs())).rejects.toBe(failure);
    expect(supabase.auditRows).toEqual([]);
  });

  it("si la bitácora falla, la acción responde con error", async () => {
    stubSupabase({ auditFailureStatus: 500 });
    const { action, run } = buildFaqAction(editFaq({ position: 2 }));

    await expect(action(buildArgs())).rejects.toThrow(
      /"faq.update".*no quedó en la bitácora/,
    );
    expect(run).toHaveBeenCalledOnce();
  });

  it("el fallo dice qué cambio quedó hecho sin registro", async () => {
    stubSupabase({ auditFailureStatus: 500 });
    const { action } = buildFaqAction(editFaq({ position: 2 }));

    await expect(action(buildArgs())).rejects.toThrow(FAQ_ID);
  });

  it("el fallo de la bitácora queda en el reporte de errores del servidor", async () => {
    stubSupabase({ auditFailureStatus: 500 });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { action } = buildFaqAction(editFaq({ position: 2 }));
    const args = buildArgs();

    // Es lo que React Router hace con lo que lanza un action.
    const thrown = await catchThrown(action(args));
    await handleError(thrown, args);

    expect(log).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^Error del servidor, referencia /),
      thrown,
    );
  });

  it("queda en el reporte aunque quien envió ya se haya ido", async () => {
    stubSupabase({ auditFailureStatus: 500 });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const browser = new AbortController();
    const action = defineAdminAction({
      name: "faq.update",
      auditedFields: ["position"],
      run: async () => {
        browser.abort();
        return { result: null, change: editFaq({ position: 2 }) };
      },
    });
    const args = buildArgs(SIGNED_IN, browser.signal);

    const thrown = await catchThrown(action(args));
    await handleError(thrown, args);

    expect(log).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^Error del servidor, referencia /),
      thrown,
    );
  });

  it.each<[string, () => unknown]>([
    ["una redirección", () => redirect("/admin")],
    ["un data() sin estado", () => data({ ok: true })],
    ["un data() 201", () => data(null, { status: 201 })],
  ])(
    "lanzar %s desde run falla: no termina bien sin entrada",
    async (_name, buildThrown) => {
      const supabase = stubSupabase();
      const thrownByRun = buildThrown();
      const action = defineAdminAction({
        name: "faq.update",
        auditedFields: ["position"],
        run: async (): Promise<never> => {
          throw thrownByRun;
        },
      });

      const thrown = await catchThrown(action(buildArgs()));

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown).toMatchObject({
        message: expect.stringMatching(/"faq.update".*`result`/),
        cause: thrownByRun,
      });
      expect(supabase.auditRows).toEqual([]);
    },
  );

  it.each<[string, () => unknown]>([
    ["una Response 404", () => new Response(null, { status: 404 })],
    ["un data() 400", () => data(null, { status: 400 })],
  ])("%s lanzada por run llega tal cual", async (_name, buildThrown) => {
    stubSupabase();
    const thrownByRun = buildThrown();
    const action = defineAdminAction({
      name: "faq.update",
      auditedFields: ["position"],
      run: async (): Promise<never> => {
        throw thrownByRun;
      },
    });

    await expect(action(buildArgs())).rejects.toBe(thrownByRun);
  });
});

describe("acción del admin: tipos", () => {
  it("admite una respuesta distinta para cada desenlace", async () => {
    stubSupabase();
    const action = defineAdminAction({
      name: "faq.create",
      auditedFields: ["question"],
      run: async ({ request }) => {
        if (request.headers.has("X-Invalid")) {
          const invalid = data({ errors: ["question"] }, { status: 400 });
          return { result: invalid, change: null };
        }
        return {
          result: redirect("/admin"),
          change: {
            entityId: FAQ_ID,
            before: null,
            after: { question: "¿Dónde?" },
          },
        };
      },
    });

    const result = await action(buildArgs());

    expect(result).toBeInstanceOf(Response);
  });

  it("run puede tipar sus parámetros como los de su ruta", async () => {
    stubSupabase();
    type FaqArgs = ActionFunctionArgs & { params: { faqId: string } };
    const action = defineAdminAction({
      name: "faq.delete",
      auditedFields: ["question"],
      run: async ({ params }: FaqArgs) => ({
        result: params.faqId.toUpperCase(),
        change: null,
      }),
    });
    const args: FaqArgs = { ...buildArgs(), params: { faqId: "abc" } };

    const result: string = await action(args);

    expect(result).toBe("ABC");
  });
});

describe("acción del admin: sin cambios", () => {
  it.each<[string, AuditedChange<FaqField> | null]>([
    ["el antes y el después son iguales", editFaq({})],
    [
      "las listas son iguales aunque sean otro objeto",
      editFaq({ tags: ["camps"] }),
    ],
    [
      "solo cambió un campo no declarado",
      editFaq({ secretToken: "otro-secreto" }),
    ],
    ["la acción dice que no cambió nada", null],
  ])("no registra cuando %s", async (_name, change) => {
    const supabase = stubSupabase();
    const { action } = buildFaqAction(change);

    await expect(action(buildArgs())).resolves.toBe("hecho");
    expect(supabase.auditRows).toEqual([]);
  });

  it("no registra cuando un objeto solo cambió el orden de sus claves", async () => {
    const supabase = stubSupabase();
    const action = defineAdminAction({
      name: "site_text.update",
      auditedFields: ["value"],
      run: async () => ({
        result: null,
        change: {
          entityId: null,
          entityKey: "home.title",
          before: { value: { es: "Hola", en: "Hi" } },
          after: { value: { en: "Hi", es: "Hola" } },
        },
      }),
    });

    await action(buildArgs());

    expect(supabase.auditRows).toEqual([]);
  });

  it("no registra cuando la diferencia no llegaría a la bitácora", async () => {
    const supabase = stubSupabase();
    const action = defineAdminAction({
      name: "site_text.update",
      auditedFields: ["value"],
      run: async () => ({
        result: null,
        change: {
          entityId: FAQ_ID,
          before: { value: { es: "Hola" } },
          after: { value: { es: "Hola", en: undefined } },
        },
      }),
    });

    await action(buildArgs());

    expect(supabase.auditRows).toEqual([]);
  });
});

describe("acción del admin: campos", () => {
  it.each<[string, AuditedChange<FaqField>]>([
    ["un cambio", editFaq({ position: 2, secretToken: "otro-secreto" })],
    ["una creación", { entityId: FAQ_ID, before: null, after: STORED_FAQ }],
    ["un borrado", { entityId: FAQ_ID, before: STORED_FAQ, after: null }],
  ])("en %s un campo no declarado no llega a details", async (_n, change) => {
    const supabase = stubSupabase();
    const { action } = buildFaqAction(change);

    await action(buildArgs());

    expect(supabase.auditRows).toHaveLength(1);
    expect(JSON.stringify(supabase.auditRows)).not.toMatch(/secret|secreto/i);
    expect(JSON.stringify(supabase.auditRows)).not.toContain("no-debe-salir");
  });
});

describe("acción del admin: nombre", () => {
  const run = (): Promise<{ result: null; change: null }> =>
    Promise.resolve({ result: null, change: null });

  it.each(["faq.update", "site_text.publish", "usd_rate.set_manual"] as const)(
    "acepta %s",
    (name) => {
      expect(() =>
        defineAdminAction({ name, auditedFields: ["value"], run }),
      ).not.toThrow();
    },
  );

  it.each([
    ".update",
    "faq.",
    "faq.item.update",
    "Faq.update",
    "faq.actualizar todo",
  ] as const)("falla al definir %j", (name) => {
    expect(() =>
      defineAdminAction({ name, auditedFields: ["value"], run }),
    ).toThrow(/entidad\.verbo/);
  });

  it("un nombre sin punto no compila y además falla al definirlo", () => {
    expect(() =>
      defineAdminAction({
        // @ts-expect-error: falta el verbo.
        name: "faq",
        auditedFields: ["value"],
        run,
      }),
    ).toThrow(/entidad\.verbo/);
  });
});
