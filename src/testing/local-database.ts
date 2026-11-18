import { connect } from "node:net";

export interface DatabaseTarget {
  readonly host: string;
  readonly port: number;
  readonly timeoutMs: number;
}

const CONNECTION_TIMEOUT_MS = 3000;

/**
 * La base que levanta `npm run db:start`. Va escrita aquí a propósito, sin
 * leer ninguna variable de entorno: así una prueba de integración no puede
 * terminar apuntando a `volleytip-dev` ni a `volleytip-prod` por una variable
 * mal puesta. El puerto es el de `[db]` en `supabase/config.toml`.
 */
export const LOCAL_DATABASE: DatabaseTarget = {
  host: "127.0.0.1",
  port: 54322,
  timeoutMs: CONNECTION_TIMEOUT_MS,
};

// Usuario y contraseña que Supabase CLI pone en toda base local. Son públicos
// y solo abren la base desechable de esta máquina.
const LOCAL_DATABASE_CREDENTIALS = "postgres:postgres";

export const LOCAL_DATABASE_URL = `postgresql://${LOCAL_DATABASE_CREDENTIALS}@${LOCAL_DATABASE.host}:${LOCAL_DATABASE.port}/postgres`;

export class LocalDatabaseUnreachableError extends Error {
  constructor(target: DatabaseTarget, reason: string) {
    super(
      `La base local no responde en ${target.host}:${target.port} (${reason}). Levántala con \`npm run db:start\` (necesita Docker abierto).`,
    );
    this.name = "LocalDatabaseUnreachableError";
  }
}

/**
 * Comprueba que algo escucha en el puerto de la base local. Rechaza con un
 * mensaje que dice cómo levantarla, para que una base apagada sea un fallo
 * claro y no un tiempo agotado sin explicación.
 */
export function assertLocalDatabaseResponds(
  target: DatabaseTarget = LOCAL_DATABASE,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: target.host, port: target.port });
    const fail = (reason: string): void => {
      socket.destroy();
      reject(new LocalDatabaseUnreachableError(target, reason));
    };

    socket.setTimeout(target.timeoutMs);
    socket.once("timeout", () => fail("tiempo de espera agotado"));
    socket.once("error", (error) => fail(error.message));
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
  });
}
