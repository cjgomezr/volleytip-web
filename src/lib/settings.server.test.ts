import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { connectToLocalDatabase, type Database } from "~/testing/database";
import { describeIntegration } from "~/testing/describe-integration";
import { createLocalServiceClient } from "~/testing/local-supabase.server";

import type { ServerEnv } from "./env.server";
import {
  InvalidSettingError,
  readSetting,
  type SettingDefinition,
} from "./settings.server";
import { createServiceSupabaseClient } from "./supabase/service-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

interface AnnouncementBar {
  readonly text: string;
  readonly isVisible: boolean;
}

// Las claves de prueba llevan este prefijo para borrarlas sin tocar otras.
const TEST_KEY_PREFIX = "prueba.lector.";
const FALLBACK_BAR: AnnouncementBar = { text: "", isVisible: false };

const FAKE_ENV: ServerEnv = {
  appEnv: "test",
  supabaseUrl: "https://proyecto-de-prueba.supabase.test",
  supabaseAnonKey: "llave-publica-falsa",
  supabaseServiceRoleKey: "llave-de-servicio-falsa",
};
const DATABASE_ERROR_STATUS = 500;

/** Un cliente cuya base responde siempre con un error, sin tocar la red. */
function createFailingClient(): TypedSupabaseClient {
  vi.stubGlobal("fetch", (): Promise<Response> =>
    Promise.resolve(
      Response.json(
        { code: "XX000", message: "la base no responde" },
        { status: DATABASE_ERROR_STATUS },
      ),
    ),
  );
  return createServiceSupabaseClient(FAKE_ENV);
}

function isAnnouncementBar(value: unknown): value is AnnouncementBar {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.text === "string" &&
    typeof candidate.isVisible === "boolean"
  );
}

function defineAnnouncementBar(
  key: string,
): SettingDefinition<AnnouncementBar> {
  return { key, isValid: isAnnouncementBar, fallback: FALLBACK_BAR };
}

describe("lector de ajustes: fallo de la base", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("se propaga con la clave en el mensaje, no se cambia por el valor por defecto", async () => {
    const failingClient = createFailingClient();

    await expect(
      readSetting(defineAnnouncementBar("announcement_bar"), failingClient),
    ).rejects.toThrow(
      /No se pudo leer el ajuste "announcement_bar": la base no responde/,
    );
  });
});

describeIntegration("lector de ajustes", () => {
  let database: Database;
  let client: TypedSupabaseClient;
  let keyCounter = 0;

  async function seedSetting(value: unknown): Promise<string> {
    keyCounter += 1;
    const key = `${TEST_KEY_PREFIX}${Date.now()}.${keyCounter}`;
    await database`
      insert into public.settings (key, value)
      values (${key}, ${JSON.stringify(value)}::text::jsonb)
    `;
    return key;
  }

  beforeAll(() => {
    database = connectToLocalDatabase();
    client = createLocalServiceClient();
  });

  afterEach(async () => {
    await database`
      delete from public.settings where key like ${`${TEST_KEY_PREFIX}%`}
    `;
  });

  afterAll(async () => {
    await database.end();
  });

  it("devuelve el valor guardado cuando cumple la forma esperada", async () => {
    const key = await seedSetting({ text: "Envío gratis", isVisible: true });

    const bar = await readSetting(defineAnnouncementBar(key), client);

    expect(bar).toEqual({ text: "Envío gratis", isVisible: true });
  });

  it("devuelve el valor por defecto cuando la clave no existe", async () => {
    const bar = await readSetting(
      defineAnnouncementBar(`${TEST_KEY_PREFIX}no-existe`),
      client,
    );

    expect(bar).toBe(FALLBACK_BAR);
  });

  it.each([
    ["le falta un campo", { text: "Hola" }],
    ["un campo tiene otro tipo", { text: "Hola", isVisible: "sí" }],
    ["es de otro tipo", "texto suelto"],
    ["es nulo en JSON", null],
  ])(
    "lanza un error que nombra la clave cuando el valor guardado %s",
    async (_case, storedValue) => {
      const key = await seedSetting(storedValue);

      const attempt = readSetting(defineAnnouncementBar(key), client);

      await expect(attempt).rejects.toBeInstanceOf(InvalidSettingError);
      await expect(attempt).rejects.toThrow(key);
    },
  );

  it("lee un valor simple, como un booleano", async () => {
    const key = await seedSetting(true);

    const isEnabled = await readSetting(
      {
        key,
        isValid: (value): value is boolean => typeof value === "boolean",
        fallback: false,
      },
      client,
    );

    expect(isEnabled).toBe(true);
  });
});
