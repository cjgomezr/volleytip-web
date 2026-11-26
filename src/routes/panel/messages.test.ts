import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  panelMemberContext,
  panelSessionContext,
  requireAdmin,
} from "~/lib/panel/panel-middleware.server";
import type { PanelMember } from "~/lib/panel/visitor.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import {
  SAMPLE_MESSAGE,
  type FakeMessageRow,
} from "~/testing/fake-messages-table";
import {
  ADMIN_PROFILE,
  buildSessionCookie,
  FAKE_USER_ID,
  stubSupabase,
  VALID_ACCESS_TOKEN,
  type FakeSupabase,
} from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";
import { loader as detailLoader } from "./message";
import { action as answerAction } from "./message-answer";
import { action as archiveAction } from "./message-archive";
import { action as reopenAction } from "./message-reopen";
import { loader as listLoader } from "./messages";

const MEMBER: PanelMember = {
  id: FAKE_USER_ID,
  email: ADMIN_PROFILE.email,
  fullName: ADMIN_PROFILE.full_name,
  role: "admin",
};

const ID = SAMPLE_MESSAGE.id;
const MISSING_ID = "a1b2c3d4-0000-4000-8000-000000000000";
const ANSWERED_AT = "2026-11-20T15:00:00Z";
const NOW = new Date("2026-11-26T20:00:00Z");

const NEW: FakeMessageRow = SAMPLE_MESSAGE;
const ANSWERED: FakeMessageRow = {
  ...SAMPLE_MESSAGE,
  status: "answered",
  answered_at: ANSWERED_AT,
  answerer: { full_name: "Camilo", email: "camilo@prueba.volleytip.test" },
};
const ARCHIVED_UNANSWERED: FakeMessageRow = { ...NEW, status: "archived" };
const ARCHIVED_ANSWERED: FakeMessageRow = { ...ANSWERED, status: "archived" };

interface ArgsOptions {
  readonly id?: string;
  readonly isSubmission?: boolean;
  readonly member?: PanelMember;
}

function buildArgs<Args>(
  path: string,
  { id = ID, isSubmission = false, member = MEMBER }: ArgsOptions = {},
): Args {
  const request = new Request(`http://localhost${path}`, {
    method: isSubmission ? "POST" : "GET",
    headers: { Cookie: buildSessionCookie(TEST_ENV.SUPABASE_URL) },
    ...(isSubmission ? { body: new URLSearchParams() } : {}),
  });
  const context = new RouterContextProvider();
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  context.set(panelMemberContext, member);
  return { request, context, params: { messageId: id } } as unknown as Args;
}

function detail(
  path = `/admin/mensajes/${ID}`,
  id = ID,
): ReturnType<typeof detailLoader> {
  return detailLoader(buildArgs(path, { id }));
}

const ACTIONS = {
  responder: answerAction,
  archivar: archiveAction,
  reabrir: reopenAction,
} as const;

type Verb = keyof typeof ACTIONS;

function submit(verb: Verb, id = ID): Promise<unknown> {
  return ACTIONS[verb](
    buildArgs(`/admin/mensajes/${id}/${verb}`, { id, isSubmission: true }),
  );
}

async function catchThrown(work: () => unknown): Promise<unknown> {
  try {
    await work();
  } catch (thrown) {
    return thrown;
  }
  throw new Error("Se esperaba que lanzara");
}

function expectRedirect(result: unknown, location: string): void {
  expect(result).toBeInstanceOf(Response);
  expect((result as Response).status).toBe(303);
  expect((result as Response).headers.get("Location")).toBe(location);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("bandeja: lista", () => {
  it("entrega nombre, motivo, fecha y estado, con el enlace al detalle", async () => {
    stubSupabase({ messages: [NEW] });

    const view = await listLoader(buildArgs("/admin/mensajes"));

    expect(view.rows).toEqual([
      {
        id: ID,
        href: `/admin/mensajes/${ID}`,
        name: "Laura Restrepo",
        excerpt: "Hola. No me ha llegado el pedido.",
        reason: "order",
        status: "new",
        dateTime: NEW.created_at,
        date: expect.stringMatching(/26\/11\/26.*10:30/),
      },
    ]);
  });

  it("corta el comienzo de un mensaje largo", async () => {
    stubSupabase({ messages: [{ ...NEW, body: "a".repeat(2000) }] });

    const view = await listLoader(buildArgs("/admin/mensajes"));

    expect(view.rows[0]?.excerpt).toBe(`${"a".repeat(120)}…`);
  });

  it.each(["/admin/mensajes", "/en/admin/messages"])(
    "la página vive en la dirección (%s)",
    async (path) => {
      stubSupabase({
        messages: Array.from({ length: 120 }, (_, index) => ({
          ...NEW,
          id: `${index}`,
        })),
      });

      const view = await listLoader(buildArgs(`${path}?estado=new&pagina=2`));

      expect(view).toMatchObject({
        page: 2,
        pageCount: 3,
        previousHref: `${path}?estado=new`,
        nextHref: `${path}?estado=new&pagina=3`,
      });
    },
  );

  it("con una sola página no hay anterior ni siguiente", async () => {
    stubSupabase({ messages: [NEW] });

    const view = await listLoader(buildArgs("/admin/mensajes"));

    expect(view).toMatchObject({ previousHref: null, nextHref: null });
  });

  it("un filtro desconocido se ignora y la bandeja responde", async () => {
    stubSupabase({ messages: [NEW] });

    const view = await listLoader(
      buildArgs("/admin/mensajes?motivo=x&estado=y&pagina=z"),
    );

    expect(view.query).toEqual({
      reason: null,
      status: null,
      search: "",
      page: 1,
    });
    expect(view.rows).toHaveLength(1);
  });
});

describe("bandeja: detalle", () => {
  it("entrega todos los campos del mensaje", async () => {
    stubSupabase({ messages: [NEW] });

    const view = await detail();

    expect(view).toMatchObject({
      id: ID,
      name: "Laura Restrepo",
      email: "laura@prueba.volleytip.test",
      reason: "order",
      status: "new",
      country: "Colombia",
      language: "Español",
      date: expect.stringContaining("10:30"),
      fields: [
        {
          id: "orderNumber",
          labelKey: "panel.messages.field.orderNumber",
          value: "VT-1042",
        },
      ],
      body: "Hola.\nNo me ha llegado el pedido.",
      privacyVersion: "2026-11",
      answer: null,
      notice: null,
    });
  });

  it.each([
    ["brands", "brand"],
    ["camps", "club"],
  ])("trae el campo propio de %s", async (reason, field) => {
    stubSupabase({
      messages: [{ ...NEW, reason, payload: { [field]: "Marca X" } }],
    });

    const view = await detail();

    expect(view.fields).toEqual([
      {
        id: field,
        labelKey: `panel.messages.field.${field}`,
        value: "Marca X",
      },
    ]);
  });

  it("un campo que el panel no conoce se muestra con su nombre; uno vacío, no", async () => {
    stubSupabase({
      messages: [
        { ...NEW, payload: { shirts: ["S", "M"], note: "", other: null } },
      ],
    });

    const view = await detail();

    expect(view.fields).toEqual([{ id: "shirts", value: "S, M" }]);
  });

  it("sin país no inventa uno", async () => {
    stubSupabase({ messages: [{ ...NEW, country_code: null }] });

    await expect(detail()).resolves.toMatchObject({ country: null });
  });

  it.each([
    ["es", "Tu mensaje a VolleyTip: Un pedido"],
    ["en", "Your message to VolleyTip: An order"],
  ])(
    "el correo va a quien escribió, con el motivo en su idioma (%s)",
    async (locale, subject) => {
      stubSupabase({ messages: [{ ...NEW, locale }] });

      const view = await detail();

      expect(view.mailHref).toBe(
        `mailto:laura@prueba.volleytip.test?subject=${encodeURIComponent(subject)}`,
      );
    },
  );

  it("una dirección rara no agrega destinatarios ni encabezados", async () => {
    stubSupabase({ messages: [{ ...NEW, email: "a?bcc=x@y.test&cc=z" }] });

    const { mailHref } = await detail();

    expect(mailHref.split("?")).toHaveLength(2);
    expect(mailHref).not.toContain("&");
  });

  it("ofrece WhatsApp con solo los dígitos del número", async () => {
    stubSupabase({ messages: [NEW] });

    await expect(detail()).resolves.toMatchObject({
      whatsapp: {
        number: "+57 300 123 4567",
        href: "https://wa.me/573001234567",
      },
    });
  });

  it.each([null, "", "sin número"])(
    "sin número (%j) no ofrece WhatsApp",
    async (whatsapp) => {
      stubSupabase({ messages: [{ ...NEW, whatsapp }] });

      await expect(detail()).resolves.toMatchObject({ whatsapp: null });
    },
  );

  it("dice quién respondió y cuándo", async () => {
    stubSupabase({ messages: [ANSWERED] });

    await expect(detail()).resolves.toMatchObject({
      answer: {
        by: "Camilo",
        dateTime: ANSWERED_AT,
        date: expect.stringContaining("10:00"),
      },
    });
  });

  it.each([MISSING_ID, "7", "no-es-un-id"])(
    "el id inexistente %s responde 404",
    async (id) => {
      stubSupabase({ messages: [NEW] });

      const thrown = await catchThrown(() =>
        detail(`/admin/mensajes/${id}`, id),
      );

      expect(thrown).toMatchObject({ init: { status: 404 } });
    },
  );

  it("si la base falla, no lo confunde con un 404", async () => {
    stubSupabase({ messagesReadFailureStatus: 500 });

    await expect(detail()).rejects.toThrow(/mensaje/);
  });
});

describe("bandeja: estados", () => {
  async function change(
    verb: Verb,
    message: FakeMessageRow,
  ): Promise<{ result: unknown; supabase: FakeSupabase }> {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    const supabase = stubSupabase({ messages: [message] });
    const result = await submit(verb);
    return { result, supabase };
  }

  function expectAudit(
    rows: readonly unknown[],
    action: string,
    [before, after]: readonly [string, string],
  ): void {
    expect(rows).toEqual([
      {
        actor_id: FAKE_USER_ID,
        action,
        entity: "message",
        entity_id: ID,
        details: { before: { status: before }, after: { status: after } },
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain("llegado");
  }

  it("responder guarda quién y cuándo, y lo registra sin el cuerpo", async () => {
    const { result, supabase } = await change("responder", NEW);

    expectRedirect(result, `/admin/mensajes/${ID}?saved=answered`);
    expect(supabase.messageWrites).toEqual([
      {
        search: expect.stringContaining("status=eq.new"),
        body: {
          status: "answered",
          answered_by: FAKE_USER_ID,
          answered_at: NOW.toISOString(),
        },
        authorization: `Bearer ${VALID_ACCESS_TOKEN}`,
      },
    ]);
    expectAudit(supabase.auditRows, "message.answer", ["new", "answered"]);
  });

  it.each([
    ["new", NEW],
    ["answered", ANSWERED],
  ])(
    "archivar un mensaje %s solo cambia el estado",
    async (before, message) => {
      const { result, supabase } = await change("archivar", message);

      expectRedirect(result, `/admin/mensajes/${ID}?saved=archived`);
      expect(supabase.messageWrites[0]?.body).toEqual({ status: "archived" });
      expectAudit(supabase.auditRows, "message.archive", [before, "archived"]);
    },
  );

  it.each([
    ["new", ARCHIVED_UNANSWERED],
    ["answered", ARCHIVED_ANSWERED],
  ])("reabrir deja el mensaje %s", async (after, message) => {
    const { result, supabase } = await change("reabrir", message);

    expectRedirect(result, `/admin/mensajes/${ID}?saved=reopened`);
    expect(supabase.messageWrites[0]?.body).toEqual({ status: after });
    expectAudit(supabase.auditRows, "message.reopen", ["archived", after]);
  });

  it.each([
    ["responder", ANSWERED],
    ["responder", ARCHIVED_UNANSWERED],
    ["archivar", ARCHIVED_ANSWERED],
    ["reabrir", NEW],
    ["reabrir", ANSWERED],
  ] as const)(
    "%s no aplica al estado actual: no escribe y lo dice",
    async (verb, message) => {
      const { result, supabase } = await change(verb, message);

      expectRedirect(result, `/admin/mensajes/${ID}?saved=unchanged`);
      expect(supabase.messageWrites).toEqual([]);
      expect(supabase.auditRows).toEqual([]);
    },
  );

  it("si otra persona lo cambió a la vez, no pisa ni registra", async () => {
    const supabase = stubSupabase({
      messages: [NEW],
      statusChangedMeanwhile: "archived",
    });

    const result = await submit("responder");

    expectRedirect(result, `/admin/mensajes/${ID}?saved=unchanged`);
    expect(supabase.auditRows).toEqual([]);
  });

  it.each([
    { messageWriteFailureStatus: 403 },
    { isMessageWriteIgnored: true },
  ])("si la base no guarda (%o), falla sin dejar entrada", async (failure) => {
    const supabase = stubSupabase({ messages: [NEW], ...failure });

    await expect(submit("responder")).rejects.toThrow(/mensaje/);
    expect(supabase.auditRows).toEqual([]);
  });

  it("en inglés vuelve al detalle en inglés", async () => {
    stubSupabase({ messages: [NEW] });

    const result = await answerAction(
      buildArgs(`/en/admin/messages/${ID}/answer`, { isSubmission: true }),
    );

    expectRedirect(result, `/en/admin/messages/${ID}?saved=answered`);
  });

  it.each([MISSING_ID, "no-es-un-id"])(
    "cambiar el id inexistente %s responde 404",
    async (id) => {
      const supabase = stubSupabase({ messages: [NEW] });

      const thrown = await catchThrown(() => submit("archivar", id));

      expect(thrown).toMatchObject({ init: { status: 404 } });
      expect(supabase.messageWrites).toEqual([]);
    },
  );

  it.each([
    ["answered", "answered"],
    ["otra-cosa", null],
  ])("el aviso ?saved=%s es %s", async (saved, notice) => {
    stubSupabase({ messages: [ANSWERED] });

    await expect(
      detail(`/admin/mensajes/${ID}?saved=${saved}`),
    ).resolves.toMatchObject({ notice });
  });
});

describe("bandeja: permisos", () => {
  const FORBIDDEN_CASES = [
    ["responder", NEW],
    ["archivar", NEW],
    ["reabrir", ARCHIVED_UNANSWERED],
  ] as const;

  it.each(FORBIDDEN_CASES)(
    "un comprador no puede %s: 404 y nada cambia",
    async (verb, message) => {
      const supabase = stubSupabase({
        messages: [message],
        profile: { ...ADMIN_PROFILE, role: "buyer" },
      });

      const thrown = await catchThrown(() => submit(verb));

      expect(thrown).toMatchObject({ init: { status: 404 } });
      expect(supabase.messageWrites).toEqual([]);
      expect(supabase.auditRows).toEqual([]);
    },
  );

  it.each(FORBIDDEN_CASES)(
    "el staff no puede %s: vuelve al inicio y nada cambia",
    async (verb, message) => {
      const supabase = stubSupabase({
        messages: [message],
        profile: { ...ADMIN_PROFILE, role: "staff" },
      });

      const thrown = await catchThrown(() => submit(verb));

      expect((thrown as Response).headers.get("Location")).toBe("/admin");
      expect(supabase.messageWrites).toEqual([]);
      expect(supabase.auditRows).toEqual([]);
    },
  );

  it("el staff no pasa de la guardia de las páginas", async () => {
    const args = buildArgs<Parameters<typeof requireAdmin>[0]>(
      "/admin/mensajes",
      { member: { ...MEMBER, role: "staff" } },
    );

    const thrown = await catchThrown(() =>
      requireAdmin(args, () => Promise.resolve(new Response())),
    );

    expect((thrown as Response).headers.get("Location")).toBe("/admin");
  });
});
