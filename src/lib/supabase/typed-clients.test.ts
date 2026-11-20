import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

import { buildTestServerEnv } from "~/testing/test-server-env";

import type { ServerEnv } from "../env.server";
import { createAnonSupabaseClient } from "./anon-client.server";
import { createServiceSupabaseClient } from "./service-client.server";

/**
 * Pruebas de tipos. Lo que demuestran lo comprueba `npm run typecheck`, no
 * Vitest: cada `@ts-expect-error` hace fallar la compilación el día que la
 * línea de abajo deje de ser un error. Si los clientes perdieran sus tipos,
 * `tsc` reportaría "Unused '@ts-expect-error' directive".
 *
 * `fetch` está sustituido: ninguna consulta sale a la red.
 */
const FAKE_ENV: ServerEnv = buildTestServerEnv();

const CLIENT_FACTORIES = [
  ["público", createAnonSupabaseClient],
  ["de servicio", createServiceSupabaseClient],
] as const;

beforeEach(() => {
  vi.stubGlobal("fetch", () => Promise.resolve(Response.json([])));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(CLIENT_FACTORIES)(
  "clientes tipados: cliente %s",
  (_name, createClient) => {
    it("una tabla que existe compila y sus columnas tienen tipo", async () => {
      const { data } = await createClient(FAKE_ENV)
        .from("profiles")
        .select("id, email, role, is_active");

      expectTypeOf(data).toEqualTypeOf<
        | {
            id: string;
            email: string;
            role: "admin" | "staff" | "buyer";
            is_active: boolean;
          }[]
        | null
      >();
      expect(data).toEqual([]);
    });

    it("una tabla que no existe no compila", async () => {
      const client = createClient(FAKE_ENV);

      // @ts-expect-error: la tabla no existe en la base.
      const { data } = await client.from("tabla_que_no_existe").select();

      expect(data).toEqual([]);
    });

    it("leer una columna que no existe no compila", async () => {
      const { data } = await createClient(FAKE_ENV)
        .from("profiles")
        .select("id");
      const [firstRow] = data ?? [];

      // @ts-expect-error: la consulta no trae esa columna y la tabla no la tiene.
      expect(firstRow?.columna_que_no_existe).toBeUndefined();
    });

    it("pedir una columna que no existe deja un resultado inservible", async () => {
      const { data } = await createClient(FAKE_ENV)
        .from("profiles")
        .select("columna_que_no_existe");
      const [firstRow] = data ?? [];

      // @ts-expect-error: el tipo del resultado es un error, no una fila.
      expect(firstRow?.columna_que_no_existe).toBeUndefined();
    });

    it("escribir una columna que no existe no compila", async () => {
      const client = createClient(FAKE_ENV);

      const { error } = await client
        .from("profiles")
        // @ts-expect-error: profiles no tiene esa columna.
        .update({ columna_que_no_existe: true })
        .eq("id", "00000000-0000-0000-0000-000000000000");

      expect(error).toBeNull();
    });

    it("un valor fuera del enum no compila", async () => {
      const client = createClient(FAKE_ENV);

      const { error } = await client
        .from("profiles")
        // @ts-expect-error: "superadmin" no es un valor de user_role.
        .update({ role: "superadmin" })
        .eq("id", "00000000-0000-0000-0000-000000000000");

      expect(error).toBeNull();
    });

    it("una función que no existe no compila", async () => {
      const client = createClient(FAKE_ENV);

      // @ts-expect-error: la función no existe en la base.
      const { error } = await client.rpc("funcion_que_no_existe");

      expect(error).toBeNull();
    });

    it("una función que existe exige sus argumentos", async () => {
      const { data } = await createClient(FAKE_ENV).rpc("check_rate_limit", {
        p_key: "clave",
        p_max_attempts: 5,
        p_window_seconds: 600,
      });

      expectTypeOf(data).toEqualTypeOf<boolean | null>();
    });
  },
);
