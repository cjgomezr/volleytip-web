/**
 * Variables de entorno del servidor. Es el único archivo de `src/` que lee
 * `process.env`: todo lo demás importa `serverEnv`.
 *
 * Se valida al cargar el módulo, así que un servidor mal configurado no
 * arranca. Los mensajes nombran variables, nunca valores.
 */

import {
  isTurnstileTestSecretKey,
  isTurnstileTestSiteKey,
} from "./forms/turnstile-test-keys";
import { isImageCdnHost } from "./images/image-url";

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
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "FORM_PROTECTION_SECRET",
  "CLIENT_IP_HEADER",
  "CLIENT_IP_TRUSTED_HOPS",
  "IMAGE_CDN_HOST",
  "SITE_ORIGIN",
] as const;

/** Sin ellas el servidor arranca igual: lo que encienden queda apagado. */
export const OPTIONAL_SERVER_ENV_VARIABLES = [
  "GOOGLE_SIGN_IN_ENABLED",
] as const;

type RequiredServerEnvVariable = (typeof SERVER_ENV_VARIABLES)[number];
type ServerEnvVariable =
  RequiredServerEnvVariable | (typeof OPTIONAL_SERVER_ENV_VARIABLES)[number];

export interface ServerEnv {
  readonly appEnv: AppEnvironment;
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly supabaseServiceRoleKey: string;
  readonly turnstileSiteKey: string;
  readonly turnstileSecretKey: string;
  /** Firma la marca de tiempo de los formularios y deriva la sal del hash de IP. */
  readonly formProtectionSecret: string;
  /** Cabecera donde el proxy del hosting anota la IP del visitante. */
  readonly clientIpHeader: string;
  /** Cuántos proxies de confianza anotan en esa cabecera. */
  readonly clientIpTrustedHops: number;
  /** Dominio del CDN de imágenes (Bunny Optimizer), sin protocolo ni ruta. */
  readonly imageCdnHost: string;
  /** Dirección pública del sitio en este entorno: protocolo y dominio, sin
   * barra final. Con ella se arman las direcciones absolutas. */
  readonly siteOrigin: string;
  /** Pinta "Continuar con Google" en la entrada del panel. Las credenciales
   * de Google viven en Supabase, no aquí. */
  readonly googleSignInEnabled: boolean;
}

export type EnvSource = Readonly<Record<string, string | undefined>>;

export type ServerEnvResult =
  | { readonly ok: true; readonly env: ServerEnv }
  | { readonly ok: false; readonly message: string };

const LINE_BREAK = "\n";
const HTTP_PROTOCOLS: readonly string[] = ["http:", "https:"];
const MIN_FORM_PROTECTION_SECRET_LENGTH = 32;
const FLAG_VALUES: readonly string[] = ["true", "false"];
const FLAG_ON = "true";
// Los caracteres que admite el nombre de una cabecera HTTP.
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;
// Hasta tres cifras: sobra para una cadena de proxies.
const POSITIVE_INTEGER = /^[1-9]\d{0,2}$/;
// Fuera de estos entornos Turnstile tiene que proteger de verdad.
const ENVIRONMENTS_FOR_TEST_KEYS: readonly string[] = ["local", "test"];
// Solo en la máquina de quien programa el sitio se sirve sin cifrar.
const ENVIRONMENTS_FOR_PLAIN_HTTP: readonly string[] = ["local", "test"];
const SECURE_PROTOCOL = "https:";

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
  for (const name of [
    ...SERVER_ENV_VARIABLES,
    ...OPTIONAL_SERVER_ENV_VARIABLES,
  ]) {
    const value = source[name]?.trim();
    if (value !== undefined && value !== "") {
      present[name] = value;
    }
  }
  return present;
}

function findInvalidSupabaseValues(values: PresentValues): string[] {
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

/** Las llaves de prueba de Cloudflare siempre dejan pasar: en un entorno
 * público dejarían los formularios sin protección. */
function findTurnstileTestKeys(values: PresentValues): string[] {
  const { APP_ENV: appEnv } = values;
  if (appEnv === undefined || ENVIRONMENTS_FOR_TEST_KEYS.includes(appEnv)) {
    return [];
  }
  const invalid: string[] = [];
  const explanation = `es una llave de prueba de Cloudflare. Solo se permite con APP_ENV en ${ENVIRONMENTS_FOR_TEST_KEYS.join(" o ")}.`;
  if (isTurnstileTestSiteKey(values.TURNSTILE_SITE_KEY ?? "")) {
    invalid.push(`TURNSTILE_SITE_KEY ${explanation}`);
  }
  if (isTurnstileTestSecretKey(values.TURNSTILE_SECRET_KEY ?? "")) {
    invalid.push(`TURNSTILE_SECRET_KEY ${explanation}`);
  }
  return invalid;
}

function findInvalidFormProtectionValues(values: PresentValues): string[] {
  const {
    FORM_PROTECTION_SECRET: secret,
    CLIENT_IP_HEADER: header,
    CLIENT_IP_TRUSTED_HOPS: hops,
  } = values;
  const invalid: string[] = [];
  if (
    secret !== undefined &&
    secret.length < MIN_FORM_PROTECTION_SECRET_LENGTH
  ) {
    invalid.push(
      `FORM_PROTECTION_SECRET es muy corto. Debe tener ${String(MIN_FORM_PROTECTION_SECRET_LENGTH)} caracteres o más.`,
    );
  }
  if (header !== undefined && !HEADER_NAME.test(header)) {
    invalid.push("CLIENT_IP_HEADER no es un nombre de cabecera HTTP.");
  }
  if (hops !== undefined && !POSITIVE_INTEGER.test(hops)) {
    invalid.push("CLIENT_IP_TRUSTED_HOPS debe ser un número entero, 1 o más.");
  }
  return invalid;
}

function findInvalidImageValues(values: PresentValues): string[] {
  const { IMAGE_CDN_HOST: host } = values;
  if (host === undefined || isImageCdnHost(host)) {
    return [];
  }
  return [
    "IMAGE_CDN_HOST no es un dominio. Va sin protocolo ni ruta, por ejemplo nombre.b-cdn.net.",
  ];
}

/** Un origen es protocolo y dominio, tal como lo escribe el navegador:
 * sin ruta, sin barra final, sin búsqueda y en minúsculas. */
function isHttpOrigin(value: string): boolean {
  return isHttpUrl(value) && new URL(value).origin === value;
}

function findInvalidSiteOrigin(values: PresentValues): string[] {
  const { SITE_ORIGIN: origin, APP_ENV: appEnv } = values;
  if (origin === undefined) {
    return [];
  }
  if (!isHttpOrigin(origin)) {
    return [
      "SITE_ORIGIN no es la dirección pública del sitio. Va con protocolo y dominio, sin ruta ni barra final, por ejemplo https://volleytip.com.",
    ];
  }
  const allowsPlainHttp =
    appEnv !== undefined && ENVIRONMENTS_FOR_PLAIN_HTTP.includes(appEnv);
  if (new URL(origin).protocol !== SECURE_PROTOCOL && !allowsPlainHttp) {
    return [
      `SITE_ORIGIN debe empezar por https. Solo se permite http con APP_ENV en ${ENVIRONMENTS_FOR_PLAIN_HTTP.join(" o ")}.`,
    ];
  }
  return [];
}

function findInvalidFlags(values: PresentValues): string[] {
  const { GOOGLE_SIGN_IN_ENABLED: flag } = values;
  if (flag === undefined || FLAG_VALUES.includes(flag)) {
    return [];
  }
  return [
    `GOOGLE_SIGN_IN_ENABLED no es válido. Valores válidos: ${FLAG_VALUES.join(", ")}.`,
  ];
}

function findInvalidValues(values: PresentValues): string[] {
  return [
    ...findInvalidSupabaseValues(values),
    ...findTurnstileTestKeys(values),
    ...findInvalidFormProtectionValues(values),
    ...findInvalidImageValues(values),
    ...findInvalidSiteOrigin(values),
    ...findInvalidFlags(values),
  ];
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

type CompleteValues = PresentValues & Record<RequiredServerEnvVariable, string>;

function hasEveryValue(values: PresentValues): values is CompleteValues {
  return SERVER_ENV_VARIABLES.every((name) => values[name] !== undefined);
}

/** Arma el entorno tipado. Solo se llama con valores presentes y válidos. */
function buildServerEnv(values: CompleteValues): ServerEnv | undefined {
  if (!isAppEnvironment(values.APP_ENV)) {
    return undefined;
  }
  return {
    appEnv: values.APP_ENV,
    supabaseUrl: values.SUPABASE_URL,
    supabaseAnonKey: values.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: values.SUPABASE_SERVICE_ROLE_KEY,
    turnstileSiteKey: values.TURNSTILE_SITE_KEY,
    turnstileSecretKey: values.TURNSTILE_SECRET_KEY,
    formProtectionSecret: values.FORM_PROTECTION_SECRET,
    clientIpHeader: values.CLIENT_IP_HEADER,
    clientIpTrustedHops: Number(values.CLIENT_IP_TRUSTED_HOPS),
    imageCdnHost: values.IMAGE_CDN_HOST,
    siteOrigin: values.SITE_ORIGIN,
    googleSignInEnabled: values.GOOGLE_SIGN_IN_ENABLED === FLAG_ON,
  };
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
  const env =
    hasEveryValue(values) && invalid.length === 0
      ? buildServerEnv(values)
      : undefined;

  if (env === undefined) {
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
