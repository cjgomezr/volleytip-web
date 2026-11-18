import { readFileSync } from "node:fs";
import { createServer, type AddressInfo, type Server } from "node:net";
import { describe, expect, it } from "vitest";

import {
  assertLocalDatabaseResponds,
  LOCAL_DATABASE,
  LOCAL_DATABASE_URL,
  LocalDatabaseUnreachableError,
} from "./local-database";

const LOOPBACK_HOST = "127.0.0.1";
const SHORT_TIMEOUT_MS = 500;

function readSupabaseConfig(): string {
  return readFileSync(
    new URL("../../supabase/config.toml", import.meta.url),
    "utf8",
  );
}

function readConfiguredDatabasePort(): number {
  const port = /^\[db\]\s[^[]*?^port\s*=\s*(\d+)/m.exec(
    readSupabaseConfig(),
  )?.[1];
  if (port === undefined) {
    throw new Error("supabase/config.toml no declara el puerto de [db]");
  }
  return Number(port);
}

function listenOnFreePort(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, LOOPBACK_HOST, () => resolve(server));
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

/** Abre un puerto, lo cierra y devuelve su número: un puerto donde con toda
 * seguridad no escucha nadie. */
async function findClosedPort(): Promise<number> {
  const server = await listenOnFreePort();
  const { port } = server.address() as AddressInfo;
  await closeServer(server);
  return port;
}

describe("conexión de las pruebas de integración", () => {
  it("apunta a la máquina local", () => {
    expect(LOCAL_DATABASE.host).toBe(LOOPBACK_HOST);
    expect(new URL(LOCAL_DATABASE_URL).hostname).toBe(LOOPBACK_HOST);
  });

  it("usa el puerto que declara supabase/config.toml", () => {
    expect(LOCAL_DATABASE.port).toBe(readConfiguredDatabasePort());
    expect(Number(new URL(LOCAL_DATABASE_URL).port)).toBe(
      readConfiguredDatabasePort(),
    );
  });

  it("no sale de ninguna variable de entorno ni nombra un proyecto remoto", () => {
    const source = readFileSync(
      new URL("./local-database.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(/process\.env|import\.meta\.env/);
    expect(source).not.toMatch(/supabase\.co/);
  });
});

describe("pruebas de integración con la base apagada", () => {
  it("fallan con un mensaje que dice cómo levantar la base local", async () => {
    const closedPort = await findClosedPort();

    const attempt = assertLocalDatabaseResponds({
      host: LOOPBACK_HOST,
      port: closedPort,
      timeoutMs: SHORT_TIMEOUT_MS,
    });

    await expect(attempt).rejects.toBeInstanceOf(LocalDatabaseUnreachableError);
    await expect(attempt).rejects.toThrow(/base local no responde/);
    await expect(attempt).rejects.toThrow(/npm run db:start/);
  });

  it("nombran la dirección que no respondió", async () => {
    const closedPort = await findClosedPort();

    const attempt = assertLocalDatabaseResponds({
      host: LOOPBACK_HOST,
      port: closedPort,
      timeoutMs: SHORT_TIMEOUT_MS,
    });

    await expect(attempt).rejects.toThrow(`${LOOPBACK_HOST}:${closedPort}`);
  });

  it("pasan la comprobación cuando algo escucha en el puerto", async () => {
    const server = await listenOnFreePort();
    const { port } = server.address() as AddressInfo;

    try {
      await expect(
        assertLocalDatabaseResponds({
          host: LOOPBACK_HOST,
          port,
          timeoutMs: SHORT_TIMEOUT_MS,
        }),
      ).resolves.toBeUndefined();
    } finally {
      await closeServer(server);
    }
  });
});
