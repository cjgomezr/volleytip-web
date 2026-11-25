import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defineModules, type AdminModule } from "~/lib/admin/modules";
import { buildOverviewView, type OverviewView } from "~/lib/admin/overview";
import type { Database } from "~/lib/database.types";
import type { Language } from "~/lib/i18n/languages";
import {
  createOverviewApi,
  type FakeAuditRow,
  type FakeOverviewApi,
  type FakeOverviewData,
} from "~/testing/fake-overview-api";

import { readOverview } from "./overview.server";

// 2026-11-26 a las 15:00 en Colombia.
const NOW = new Date("2026-11-26T20:00:00Z");

async function loadView(
  data: FakeOverviewData = {},
  options: { modules?: readonly AdminModule[]; language?: Language } = {},
): Promise<{ api: FakeOverviewApi; view: OverviewView }> {
  const { modules = [], language = "es" } = options;
  const api = createOverviewApi(data);
  const client = createClient<Database>("http://supabase.test", "llave", {
    global: { fetch: api.fetch },
  });
  const overview = await readOverview(client, { modules, now: NOW });
  return { api, view: buildOverviewView(overview, { modules, language }) };
}

function sampleModule(
  id: string,
  extra: Partial<AdminModule> = {},
): AdminModule {
  return {
    id,
    page: {
      id,
      file: "routes/panel/home.tsx",
      path: { es: `admin/${id}-es`, en: `admin/${id}-en` },
    },
    labelKey: "panel.module.overview",
    requiredRole: "admin",
    ...extra,
  };
}

const AUDIT_ROW: FakeAuditRow = {
  id: "entrada-0",
  action: "faq.update",
  created_at: "2026-11-26T19:30:00Z",
  actor: { full_name: "Andrés Gómez", email: "andres@volleytip.test" },
};

function buildAuditRows(count: number): readonly FakeAuditRow[] {
  return Array.from({ length: count }, (_, index) => ({
    ...AUDIT_ROW,
    id: `entrada-${index}`,
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resumen: datos", () => {
  it("cuenta los mensajes nuevos y las dos listas de espera", async () => {
    const { view } = await loadView({
      newMessages: 3,
      appWaitlist: 12040,
      campWaitlist: 7,
    });

    expect(view.cards.map(({ id, value }) => [id, value])).toEqual([
      ["new-messages", { status: "ok", value: "3" }],
      ["app-waitlist", { status: "ok", value: "12.040" }],
      ["camp-notify", { status: "ok", value: "7" }],
    ]);
  });

  it("cuenta en la base, sin traer las filas", async () => {
    const { api } = await loadView();

    const counted = api.requests
      .filter(({ method }) => method === "HEAD")
      .map(({ url }) => `${url.pathname}?${url.searchParams.toString()}`);

    expect(counted.sort()).toEqual([
      "/rest/v1/messages?select=id&status=eq.new",
      "/rest/v1/waitlists?select=id&kind=eq.app",
      "/rest/v1/waitlists?select=id&kind=eq.camp_notify",
    ]);
  });

  it("pide las diez entradas más recientes de la bitácora", async () => {
    const { api } = await loadView();

    const audit = api.requests.find(({ url }) =>
      url.pathname.endsWith("/audit_log"),
    );

    expect(audit?.url.searchParams.get("order")).toBe(
      "created_at.desc,id.desc",
    );
    expect(audit?.url.searchParams.get("limit")).toBe("10");
  });

  it("lista cada entrada con fecha, quién y acción", async () => {
    const { view } = await loadView({ auditRows: buildAuditRows(2) });

    expect(view.activity).toEqual({
      status: "ok",
      value: [0, 1].map((index) => ({
        id: `entrada-${index}`,
        action: "faq.update",
        actorName: "Andrés Gómez",
        dateTime: "2026-11-26T19:30:00Z",
        date: expect.stringMatching(/26\/11\/26.*2:30/),
      })),
    });
  });

  it("nombra por el correo a quien no tiene nombre y deja sin actor al sistema", async () => {
    const actor = { full_name: "  ", email: "camilo@volleytip.test" };

    const { view } = await loadView({
      auditRows: [
        { ...AUDIT_ROW, actor },
        { ...AUDIT_ROW, id: "sin-actor", actor: null },
      ],
    });

    expect(view.activity).toMatchObject({
      value: [{ actorName: "camilo@volleytip.test" }, { actorName: null }],
    });
  });

  it("formatea fechas y números según el idioma", async () => {
    const { view } = await loadView(
      { appWaitlist: 12040, auditRows: buildAuditRows(1) },
      { language: "en" },
    );

    expect(view.cards[1]?.value).toEqual({ status: "ok", value: "12,040" });
    expect(view.activity).toMatchObject({
      value: [{ date: expect.stringMatching(/^11\/26\/26.*2:30\sPM$/) }],
    });
  });
});

describe("resumen: vacío", () => {
  it("deja cada tarjeta en cero, sin actividad y sin descartes", async () => {
    const { view } = await loadView();

    expect(view.cards.map(({ value }) => value)).toEqual(
      Array(3).fill({ status: "ok", value: "0" }),
    );
    expect(view.activity).toEqual({ status: "ok", value: [] });
    expect(view.rejections).toEqual({
      status: "ok",
      value: { total: "0", forms: [] },
    });
  });
});

describe("resumen: tarjetas de módulos", () => {
  it("pinta la tarjeta que declara un módulo, con enlace a su página", async () => {
    const modules = defineModules([
      sampleModule("pedidos", {
        overviewCard: {
          labelKey: "panel.sample.team",
          count: () => Promise.resolve(4),
        },
      }),
    ]);

    const { view } = await loadView({}, { modules, language: "en" });

    expect(view.cards.at(-1)).toEqual({
      id: "pedidos",
      labelKey: "panel.sample.team",
      value: { status: "ok", value: "4" },
      href: "/en/admin/pedidos-en",
    });
  });

  it("un módulo sin tarjeta no agrega ninguna", async () => {
    const { view } = await loadView({}, { modules: [sampleModule("ajustes")] });

    expect(view.cards).toHaveLength(3);
  });

  it.each([
    ["es", "/admin/messages-es?estado=new"],
    ["en", "/en/admin/messages-en?estado=new"],
  ] as const)(
    "con el módulo de mensajes, en %s su tarjeta abre la bandeja filtrada por nuevos",
    async (language, href) => {
      const { view } = await loadView(
        {},
        { modules: [sampleModule("messages")], language },
      );

      expect(view.cards[0]).toMatchObject({ id: "new-messages", href });
    },
  );

  it("sin el módulo de mensajes, la tarjeta no es un enlace", async () => {
    const { view } = await loadView();

    expect(view.cards.every(({ href }) => href === undefined)).toBe(true);
  });
});

describe("resumen: fallo parcial", () => {
  it("marca la tarjeta que falló y deja las demás", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { view } = await loadView({
      failing: ["messages"],
      appWaitlist: 2,
      auditRows: buildAuditRows(1),
    });

    expect(view.cards.map(({ value }) => value.status)).toEqual([
      "failed",
      "ok",
      "ok",
    ]);
    expect(view.activity.status).toBe("ok");
    expect(view.rejections.status).toBe("ok");
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("new-messages"),
      expect.any(Error),
    );
  });

  it.each([
    ["audit_log", "activity"],
    ["form_rejections", "rejections"],
  ] as const)("si falla %s, solo su bloque lo dice", async (table, block) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { view } = await loadView({ failing: [table] });

    expect(view[block]).toEqual({ status: "failed" });
    expect(view.cards.every(({ value }) => value.status === "ok")).toBe(true);
  });

  it("una tarjeta de módulo que lanza no tumba el resumen", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const modules = [
      sampleModule("camps", {
        overviewCard: {
          labelKey: "panel.sample.team",
          count: () => {
            throw new Error("sin tabla");
          },
        },
      }),
    ];

    const { view } = await loadView({}, { modules });

    expect(view.cards.at(-1)?.value).toEqual({ status: "failed" });
    expect(view.cards[0]?.value.status).toBe("ok");
  });
});

describe("resumen: envíos descartados", () => {
  it("pide los últimos siete días, contando hoy en UTC", async () => {
    const { api } = await loadView();

    const rejections = api.requests.find(({ url }) =>
      url.pathname.endsWith("/form_rejections"),
    );

    expect(rejections?.url.searchParams.get("day")).toBe("gte.2026-11-20");
  });

  it("agrupa por formulario y motivo, de mayor a menor", async () => {
    const { view } = await loadView({
      rejectionRows: [
        { form: "contact", reason: "honeypot", count: 2 },
        { form: "app_waitlist", reason: "turnstile", count: 10000 },
        { form: "contact", reason: "too_fast", count: 1 },
        { form: "contact", reason: "too_fast", count: 5 },
      ],
    });

    expect(view.rejections).toMatchObject({
      value: {
        total: "10.008",
        forms: [
          {
            form: "app_waitlist",
            total: "10.000",
            reasons: [{ reason: "turnstile", count: "10.000" }],
          },
          {
            form: "contact",
            total: "8",
            reasons: [
              { reason: "too_fast", count: "6" },
              { reason: "honeypot", count: "2" },
            ],
          },
        ],
      },
    });
  });

  it("nombra los formularios y motivos que conoce y deja el id de los demás", async () => {
    const { view } = await loadView({
      rejectionRows: [
        { form: "contact", reason: "rate_limit", count: 2 },
        { form: "nuevo_formulario", reason: "validation", count: 1 },
      ],
    });

    expect(view.rejections).toMatchObject({
      value: {
        forms: [
          {
            labelKey: "panel.overview.form.contact",
            reasons: [{ labelKey: "panel.overview.reason.rateLimit" }],
          },
          { form: "nuevo_formulario", labelKey: undefined },
        ],
      },
    });
  });
});
