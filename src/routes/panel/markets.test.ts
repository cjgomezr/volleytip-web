import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { panelSessionContext } from "~/lib/panel/panel-middleware.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import {
  COLOMBIA_ROW,
  ENGLISH_ROW,
  SPANISH_ROW,
  stubMarketsApi,
  type FakeMarketsApi,
} from "~/testing/fake-markets-api";
import {
  ADMIN_PROFILE,
  buildSessionCookie,
  VALID_ACCESS_TOKEN,
} from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";
import { loader } from "./markets";
import { action as languageAction } from "./markets-language";
import { action as marketAction } from "./markets-market";
import { action as rateAction } from "./markets-rate";

type Fields = readonly (readonly [string, string])[];

const BASE_PATH = "/admin/mercados";

function buildArgs<Args>(path: string, fields?: Fields): Args {
  const request = new Request(`http://localhost${path}`, {
    method: fields === undefined ? "GET" : "POST",
    headers: { Cookie: buildSessionCookie(TEST_ENV.SUPABASE_URL) },
    body:
      fields === undefined
        ? undefined
        : new URLSearchParams(fields.map(([name, value]) => [name, value])),
  });
  const context = new RouterContextProvider();
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  return { request, context, params: {} } as unknown as Args;
}

function loadScreen(): ReturnType<typeof loader> {
  return loader(buildArgs(BASE_PATH));
}

function submitLanguage(fields: Fields): ReturnType<typeof languageAction> {
  return languageAction(buildArgs(`${BASE_PATH}/idioma`, fields));
}

function submitMarket(fields: Fields): ReturnType<typeof marketAction> {
  return marketAction(buildArgs(`${BASE_PATH}/mercado`, fields));
}

function submitRate(value: string): ReturnType<typeof rateAction> {
  return rateAction(buildArgs(`${BASE_PATH}/tasa`, [["rate", value]]));
}

interface MarketSubmission {
  readonly id?: string;
  readonly isActive?: boolean;
  readonly shipsPhysical?: boolean;
  readonly defaultLocale?: string;
  readonly paymentMethods?: readonly string[];
}

// Como lo manda el formulario: cada casilla lleva un "false" oculto antes.
function marketFields({
  id = COLOMBIA_ROW.id,
  isActive = true,
  shipsPhysical = true,
  defaultLocale = "es",
  paymentMethods = ["card", "pse"],
}: MarketSubmission = {}): Fields {
  const checkbox = (name: string, isChecked: boolean): Fields => [
    [name, "false"],
    ...(isChecked ? [[name, "true"] as const] : []),
  ];
  return [
    ["id", id],
    ...checkbox("isActive", isActive),
    ...checkbox("shipsPhysical", shipsPhysical),
    ["defaultLocale", defaultLocale],
    ...paymentMethods.map((method) => ["paymentMethods", method] as const),
  ];
}

/** El estado y el cuerpo de la respuesta de un `action`. */
function readResult(result: unknown): { status: number; body: unknown } {
  if (
    typeof result === "object" &&
    result !== null &&
    "type" in result &&
    result.type === "DataWithResponseInit"
  ) {
    const { data, init } = result as unknown as {
      data: unknown;
      init: ResponseInit;
    };
    return { status: init.status ?? 200, body: data };
  }
  return { status: 200, body: result };
}

function expectNothingWritten(api: FakeMarketsApi): void {
  expect(api.tableWrites).toEqual([]);
  expect(api.settingsWrites).toEqual([]);
  expect(api.auditRows).toEqual([]);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("idiomas y mercados: la pantalla", () => {
  it("lista los idiomas, los mercados con sus datos y la tasa", async () => {
    stubMarketsApi({ settings: { usd_reference_rate: 4000 } });

    await expect(loadScreen()).resolves.toEqual({
      languages: [
        { code: "es", name: "Español", isDefault: true, isActive: true },
        { code: "en", name: "English", isDefault: false, isActive: true },
      ],
      markets: [
        {
          id: COLOMBIA_ROW.id,
          countryCode: "CO",
          currency: "COP",
          defaultLocale: "es",
          shipsPhysical: true,
          paymentMethods: ["card", "pse"],
          isActive: true,
        },
      ],
      usdRate: { state: "set", value: "4000" },
    });
  });

  it("sin tasa guardada lo dice y deja el campo vacío", async () => {
    stubMarketsApi();

    const { usdRate } = await loadScreen();

    expect(usdRate).toEqual({ state: "missing", value: "" });
  });

  it.each([
    [4000.5, "4000.5"],
    [0, "0"],
    ["mucho", "mucho"],
  ])(
    "muestra como inválida la tasa guardada %j, para corregirla",
    async (stored, value) => {
      stubMarketsApi({ settings: { usd_reference_rate: stored } });

      const { usdRate } = await loadScreen();

      expect(usdRate).toEqual({ state: "invalid", value });
    },
  );
});

describe("idiomas", () => {
  it("desactiva un idioma con la sesión de la persona", async () => {
    const api = stubMarketsApi();

    const result = await submitLanguage([
      ["code", "en"],
      ["isActive", "false"],
    ]);

    expect(readResult(result)).toEqual({
      status: 200,
      body: { status: "saved", code: "en" },
    });
    expect(api.tableWrites).toEqual([
      {
        path: expect.stringContaining("/rest/v1/languages?code=eq.en"),
        body: { is_active: false },
        authorization: `Bearer ${VALID_ACCESS_TOKEN}`,
      },
    ]);
  });

  it("vuelve a activar un idioma", async () => {
    const api = stubMarketsApi({
      languages: [SPANISH_ROW, { ...ENGLISH_ROW, is_active: false }],
    });

    await submitLanguage([
      ["code", "en"],
      ["isActive", "true"],
    ]);

    expect(api.tableWrites.map(({ body }) => body)).toEqual([
      { is_active: true },
    ]);
  });

  it("no escribe nada si ya estaba así", async () => {
    const api = stubMarketsApi();

    const result = await submitLanguage([
      ["code", "en"],
      ["isActive", "true"],
    ]);

    expect(readResult(result).body).toEqual({
      status: "unchanged",
      code: "en",
    });
    expectNothingWritten(api);
  });

  it("explica por qué la base no deja desactivar el idioma por defecto", async () => {
    const api = stubMarketsApi({
      writeRejection:
        'new row for relation "languages" violates check constraint "languages_default_active_check"',
    });

    const result = await submitLanguage([
      ["code", "es"],
      ["isActive", "false"],
    ]);

    expect(readResult(result)).toEqual({
      status: 400,
      body: { status: "invalid", code: "es", error: "defaultLanguage" },
    });
    expect(api.auditRows).toEqual([]);
  });

  it.each<[string, Fields]>([
    [
      "un idioma que no existe",
      [
        ["code", "fr"],
        ["isActive", "true"],
      ],
    ],
    ["sin código", [["isActive", "true"]]],
    ["sin el valor", [["code", "en"]]],
    [
      "un valor que no es sí ni no",
      [
        ["code", "en"],
        ["isActive", "tal vez"],
      ],
    ],
  ])("rechaza %s", async (_name, fields) => {
    const api = stubMarketsApi();

    const result = await submitLanguage(fields);

    expect(readResult(result)).toMatchObject({
      status: 400,
      body: { status: "invalid", error: "malformed" },
    });
    expectNothingWritten(api);
  });

  it("un fallo de la base que no es una regla se lanza", async () => {
    stubMarketsApi({ writeRejection: "se cayó el disco" });

    await expect(
      submitLanguage([
        ["code", "en"],
        ["isActive", "false"],
      ]),
    ).rejects.toThrow(/se cayó el disco/);
  });

  it("falla si la base no cambió ninguna fila", async () => {
    stubMarketsApi({ isWriteIgnored: true });

    await expect(
      submitLanguage([
        ["code", "en"],
        ["isActive", "false"],
      ]),
    ).rejects.toThrow(/ninguna fila/);
  });
});

describe("mercados", () => {
  it.each<[string, MarketSubmission, Record<string, unknown>]>([
    ["si está activo", { isActive: false }, { is_active: false }],
    [
      "si recibe envíos físicos",
      { shipsPhysical: false },
      { ships_physical: false },
    ],
    [
      "su idioma por defecto",
      { defaultLocale: "en" },
      { default_locale: "en" },
    ],
    [
      "sus medios de pago",
      { paymentMethods: ["nequi"] },
      { payment_methods: ["nequi"] },
    ],
    [
      "quitar todos los medios de pago",
      { paymentMethods: [] },
      { payment_methods: [] },
    ],
  ])("edita %s", async (_name, submission, changed) => {
    const api = stubMarketsApi();

    const result = await submitMarket(marketFields(submission));

    expect(readResult(result).body).toEqual({
      status: "saved",
      id: COLOMBIA_ROW.id,
    });
    expect(api.tableWrites).toEqual([
      {
        path: expect.stringContaining(
          `/rest/v1/markets?id=eq.${COLOMBIA_ROW.id}`,
        ),
        body: {
          is_active: true,
          ships_physical: true,
          default_locale: "es",
          payment_methods: ["card", "pse"],
          ...changed,
        },
        authorization: `Bearer ${VALID_ACCESS_TOKEN}`,
      },
    ]);
  });

  it("no escribe nada si solo cambia el orden de los medios de pago", async () => {
    const api = stubMarketsApi();

    const result = await submitMarket(
      marketFields({ paymentMethods: ["pse", "card", "card"] }),
    );

    expect(readResult(result).body).toMatchObject({ status: "unchanged" });
    expectNothingWritten(api);
  });

  it("solo deja elegir un idioma activo", async () => {
    const api = stubMarketsApi({
      languages: [SPANISH_ROW, { ...ENGLISH_ROW, is_active: false }],
    });

    const result = await submitMarket(marketFields({ defaultLocale: "en" }));

    expect(readResult(result)).toMatchObject({
      status: 400,
      body: {
        status: "invalid",
        errors: { defaultLocale: "inactiveLanguage" },
        values: { defaultLocale: "en" },
      },
    });
    expectNothingWritten(api);
  });

  it.each(["paypal", "club_code", ""])(
    "rechaza el medio de pago %j, que no está en la lista",
    async (method) => {
      const api = stubMarketsApi();

      const result = await submitMarket(
        marketFields({ paymentMethods: ["card", method] }),
      );

      expect(readResult(result)).toMatchObject({
        status: 400,
        body: {
          status: "invalid",
          errors: { paymentMethods: "unknownMethod" },
        },
      });
      expectNothingWritten(api);
    },
  );

  it("explica por qué la base no deja apagar el único mercado activo", async () => {
    const api = stubMarketsApi({
      writeRejection:
        "markets_last_active_check: no se puede desactivar el único mercado activo",
    });

    const result = await submitMarket(marketFields({ isActive: false }));

    expect(readResult(result)).toMatchObject({
      status: 400,
      body: {
        status: "invalid",
        id: COLOMBIA_ROW.id,
        formError: "lastActiveMarket",
        values: { isActive: false },
      },
    });
    expect(api.auditRows).toEqual([]);
  });

  it("pinta junto al campo el rechazo de un idioma que se apagó en ese instante", async () => {
    stubMarketsApi({
      writeRejection:
        "markets_default_locale_active_check: el idioma en está desactivado",
    });

    const result = await submitMarket(marketFields({ defaultLocale: "en" }));

    expect(readResult(result)).toMatchObject({
      status: 400,
      body: { errors: { defaultLocale: "inactiveLanguage" } },
    });
  });

  it.each<[string, Fields]>([
    [
      "un mercado que no existe",
      marketFields({ id: "00000000-0000-4000-8000-000000000000" }),
    ],
    ["un id que no es un uuid", marketFields({ id: "CO" })],
    [
      "un envío sin la casilla de activo",
      marketFields().filter(([name]) => name !== "isActive"),
    ],
    [
      "un envío sin la casilla de envíos",
      marketFields().filter(([name]) => name !== "shipsPhysical"),
    ],
    [
      "un envío sin idioma",
      marketFields().filter(([name]) => name !== "defaultLocale"),
    ],
  ])("rechaza %s", async (_name, fields) => {
    const api = stubMarketsApi();

    const result = await submitMarket(fields);

    expect(readResult(result)).toMatchObject({
      status: 400,
      body: { status: "invalid", formError: "malformed" },
    });
    expectNothingWritten(api);
  });
});

describe("tasa del dólar", () => {
  it.each([
    ["4150", 4150],
    [" 4150 ", 4150],
    ["1", 1],
  ])("guarda el entero positivo %j", async (typed, stored) => {
    const api = stubMarketsApi();

    const result = await submitRate(typed);

    expect(readResult(result).body).toEqual({ status: "saved" });
    expect(api.settingsWrites).toEqual([
      {
        body: { key: "usd_reference_rate", value: stored },
        authorization: `Bearer ${VALID_ACCESS_TOKEN}`,
      },
    ]);
  });

  it.each([
    ["", "required"],
    ["   ", "required"],
    ["0", "notPositiveInteger"],
    ["-4000", "notPositiveInteger"],
    ["4000.5", "notPositiveInteger"],
    ["4.000", "notPositiveInteger"],
    ["4000,5", "notPositiveInteger"],
    ["4e3", "notPositiveInteger"],
    ["0x10", "notPositiveInteger"],
    ["cuatro mil", "notPositiveInteger"],
    ["99999999999999999999", "notPositiveInteger"],
  ])("rechaza %j con un 400 junto al campo", async (typed, error) => {
    const api = stubMarketsApi();

    const result = await submitRate(typed);

    expect(readResult(result)).toEqual({
      status: 400,
      body: { status: "invalid", value: typed, error },
    });
    expectNothingWritten(api);
  });

  it("rechaza un envío sin el campo", async () => {
    const api = stubMarketsApi();

    const result = await rateAction(buildArgs(`${BASE_PATH}/tasa`, []));

    expect(readResult(result)).toMatchObject({
      status: 400,
      body: { error: "required" },
    });
    expectNothingWritten(api);
  });

  it("no escribe nada si la tasa no cambió", async () => {
    const api = stubMarketsApi({ settings: { usd_reference_rate: 4150 } });

    const result = await submitRate("4150");

    expect(readResult(result).body).toEqual({ status: "unchanged" });
    expectNothingWritten(api);
  });
});

describe("idiomas y mercados: bitácora", () => {
  it("registra el antes y el después de un idioma", async () => {
    const api = stubMarketsApi();

    await submitLanguage([
      ["code", "en"],
      ["isActive", "false"],
    ]);

    expect(api.auditRows).toEqual([
      expect.objectContaining({
        action: "language.set_active",
        entity: "language",
        entity_id: null,
        details: {
          key: "en",
          before: { is_active: true },
          after: { is_active: false },
        },
      }),
    ]);
  });

  it("registra de un mercado solo los campos que cambiaron", async () => {
    const api = stubMarketsApi();

    await submitMarket(
      marketFields({ shipsPhysical: false, paymentMethods: ["nequi"] }),
    );

    expect(api.auditRows).toEqual([
      expect.objectContaining({
        action: "market.update",
        entity: "market",
        entity_id: COLOMBIA_ROW.id,
        details: {
          before: {
            ships_physical: true,
            payment_methods: ["card", "pse"],
          },
          after: { ships_physical: false, payment_methods: ["nequi"] },
        },
      }),
    ]);
  });

  it("registra el antes y el después de la tasa", async () => {
    const api = stubMarketsApi({ settings: { usd_reference_rate: 4000 } });

    await submitRate("4150");

    expect(api.auditRows).toEqual([
      expect.objectContaining({
        action: "settings.set_usd_rate",
        details: {
          key: "usd_reference_rate",
          before: { value: 4000 },
          after: { value: 4150 },
        },
      }),
    ]);
  });
});

describe("idiomas y mercados: permisos", () => {
  const SUBMISSIONS: readonly [string, () => Promise<unknown>][] = [
    [
      "un idioma",
      () =>
        submitLanguage([
          ["code", "en"],
          ["isActive", "false"],
        ]),
    ],
    ["un mercado", () => submitMarket(marketFields({ isActive: false }))],
    ["la tasa", () => submitRate("4150")],
  ];

  function catchThrown(work: () => Promise<unknown>): Promise<unknown> {
    return work().catch((error: unknown) => error);
  }

  it.each(SUBMISSIONS)("un buyer no escribe %s", async (_name, submit) => {
    const api = stubMarketsApi({
      profile: { ...ADMIN_PROFILE, role: "buyer" },
    });

    const thrown = await catchThrown(submit);

    expect(thrown).toMatchObject({ init: { status: 404 } });
    expectNothingWritten(api);
  });

  it.each(SUBMISSIONS)("el staff no escribe %s", async (_name, submit) => {
    const api = stubMarketsApi({
      profile: { ...ADMIN_PROFILE, role: "staff" },
    });

    const thrown = await catchThrown(submit);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).headers.get("Location")).toBe("/admin");
    expectNothingWritten(api);
  });
});
