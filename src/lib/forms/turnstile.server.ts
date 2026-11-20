import type { AppEnvironment } from "~/lib/env.server";

import { TURNSTILE_TEST_KEYS } from "./turnstile-test-keys";

/**
 * Verificación de Turnstile (FR-135, capa 3). El widget de Cloudflare deja
 * un token en el formulario y el servidor le pregunta a Cloudflare si vale.
 *
 * Falla cerrado: si Cloudflare no responde, responde mal o responde algo
 * que no se entiende, el envío no pasa. Nunca se acepta sin verificación.
 *
 * Fuente del contrato, consultada el 20 de noviembre de 2026:
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

export { TURNSTILE_TEST_KEYS };

export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Nombre del campo oculto que el widget agrega al formulario. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

const VERIFY_TIMEOUT_MS = 5000;
// Largo máximo de un token según Cloudflare.
const MAX_TOKEN_LENGTH = 2048;
// En estos entornos no se llama a la red: se usan las llaves de prueba.
const OFFLINE_ENVIRONMENTS: readonly AppEnvironment[] = ["local", "test"];

export interface TurnstileSettings {
  /** `TURNSTILE_SECRET_KEY` del entorno. */
  readonly secretKey: string;
  readonly appEnv: AppEnvironment;
  /** Se inyecta para probar sin red. Por defecto, el `fetch` global. */
  readonly fetch?: typeof fetch;
}

function readUsableToken(
  token: FormDataEntryValue | null | undefined,
): string | undefined {
  if (typeof token !== "string") {
    return undefined;
  }
  const isUsable = token.trim() !== "" && token.length <= MAX_TOKEN_LENGTH;
  return isUsable ? token : undefined;
}

/** Sin red: hace lo mismo que Cloudflare con sus llaves de prueba. */
function verifyOffline(token: string, secretKey: string): boolean {
  return (
    secretKey === TURNSTILE_TEST_KEYS.passingSecretKey &&
    token === TURNSTILE_TEST_KEYS.dummyToken
  );
}

/** Solo un `success: true` literal cuenta. Cualquier otra forma del cuerpo
 * es un no. */
function isAccepted(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "success" in body &&
    body.success === true
  );
}

async function askCloudflare(
  token: string,
  secretKey: string,
  fetchImplementation: typeof fetch,
): Promise<boolean> {
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort();
  }, VERIFY_TIMEOUT_MS);
  try {
    const response = await fetchImplementation(TURNSTILE_VERIFY_URL, {
      method: "POST",
      // No se envía la IP del visitante: es opcional y así no sale de aquí.
      body: new URLSearchParams({ secret: secretKey, response: token }),
      signal: timeout.signal,
    });
    if (!response.ok) {
      return false;
    }
    return isAccepted(await response.json());
  } catch {
    // Sin respuesta en 5 segundos, red caída o cuerpo ilegible. No hay nada
    // que arreglar aquí y la regla es una sola: sin un sí de Cloudflare, el
    // envío no pasa. Quien llama decide qué decirle a la persona.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dice si el token de Turnstile vale. Recibe el valor crudo del formulario,
 * que puede faltar o ser un archivo.
 */
export async function verifyTurnstile(
  token: FormDataEntryValue | null | undefined,
  { secretKey, appEnv, fetch: fetchImplementation = fetch }: TurnstileSettings,
): Promise<boolean> {
  const usableToken = readUsableToken(token);
  if (usableToken === undefined) {
    return false;
  }
  if (OFFLINE_ENVIRONMENTS.includes(appEnv)) {
    return verifyOffline(usableToken, secretKey);
  }
  return askCloudflare(usableToken, secretKey, fetchImplementation);
}
