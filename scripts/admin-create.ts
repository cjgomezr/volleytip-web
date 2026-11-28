/**
 * Crea el primer admin de un entorno, o sube a admin una cuenta que ya existe.
 *
 *   npm run admin:create -- correo
 *
 * Solo necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Antes de escribir
 * muestra a qué proyecto apunta y pide su identificador. Cómo correrlo en
 * cada entorno está en docs/entornos.md.
 */
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/database.types.ts";
import { SERVER_CLIENT_OPTIONS } from "../src/lib/supabase/server-client-options.server.ts";
import type { TypedSupabaseClient } from "../src/lib/supabase/typed-client.ts";
import { parseTeamEmail } from "../src/lib/team-account.server.ts";
import { ensureFirstAdmin, type FirstAdminOutcome } from "./first-admin.ts";

export interface ServiceConfig {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
}

export interface AdminCreateDependencies {
  /** Los argumentos del comando, sin `node` ni la ruta del script. */
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly ask: (question: string) => Promise<string>;
  readonly print: (line: string) => void;
  readonly createClient?: (config: ServiceConfig) => TypedSupabaseClient;
}

const SUCCESS_STATUS = 0;
const FAILURE_STATUS = 1;
const HOSTED_PROJECT_SUFFIX = ".supabase.co";
const LOOPBACK_HOSTS: readonly string[] = ["127.0.0.1", "localhost", "[::1]"];
const USAGE = [
  "Uso: npm run admin:create -- correo",
  "Recibe un solo correo y lo deja como admin activo del panel.",
].join("\n");
const OUTCOME_MESSAGES: Record<FirstAdminOutcome["kind"], string> = {
  created: "Se creó la cuenta y quedó como admin activo.",
  promoted:
    "La cuenta ya existía y quedó como admin activo. Su contraseña se cambió por una al azar: se entra con el enlace al correo o con Google.",
  unchanged: "Esa cuenta ya es admin activo. No se cambió nada.",
};

function createServiceClient({
  supabaseUrl,
  serviceRoleKey,
}: ServiceConfig): TypedSupabaseClient {
  return createClient<Database>(
    supabaseUrl,
    serviceRoleKey,
    SERVER_CLIENT_OPTIONS,
  );
}

function readEmail(args: readonly string[]): string {
  const [raw = "", ...extra] = args;
  const email = extra.length === 0 ? parseTeamEmail(raw) : null;
  if (email === null) {
    throw new Error(`Falta un correo válido.\n${USAGE}`);
  }
  return email;
}

/** Los mensajes nombran variables, nunca valores. */
function readServiceConfig(env: AdminCreateDependencies["env"]): ServiceConfig {
  const supabaseUrl = env.SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const problems = [
    supabaseUrl === "" ? "Falta SUPABASE_URL." : null,
    serviceRoleKey === "" ? "Falta SUPABASE_SERVICE_ROLE_KEY." : null,
  ].filter((problem) => problem !== null);
  if (problems.length > 0) {
    throw new Error(
      [...problems, "De dónde sale cada valor: docs/entornos.md."].join("\n"),
    );
  }
  if (!isSafeSupabaseUrl(supabaseUrl)) {
    throw new Error(
      "SUPABASE_URL no es una URL válida. Va con https; http solo se admite en la propia máquina.",
    );
  }
  return { supabaseUrl, serviceRoleKey };
}

/** La llave de servicio nunca viaja sin cifrar fuera de esta máquina. */
function isSafeSupabaseUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol, hostname } = new URL(value);
  return (
    protocol === "https:" ||
    (protocol === "http:" && LOOPBACK_HOSTS.includes(hostname))
  );
}

/** El identificador de un proyecto alojado es su subdominio. Cualquier otra
 * dirección (la base local) se identifica por su host. */
function identifyProject(url: URL): string {
  return url.hostname.endsWith(HOSTED_PROJECT_SUFFIX)
    ? url.hostname.slice(0, -HOSTED_PROJECT_SUFFIX.length)
    : url.host;
}

async function confirmTarget(
  { ask, print }: AdminCreateDependencies,
  supabaseUrl: string,
): Promise<void> {
  const url = new URL(supabaseUrl);
  const identifier = identifyProject(url);
  print(`Se va a escribir en el proyecto de Supabase ${url.origin}`);
  const answer = await ask(
    `Escribe "${identifier}" para confirmar y presiona Enter: `,
  );
  if (answer.trim() !== identifier) {
    throw new Error("La respuesta no coincide. No se escribió nada.");
  }
}

function describeError(error: unknown, secret: string): string {
  const message = error instanceof Error ? error.message : String(error);
  // Un error de la librería puede citar una cabecera, y la cabecera lleva la
  // llave.
  return secret === "" ? message : message.replaceAll(secret, "[oculto]");
}

function printOutcome(
  { kind, profileId, confirmedEmail }: FirstAdminOutcome,
  print: AdminCreateDependencies["print"],
): void {
  print(`${OUTCOME_MESSAGES[kind]} Id del perfil: ${profileId}`);
  if (confirmedEmail) {
    print("Se confirmó su correo, que estaba sin confirmar.");
  }
}

/** Corre el comando completo y devuelve el código de salida. */
export async function runAdminCreate(
  dependencies: AdminCreateDependencies,
): Promise<number> {
  const { args, env, print } = dependencies;
  try {
    const email = readEmail(args);
    const config = readServiceConfig(env);
    await confirmTarget(dependencies, config.supabaseUrl);
    const client = (dependencies.createClient ?? createServiceClient)(config);
    printOutcome(await ensureFirstAdmin(client, email), print);
    return SUCCESS_STATUS;
  } catch (error) {
    print(describeError(error, env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""));
    return FAILURE_STATUS;
  }
}

/** Una respuesta de la terminal. Si la entrada se cierra, queda vacía. */
function askOnTerminal(question: string): Promise<string> {
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    terminal.once("close", () => resolve(""));
    terminal.question(question, (answer) => {
      resolve(answer);
      terminal.close();
    });
  });
}

const invokedScript = process.argv[1];
const isRunDirectly =
  invokedScript !== undefined &&
  path.resolve(invokedScript) === fileURLToPath(import.meta.url);

if (isRunDirectly) {
  process.exitCode = await runAdminCreate({
    args: process.argv.slice(2),
    env: process.env,
    ask: askOnTerminal,
    print: (line) => console.log(line),
  });
}
