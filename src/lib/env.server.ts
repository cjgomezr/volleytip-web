/**
 * Variables de entorno del servidor. Es el único archivo de `src/` que lee
 * `process.env`: todo lo demás importa `serverEnv`.
 *
 * Se valida al cargar el módulo, así que un servidor mal configurado no
 * arranca. Los mensajes nombran variables, nunca valores.
 */

export const APP_ENVIRONMENTS = [
  "local",
  "test",
  "staging",
  "production",
] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export const SERVER_ENV_VARIABLES = [
  "APP_ENV",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type ServerEnvVariable = (typeof SERVER_ENV_VARIABLES)[number];

export interface ServerEnv {
  readonly appEnv: AppEnvironment;
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly supabaseServiceRoleKey: string;
}

export type EnvSource = Readonly<Record<string, string | undefined>>;

export type ServerEnvResult =
  | { readonly ok: true; readonly env: ServerEnv }
  | { readonly ok: false; readonly message: string };

const LINE_BREAK = "\n";
const HTTP_PROTOCOLS: readonly string[] = ["http:", "https:"];

function isAppEnvironment(value: string): value is AppEnvironment {
  return (APP_ENVIRONMENTS as readonly string[]).includes(value);
}

function isHttpUrl(value: string): boolean {
  return (
    URL.canParse(value) && HTTP_PROTOCOLS.includes(new URL(value).protocol)
  );
}

type PresentValues = Partial<Record<ServerEnvVariable, string>>;

function readPresentValues(source: EnvSource): PresentValues {
  const present: PresentValues = {};
  for (const name of SERVER_ENV_VARIABLES) {
    const value = source[name]?.trim();
    if (value !== undefined && value !== "") {
      present[name] = value;
    }
  }
  return present;
}

function findInvalidValues(values: PresentValues): string[] {
  const invalid: string[] = [];
  if (values.APP_ENV !== undefined && !isAppEnvironment(values.APP_ENV)) {
    invalid.push(
      `APP_ENV no es válido. Valores válidos: ${APP_ENVIRONMENTS.join(", ")}.`,
    );
  }
  if (values.SUPABASE_URL !== undefined && !isHttpUrl(values.SUPABASE_URL)) {
    invalid.push("SUPABASE_URL no es una URL http o https.");
  }
  return invalid;
}

function describeProblems(
  missing: readonly string[],
  invalid: readonly string[],
): string {
  return [
    "Entorno del servidor mal configurado:",
    ...missing.map((name) => `- Falta ${name}.`),
    ...invalid.map((problem) => `- ${problem}`),
    "Los nombres y de dónde sale cada valor están en .env.example y docs/entornos.md.",
  ].join(LINE_BREAK);
}

function buildServerEnv(values: PresentValues): ServerEnv | undefined {
  const {
    APP_ENV: appEnv,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
  } = values;
  if (
    appEnv === undefined ||
    !isAppEnvironment(appEnv) ||
    supabaseUrl === undefined ||
    supabaseAnonKey === undefined ||
    supabaseServiceRoleKey === undefined
  ) {
    return undefined;
  }
  return { appEnv, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };
}

/**
 * Valida un objeto con variables de entorno. Es pura: no lee `process.env`,
 * así que se prueba pasándole el objeto que se quiera.
 */
export function parseServerEnv(source: EnvSource): ServerEnvResult {
  const values = readPresentValues(source);
  const missing = SERVER_ENV_VARIABLES.filter(
    (name) => values[name] === undefined,
  );
  const invalid = findInvalidValues(values);
  const env = buildServerEnv(values);

  if (env === undefined || missing.length > 0 || invalid.length > 0) {
    return { ok: false, message: describeProblems(missing, invalid) };
  }
  return { ok: true, env };
}

function loadServerEnv(): ServerEnv {
  const result = parseServerEnv(process.env);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.env;
}

export const serverEnv: ServerEnv = loadServerEnv();
