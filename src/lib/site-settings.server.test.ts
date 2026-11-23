import { afterEach, describe, expect, it, vi } from "vitest";

import { ANNOUNCEMENT_BAR_KEY } from "./announcement-bar.server";
import { MAINTENANCE_MODE_KEY } from "./maintenance-mode.server";
import {
  SITE_SETTINGS_TIMEOUT_MS,
  loadSiteSettings,
} from "./site-settings.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function clientReturning(
  result: { data: unknown; error: unknown },
  onQuery: () => void = () => undefined,
): TypedSupabaseClient {
  const query = {
    select: () => query,
    in: () => {
      onQuery();
      return Promise.resolve(result);
    },
  };
  return { from: () => query } as unknown as TypedSupabaseClient;
}

const BAR = [{ text: { es: "Hola" } }];

function silenceErrors(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

describe("ajustes del sitio", () => {
  it("lee el mantenimiento y la barra en una sola consulta", async () => {
    const onQuery = vi.fn();
    const client = clientReturning(
      {
        data: [
          { key: MAINTENANCE_MODE_KEY, value: { enabled: true } },
          { key: ANNOUNCEMENT_BAR_KEY, value: BAR },
        ],
        error: null,
      },
      onQuery,
    );

    const settings = await loadSiteSettings(client);

    expect(onQuery).toHaveBeenCalledOnce();
    expect(settings).toEqual({
      maintenance: { enabled: true },
      announcements: BAR,
    });
  });

  it("deja el modo apagado cuando el ajuste no existe", async () => {
    const client = clientReturning({ data: [], error: null });

    await expect(loadSiteSettings(client)).resolves.toEqual({
      maintenance: { enabled: false },
      announcements: [],
    });
  });

  it("cuenta como apagado un ajuste inválido y deja el error en el registro", async () => {
    const logged = silenceErrors();
    const client = clientReturning({
      data: [
        { key: MAINTENANCE_MODE_KEY, value: "roto" },
        { key: ANNOUNCEMENT_BAR_KEY, value: BAR },
      ],
      error: null,
    });

    const settings = await loadSiteSettings(client);

    expect(settings.maintenance).toEqual({ enabled: false });
    expect(settings.announcements).toEqual(BAR);
    expect(logged).toHaveBeenCalledOnce();
  });

  it("una barra inválida no apaga un mantenimiento bien guardado", async () => {
    silenceErrors();
    const client = clientReturning({
      data: [
        { key: MAINTENANCE_MODE_KEY, value: { enabled: true } },
        { key: ANNOUNCEMENT_BAR_KEY, value: "roto" },
      ],
      error: null,
    });

    const settings = await loadSiteSettings(client);

    expect(settings.maintenance.enabled).toBe(true);
    expect(settings.announcements).toEqual([]);
  });

  it("sirve el sitio normal y registra el error cuando la base falla", async () => {
    const logged = silenceErrors();
    const client = clientReturning({ data: null, error: { message: "caída" } });

    await expect(loadSiteSettings(client)).resolves.toEqual({
      maintenance: { enabled: false },
      announcements: [],
    });
    expect(logged).toHaveBeenCalledOnce();
  });

  it("no hace esperar a la página cuando la base no responde", async () => {
    vi.useFakeTimers();
    const logged = silenceErrors();
    const query = {
      select: () => query,
      in: () => new Promise(() => undefined),
    };
    const hungClient = { from: () => query } as unknown as TypedSupabaseClient;

    const loading = loadSiteSettings(hungClient);
    await vi.advanceTimersByTimeAsync(SITE_SETTINGS_TIMEOUT_MS);

    await expect(loading).resolves.toMatchObject({
      maintenance: { enabled: false },
    });
    expect(logged).toHaveBeenCalledOnce();
  });
});
