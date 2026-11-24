import { afterEach, describe, expect, it, vi } from "vitest";

import {
  APP_LINKS_SETTING,
  buildAppSiteAssociation,
  buildAssetLinks,
  readAppLinks,
} from "./app-links.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

const ANDROID = {
  packageName: "com.volleytip.app",
  sha256CertFingerprints: ["AA:BB:CC"],
};
const IOS = { appIds: ["TEAM123456.com.volleytip.app"] };

function createClientStoring(value: unknown | undefined): TypedSupabaseClient {
  const row = value === undefined ? null : { value };
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  };
  return { from: () => query } as unknown as TypedSupabaseClient;
}

function createFailingClient(): TypedSupabaseClient {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () =>
      Promise.resolve({ data: null, error: { message: "base caída" } }),
  };
  return { from: () => query } as unknown as TypedSupabaseClient;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ajuste de enlaces de app", () => {
  const { isValid } = APP_LINKS_SETTING;

  it("usa la clave app_links", () => {
    expect(APP_LINKS_SETTING.key).toBe("app_links");
  });

  it("sin ajuste, no hay datos de ninguna plataforma", async () => {
    expect(await readAppLinks(createClientStoring(undefined))).toEqual({});
  });

  it("devuelve los datos de Android y de iOS guardados", async () => {
    const stored = { android: ANDROID, ios: IOS };

    expect(await readAppLinks(createClientStoring(stored))).toEqual(stored);
  });

  it("acepta solo una plataforma", () => {
    expect(isValid({ android: ANDROID })).toBe(true);
    expect(isValid({ ios: IOS })).toBe(true);
  });

  it.each([
    ["no es un objeto", "texto"],
    ["android sin paquete", { android: { sha256CertFingerprints: ["A"] } }],
    [
      "android sin huellas",
      { android: { packageName: "a.b", sha256CertFingerprints: [] } },
    ],
    ["ios sin ids", { ios: { appIds: [] } }],
    ["ios con ids que no son texto", { ios: { appIds: [1] } }],
  ])("rechaza una forma inválida: %s", (_name, value) => {
    expect(isValid(value)).toBe(false);
  });

  it("con una forma inválida devuelve vacío y deja el error en el registro", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const links = await readAppLinks(createClientStoring({ android: 5 }));

    expect(links).toEqual({});
    expect(log).toHaveBeenCalledOnce();
  });

  it("con la base caída devuelve vacío y deja el error en el registro", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const links = await readAppLinks(createFailingClient());

    expect(links).toEqual({});
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("assetlinks.json", () => {
  it("es una lista vacía sin datos de Android", () => {
    expect(buildAssetLinks({})).toEqual([]);
    expect(buildAssetLinks({ ios: IOS })).toEqual([]);
  });

  it("declara la app de Android con el formato de Google", () => {
    expect(buildAssetLinks({ android: ANDROID })).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.volleytip.app",
          sha256_cert_fingerprints: ["AA:BB:CC"],
        },
      },
    ]);
  });
});

describe("apple-app-site-association", () => {
  it("no tiene detalles sin datos de iOS", () => {
    expect(buildAppSiteAssociation({})).toEqual({ applinks: { details: [] } });
    expect(buildAppSiteAssociation({ android: ANDROID })).toEqual({
      applinks: { details: [] },
    });
  });

  it("declara la app de iOS y solo la ruta /r/ con el formato de Apple", () => {
    expect(buildAppSiteAssociation({ ios: IOS })).toEqual({
      applinks: {
        details: [
          {
            appIDs: ["TEAM123456.com.volleytip.app"],
            components: [{ "/": "/r/*" }, { "/": "/en/r/*" }],
          },
        ],
      },
    });
  });
});
