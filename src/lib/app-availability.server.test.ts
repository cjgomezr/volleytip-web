import { afterEach, describe, expect, it, vi } from "vitest";

import {
  APP_AVAILABILITY_SETTING,
  readAppAvailability,
  resolveAppAvailability,
} from "./app-availability.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

const APP_STORE = "https://apps.apple.com/co/app/volleytip/id123";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.vt";
const WAITLIST = { state: "waitlist" };

function createClientStoring(value: unknown | undefined): TypedSupabaseClient {
  const row = value === undefined ? null : { value };
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  };
  return { from: () => query } as unknown as TypedSupabaseClient;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("disponibilidad de la app", () => {
  const { isValid } = APP_AVAILABILITY_SETTING;

  it("usa la clave app_availability", () => {
    expect(APP_AVAILABILITY_SETTING.key).toBe("app_availability");
  });

  it("sin ajuste, la página está en lista de espera", async () => {
    const availability = await readAppAvailability(
      createClientStoring(undefined),
    );

    expect(availability).toEqual(WAITLIST);
  });

  it("en estado waitlist, está en lista de espera", async () => {
    const client = createClientStoring({ status: "waitlist" });

    expect(await readAppAvailability(client)).toEqual(WAITLIST);
  });

  it("disponible con las dos direcciones, las devuelve", async () => {
    const client = createClientStoring({
      status: "available",
      appStoreUrl: APP_STORE,
      playStoreUrl: PLAY_STORE,
    });

    expect(await readAppAvailability(client)).toEqual({
      state: "available",
      appStoreUrl: APP_STORE,
      playStoreUrl: PLAY_STORE,
    });
  });

  it("disponible con una sola dirección, devuelve solo esa", async () => {
    const client = createClientStoring({
      status: "available",
      playStoreUrl: PLAY_STORE,
    });

    expect(await readAppAvailability(client)).toEqual({
      state: "available",
      appStoreUrl: null,
      playStoreUrl: PLAY_STORE,
    });
  });

  it("disponible sin ninguna dirección, vuelve a lista de espera", () => {
    expect(resolveAppAvailability({ status: "available" })).toEqual(WAITLIST);
  });

  it("con forma inválida, vuelve a lista de espera y deja el error en el registro", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const availability = await readAppAvailability(
      createClientStoring({ status: "casi" }),
    );

    expect(availability).toEqual(WAITLIST);
    expect(logged).toHaveBeenCalledOnce();
    expect(String(logged.mock.calls[0]?.[0])).toContain("app_availability");
  });

  it("una dirección de otro dominio vuelve el ajuste inválido", () => {
    expect(
      isValid({ status: "available", appStoreUrl: "https://evil.example/x" }),
    ).toBe(false);
    expect(
      isValid({
        status: "available",
        playStoreUrl: "http://play.google.com/x",
      }),
    ).toBe(false);
    expect(
      isValid({
        status: "available",
        appStoreUrl: "https://apps.apple.com.evil.example/x",
      }),
    ).toBe(false);
  });

  it("acepta las direcciones oficiales de las dos tiendas", () => {
    expect(
      isValid({
        status: "available",
        appStoreUrl: APP_STORE,
        playStoreUrl: PLAY_STORE,
      }),
    ).toBe(true);
  });

  it("rechaza lo que no es un objeto", () => {
    expect(isValid(null)).toBe(false);
    expect(isValid("available")).toBe(false);
  });

  it("deja pasar los fallos de la base", async () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: () =>
        Promise.resolve({ data: null, error: { message: "caída" } }),
    };
    const client = { from: () => query } as unknown as TypedSupabaseClient;

    await expect(readAppAvailability(client)).rejects.toThrow("caída");
  });
});
