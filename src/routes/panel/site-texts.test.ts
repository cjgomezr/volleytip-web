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
  stubSiteTextsApi,
  type FakeTextRow,
} from "~/testing/fake-site-texts-api";
import {
  ADMIN_PROFILE,
  buildSessionCookie,
  FAKE_USER_ID,
} from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";
import { loader } from "./site-texts";
import { action as saveBar } from "./site-texts-announcements";
import { action as saveStats } from "./site-texts-stats";

type Fields = [string, string][];

interface Message {
  readonly es: string;
  readonly en?: string;
}

function buildRequestArgs<Args>(path: string, fields?: Fields): Args {
  const request = new Request(`http://localhost${path}`, {
    method: fields === undefined ? "GET" : "POST",
    headers: { Cookie: buildSessionCookie(TEST_ENV.SUPABASE_URL) },
    body: fields === undefined ? undefined : new URLSearchParams(fields),
  });
  const context = new RouterContextProvider();
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  return { request, context, params: {} } as unknown as Args;
}

function loadScreen(): ReturnType<typeof loader> {
  return loader(buildRequestArgs("/admin/textos"));
}

function submitBar(messages: readonly Message[]): ReturnType<typeof saveBar> {
  const fields = messages.flatMap(({ es, en = "" }): Fields => [
    ["es", es],
    ["en", en],
  ]);
  return saveBar(buildRequestArgs("/admin/textos/barra", fields));
}

const STORED_TEXTS: readonly FakeTextRow[] = [
  { key: "stats.instagram.value", locale: "es", value: "116K" },
  { key: "stats.instagram.value", locale: "en", value: "116K" },
  { key: "stats.instagram.label", locale: "es", value: "seguidores" },
  { key: "stats.instagram.label", locale: "en", value: "followers" },
];

const STAT_FIELD_NAMES = ["instagram", "tiktok", "views", "region"].flatMap(
  (id) =>
    ["value", "label"].flatMap((part) =>
      ["es", "en"].map((locale) => `stats.${id}.${part}:${locale}`),
    ),
);

/** El formulario de las cifras tal como lo manda la pantalla: todos los
 * campos, con lo guardado salvo lo que se cambie. */
function statFields(changes: Record<string, string>): Fields {
  return STAT_FIELD_NAMES.map((name) => {
    const stored = STORED_TEXTS.find(
      ({ key, locale }) => `${key}:${locale}` === name,
    );
    return [name, changes[name] ?? stored?.value ?? ""];
  });
}

function submitStats(
  changes: Record<string, string> = {},
): ReturnType<typeof saveStats> {
  return saveStats(
    buildRequestArgs("/admin/textos/cifras", statFields(changes)),
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

function storedBar(messages: readonly Message[]): unknown {
  return messages.map((text) => ({ text }));
}

function readWrittenBar(writes: readonly unknown[]): unknown {
  expect(writes).toHaveLength(1);
  const [write] = writes;
  const row: unknown = Array.isArray(write) ? write[0] : write;
  expect(row).toMatchObject({ key: "announcement_bar" });
  return (row as { value: unknown }).value;
}

const ONE = { es: "Uno", en: "One" };
const THREE: readonly Message[] = [
  ONE,
  { es: "Dos", en: "Two" },
  { es: "Tres", en: "Three" },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("textos: barra de anuncios", () => {
  it("la pantalla recibe los mensajes y las cifras actuales", async () => {
    stubSiteTextsApi({
      announcementBar: storedBar(THREE),
      siteTexts: STORED_TEXTS,
    });

    const data = await loadScreen();

    expect(data.bar).toEqual({ messages: THREE, invalidValue: null });
    expect(data.stats[0]).toEqual({
      id: "instagram",
      value: { es: "116K", en: "116K" },
      label: { es: "seguidores", en: "followers" },
    });
    expect(data.stats.map(({ id }) => id)).toEqual([
      "instagram",
      "tiktok",
      "views",
      "region",
    ]);
    expect(data.limits.maxMessages).toBe(3);
  });

  it("sin la fila de la barra, la pantalla abre sin mensajes", async () => {
    stubSiteTextsApi();

    const data = await loadScreen();

    expect(data.bar).toEqual({ messages: [], invalidValue: null });
  });

  it.each([1, 2, 3])("guarda %i mensajes en su orden", async (count) => {
    const api = stubSiteTextsApi();
    const messages = THREE.slice(0, count);

    const result = await submitBar(messages);

    expect(readResult(result)).toEqual({
      status: 200,
      body: { status: "saved" },
    });
    expect(readWrittenBar(api.settingsWrites)).toEqual(storedBar(messages));
  });

  it("guarda el orden nuevo con la sesión de la persona", async () => {
    const api = stubSiteTextsApi({ announcementBar: storedBar(THREE) });
    const reordered = [...THREE].reverse();

    await submitBar(reordered);

    expect(readWrittenBar(api.settingsWrites)).toEqual(storedBar(reordered));
    expect(api.writeAuthorizations).toEqual(["Bearer acceso-vigente"]);
  });

  it("guarda un mensaje sin inglés, sin inventarle una traducción", async () => {
    const api = stubSiteTextsApi();

    const result = await submitBar([{ es: "  Solo español ", en: "  " }]);

    expect(readResult(result).status).toBe(200);
    expect(readWrittenBar(api.settingsWrites)).toEqual([
      { text: { es: "Solo español" } },
    ]);
  });

  it("rechaza un mensaje sin español, junto a su campo y sin guardar", async () => {
    const api = stubSiteTextsApi();
    const messages = [ONE, { es: "   ", en: "Only English" }];

    const result = await submitBar(messages);

    expect(readResult(result)).toEqual({
      status: 400,
      body: {
        status: "invalid",
        values: messages,
        fieldErrors: { "1.es": "required" },
        formError: null,
      },
    });
    expect(api.settingsWrites).toEqual([]);
  });

  it("rechaza un cuarto mensaje aunque llegue al servidor", async () => {
    const api = stubSiteTextsApi();
    const messages = [...THREE, { es: "Cuatro", en: "Four" }];

    const result = await submitBar(messages);

    expect(readResult(result)).toMatchObject({
      status: 400,
      body: { status: "invalid", formError: "tooMany", values: messages },
    });
    expect(api.settingsWrites).toEqual([]);
  });

  it("rechaza un envío con los idiomas descuadrados", async () => {
    const api = stubSiteTextsApi();

    const result = await saveBar(
      buildRequestArgs("/admin/textos/barra", [["es", "Uno"]]),
    );

    expect(readResult(result).status).toBe(400);
    expect(api.settingsWrites).toEqual([]);
  });

  it("guarda la barra vacía", async () => {
    const api = stubSiteTextsApi({ announcementBar: storedBar(THREE) });

    const result = await submitBar([]);

    expect(readResult(result).body).toEqual({ status: "saved" });
    expect(readWrittenBar(api.settingsWrites)).toEqual([]);
  });
});

describe("textos: cifras", () => {
  it("guarda el valor y la etiqueta de cada idioma, solo lo que cambió", async () => {
    const api = stubSiteTextsApi({ siteTexts: STORED_TEXTS });

    const result = await submitStats({
      "stats.instagram.value:es": "120K",
      "stats.instagram.label:en": "fans",
    });

    expect(readResult(result).body).toEqual({ status: "saved" });
    expect(api.siteTextWrites).toEqual([
      [
        { key: "stats.instagram.value", locale: "es", value: "120K" },
        { key: "stats.instagram.label", locale: "en", value: "fans" },
      ],
    ]);
    expect(api.writeAuthorizations).toEqual(["Bearer acceso-vigente"]);
  });

  it("guarda una cifra con el valor vacío", async () => {
    const api = stubSiteTextsApi({ siteTexts: STORED_TEXTS });

    const result = await submitStats({
      "stats.instagram.value:es": "",
      "stats.instagram.value:en": "",
    });

    expect(readResult(result).status).toBe(200);
    expect(api.siteTextWrites).toEqual([
      [
        { key: "stats.instagram.value", locale: "es", value: "" },
        { key: "stats.instagram.value", locale: "en", value: "" },
      ],
    ]);
  });

  it("no borra un texto cuyo campo no llega en el envío", async () => {
    const api = stubSiteTextsApi({ siteTexts: STORED_TEXTS });

    const result = await saveStats(
      buildRequestArgs("/admin/textos/cifras", [
        ["stats.instagram.value:es", "120K"],
      ]),
    );

    expect(readResult(result).status).toBe(400);
    expect(api.siteTextWrites).toEqual([]);
  });
});

describe("textos: validación", () => {
  it.each(["es", "en"])(
    "rechaza un mensaje en %s más largo que su límite y conserva lo escrito",
    async (language) => {
      const api = stubSiteTextsApi();
      const { limits } = await loadScreen();
      const long = "a".repeat(limits.maxMessageLength + 1);
      const message = { ...ONE, [language]: long };

      const result = await submitBar([message]);

      expect(readResult(result)).toMatchObject({
        status: 400,
        body: {
          values: [message],
          fieldErrors: { [`0.${language}`]: "tooLong" },
        },
      });
      expect(api.settingsWrites).toEqual([]);
    },
  );

  it("acepta un mensaje justo en el límite", async () => {
    stubSiteTextsApi();
    const { limits } = await loadScreen();

    const result = await submitBar([
      { es: "a".repeat(limits.maxMessageLength) },
    ]);

    expect(readResult(result).status).toBe(200);
  });

  it.each([
    ["stats.tiktok.value:es", "maxStatValueLength"],
    ["stats.views.label:en", "maxStatLabelLength"],
  ] as const)(
    "rechaza %s más largo que su límite y conserva lo escrito",
    async (field, limit) => {
      const api = stubSiteTextsApi({ siteTexts: STORED_TEXTS });
      const { limits } = await loadScreen();
      const long = "a".repeat(limits[limit] + 1);

      const result = await submitStats({ [field]: long });

      expect(readResult(result)).toMatchObject({
        status: 400,
        body: {
          status: "invalid",
          values: { [field]: long },
          fieldErrors: { [field]: "tooLong" },
        },
      });
      expect(api.siteTextWrites).toEqual([]);
    },
  );

  it("guarda el HTML tal cual", async () => {
    const api = stubSiteTextsApi({ siteTexts: STORED_TEXTS });
    const html = "<b>Hola</b> & <i>chao</i>";

    await submitBar([{ es: html }]);
    await submitStats({ "stats.instagram.label:es": html });

    expect(readWrittenBar(api.settingsWrites)).toEqual([
      { text: { es: html } },
    ]);
    expect(api.siteTextWrites).toEqual([
      [{ key: "stats.instagram.label", locale: "es", value: html }],
    ]);
  });

  it("cambia saltos de línea y caracteres de control por un espacio", async () => {
    const api = stubSiteTextsApi();

    await submitBar([{ es: "Uno\u0000\r\ndos" }]);

    expect(readWrittenBar(api.settingsWrites)).toEqual([
      { text: { es: "Uno dos" } },
    ]);
  });
});

describe("textos: bitácora", () => {
  it("deja el antes y el después de la barra", async () => {
    const before = storedBar(THREE.slice(0, 1));
    const api = stubSiteTextsApi({ announcementBar: before });

    await submitBar(THREE.slice(0, 2));

    expect(api.auditRows).toEqual([
      {
        actor_id: FAKE_USER_ID,
        action: "setting.update",
        entity: "setting",
        entity_id: null,
        details: {
          key: "announcement_bar",
          before: { messages: before },
          after: { messages: storedBar(THREE.slice(0, 2)) },
        },
      },
    ]);
  });

  it("deja el antes y el después de las cifras que cambiaron", async () => {
    const api = stubSiteTextsApi({ siteTexts: STORED_TEXTS });

    await submitStats({ "stats.instagram.value:es": "120K" });

    expect(api.auditRows).toEqual([
      {
        actor_id: FAKE_USER_ID,
        action: "site_text.update",
        entity: "site_text",
        entity_id: null,
        details: {
          key: "stats",
          before: { "stats.instagram.value:es": "116K" },
          after: { "stats.instagram.value:es": "120K" },
        },
      },
    ]);
  });

  it("guardar la barra sin cambios no escribe ni registra", async () => {
    const api = stubSiteTextsApi({ announcementBar: storedBar(THREE) });

    const result = await submitBar(THREE);

    expect(readResult(result).body).toEqual({ status: "unchanged" });
    expect(api.settingsWrites).toEqual([]);
    expect(api.auditRows).toEqual([]);
  });

  it("guardar vacía una barra que no existe no registra", async () => {
    const api = stubSiteTextsApi();

    const result = await submitBar([]);

    expect(readResult(result).body).toEqual({ status: "unchanged" });
    expect(api.auditRows).toEqual([]);
  });

  it("guardar las cifras sin cambios no escribe ni registra", async () => {
    const api = stubSiteTextsApi({ siteTexts: STORED_TEXTS });

    const result = await submitStats();

    expect(readResult(result).body).toEqual({ status: "unchanged" });
    expect(api.siteTextWrites).toEqual([]);
    expect(api.auditRows).toEqual([]);
  });
});

describe("textos: valor inválido en la base", () => {
  const BROKEN = [{ text: { es: "Sirve" } }, { texto: "no sirve" }];

  it("la pantalla abre, lo marca y rescata lo que se puede", async () => {
    stubSiteTextsApi({ announcementBar: BROKEN });

    const data = await loadScreen();

    expect(data.bar.messages).toEqual([{ es: "Sirve", en: "" }]);
    expect(JSON.parse(data.bar.invalidValue ?? "")).toEqual(BROKEN);
  });

  it.each([
    ["una cadena", "hola"],
    ["un objeto", { text: 1 }],
    ["nulo", null],
  ])("abre sin mensajes cuando el valor es %s", async (_case, value) => {
    stubSiteTextsApi({ announcementBar: value });

    const data = await loadScreen();

    expect(data.bar.messages).toEqual([]);
    expect(data.bar.invalidValue).not.toBeNull();
  });

  it("deja corregirlo, incluso guardando la barra vacía", async () => {
    const api = stubSiteTextsApi({ announcementBar: BROKEN });

    const result = await submitBar([]);

    expect(readResult(result).body).toEqual({ status: "saved" });
    expect(readWrittenBar(api.settingsWrites)).toEqual([]);
    expect(api.auditRows).toMatchObject([
      { details: { before: { messages: BROKEN }, after: { messages: [] } } },
    ]);
  });
});

describe("textos: valor nulo en la base", () => {
  it("guardar la barra vacía lo reemplaza", async () => {
    const api = stubSiteTextsApi({ announcementBar: null });

    const result = await submitBar([]);

    expect(readResult(result).body).toEqual({ status: "saved" });
    expect(readWrittenBar(api.settingsWrites)).toEqual([]);
  });
});

describe("textos: permisos", () => {
  const OUTSIDERS = [
    ["un buyer", "buyer", 404],
    ["el staff", "staff", 302],
  ] as const;

  async function readStatus(work: () => Promise<unknown>): Promise<number> {
    try {
      await work();
    } catch (thrown) {
      if (thrown instanceof Response) return thrown.status;
      return (thrown as { init: ResponseInit }).init.status ?? 200;
    }
    throw new Error("Se esperaba que la guardia cortara la petición");
  }

  it("la pantalla y sus envíos están bajo la guardia de admin", () => {
    expect(PANEL_ADMIN_PAGES.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "adminSiteTexts",
        "adminSiteTextsAnnouncements",
        "adminSiteTextsStats",
      ]),
    );
  });

  it.each(OUTSIDERS)(
    "%s no llega a leer la pantalla",
    async (_case, role, code) => {
      stubSiteTextsApi({ profile: { ...ADMIN_PROFILE, role } });
      const args =
        buildRequestArgs<Parameters<typeof requirePanelMember>[0]>(
          "/admin/textos",
        );
      const next = vi.fn();

      const status = await readStatus(async () => {
        await requirePanelMember(args, next);
        expect(args.context.get(panelMemberContext).role).toBe(role);
        await requireAdmin(args, next);
      });

      expect(status).toBe(code);
    },
  );

  it.each(OUTSIDERS)("%s no guarda la barra", async (_case, role, code) => {
    const api = stubSiteTextsApi({ profile: { ...ADMIN_PROFILE, role } });

    const status = await readStatus(() => submitBar(THREE));

    expect(status).toBe(code);
    expect(api.settingsWrites).toEqual([]);
  });

  it.each(OUTSIDERS)("%s no guarda las cifras", async (_case, role, code) => {
    const api = stubSiteTextsApi({ profile: { ...ADMIN_PROFILE, role } });

    const status = await readStatus(() =>
      submitStats({ "stats.instagram.value:es": "1" }),
    );

    expect(status).toBe(code);
    expect(api.siteTextWrites).toEqual([]);
  });
});
