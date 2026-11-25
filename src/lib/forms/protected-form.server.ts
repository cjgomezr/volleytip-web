import { z } from "zod";

import {
  serverEnv,
  type AppEnvironment,
  type ServerEnv,
} from "~/lib/env.server";

import { readClientIp } from "./client-ip.server";
import { HONEYPOT_FIELD, TIMESTAMP_FIELD } from "./field-names";
import {
  createSupabaseFormStore,
  type FormStore,
  type RejectionReason,
} from "./form-store.server";
import { isHoneypotFilled } from "./honeypot.server";
import { hashIp } from "./ip-hash.server";
import {
  issueSignedTimestamp,
  verifySignedTimestamp,
} from "./signed-timestamp.server";
import { TURNSTILE_FIELD, verifyTurnstile } from "./turnstile.server";

/**
 * Formularios protegidos (FR-135, RF-14). Proteger un formulario público es
 * tres pasos:
 *
 * 1. Definirlo una vez: `defineProtectedForm({ id, schema })`.
 * 2. En el `loader`, `issueFormProtection(form)`. Lo que devuelve va a
 *    `<FormProtection>` dentro del `<Form>`.
 * 3. En el `action`, `processProtectedForm(request, form)`. Los datos solo
 *    existen cuando el resultado es `accepted`.
 *
 * Las cinco capas corren en este orden: campo trampa, tiempo mínimo,
 * Turnstile, límite por IP y validación. Las dos primeras son gratis y van
 * antes de llamar a un tercero. Gana la primera que falle.
 */

export interface RateLimitRule {
  readonly maxAttempts: number;
  readonly windowSeconds: number;
  /**
   * Qué pasa al superar el límite. `block` rechaza el envío. `flag` lo deja
   * pasar marcado con `overLimit`, para que el formulario decida (FR-136).
   */
  readonly mode: "block" | "flag";
}

const TEN_MINUTES_IN_SECONDS = 600;

/** El límite de FR-135: 5 envíos por formulario e IP cada 10 minutos. */
export const DEFAULT_RATE_LIMIT: RateLimitRule = {
  maxAttempts: 5,
  windowSeconds: TEN_MINUTES_IN_SECONDS,
  mode: "block",
};

export interface ProtectedForm<Data> {
  /** Identifica al formulario en el límite, la firma y los contadores. */
  readonly id: string;
  /** Formato y longitud de cada campo. Sus mensajes son los que ve la persona. */
  readonly schema: z.ZodType<Data>;
  readonly rateLimit: RateLimitRule;
}

export interface ProtectedFormDefinition<Data> {
  readonly id: string;
  readonly schema: z.ZodType<Data>;
  readonly rateLimit?: RateLimitRule;
}

/** Lo que el `loader` le entrega a `<FormProtection>`. Nada es secreto. */
export interface FormProtectionFields {
  readonly siteKey: string;
  readonly timestamp: string;
}

export type ProtectedFormResult<Data> =
  /** Pasó las cinco capas. `overLimit` solo puede ser verdadero en modo `flag`. */
  | {
      readonly status: "accepted";
      readonly data: Data;
      readonly overLimit: boolean;
    }
  /** El campo trampa llegó lleno. A quien envió se le muestra un éxito. */
  | { readonly status: "discarded" }
  /** Llegó antes de 3 segundos, o su marca de tiempo no vale. */
  | { readonly status: "too_fast" }
  /** Turnstile no validó o no respondió. */
  | { readonly status: "verification_failed" }
  /** Pasó el límite por IP. */
  | { readonly status: "rate_limited" }
  /** Algún campo no cumple formato o longitud. */
  | {
      readonly status: "invalid";
      /** El primer error de cada campo, por nombre de campo. */
      readonly fieldErrors: Readonly<Record<string, string>>;
      /** Errores que no son de un campo en particular. */
      readonly formErrors: readonly string[];
      /** Lo que la persona escribió, para volver a pintarlo. */
      readonly values: Readonly<Record<string, string>>;
    };

export interface ProtectedFormDependencies {
  readonly env: ServerEnv;
  /** Reloj en milisegundos. */
  readonly now: () => number;
  readonly fetch: typeof fetch;
  readonly store: FormStore;
}

// El mismo formato que exige la columna `form` de `form_rejections`.
const FORM_ID_FORMAT = /^[a-z][a-z0-9_]{0,39}$/;
const PROTECTION_FIELDS: readonly string[] = [
  HONEYPOT_FIELD,
  TIMESTAMP_FIELD,
  TURNSTILE_FIELD,
];
// Lo que se devuelve para volver a pintar un campo. Un texto más largo que
// esto no lo escribió una persona en un formulario del sitio.
const MAX_ECHOED_VALUE_LENGTH = 5000;
// Sin proxy delante no hay cabecera de IP. En la máquina de quien desarrolla
// y en las pruebas, todos los envíos cuentan como de la propia máquina.
const ENVIRONMENTS_WITHOUT_PROXY: readonly AppEnvironment[] = ["local", "test"];
const OWN_MACHINE_IP = "127.0.0.1";

function isUsableRateLimit({
  maxAttempts,
  windowSeconds,
}: RateLimitRule): boolean {
  return (
    Number.isInteger(maxAttempts) &&
    maxAttempts >= 1 &&
    Number.isInteger(windowSeconds) &&
    windowSeconds >= 1
  );
}

/**
 * Define un formulario protegido. Lanza si el identificador o el límite no
 * sirven: es un error de quien programa y se ve al cargar el módulo.
 */
export function defineProtectedForm<Data>({
  id,
  schema,
  rateLimit = DEFAULT_RATE_LIMIT,
}: ProtectedFormDefinition<Data>): ProtectedForm<Data> {
  if (!FORM_ID_FORMAT.test(id)) {
    throw new Error(
      `"${id}" no sirve como identificador de formulario: minúsculas, números y guion bajo, empezando por letra, hasta 40 caracteres.`,
    );
  }
  if (!isUsableRateLimit(rateLimit)) {
    throw new Error(
      `El límite del formulario "${id}" no sirve: intentos y segundos deben ser enteros de 1 en adelante.`,
    );
  }
  return { id, schema, rateLimit };
}

function resolveDependencies(
  overrides: Partial<ProtectedFormDependencies>,
): ProtectedFormDependencies {
  return {
    env: overrides.env ?? serverEnv,
    now: overrides.now ?? Date.now,
    fetch: overrides.fetch ?? fetch,
    store: overrides.store ?? createSupabaseFormStore(),
  };
}

/**
 * Emite lo que el formulario necesita para pasar las capas. Se llama en el
 * `loader`, cada vez que se pinta el formulario. El segundo argumento
 * existe para las pruebas.
 */
export function issueFormProtection<Data>(
  form: ProtectedForm<Data>,
  {
    env = serverEnv,
    now = Date.now,
  }: Partial<Pick<ProtectedFormDependencies, "env" | "now">> = {},
): FormProtectionFields {
  return {
    siteKey: env.turnstileSiteKey,
    timestamp: issueSignedTimestamp(form.id, {
      secret: env.formProtectionSecret,
      now,
    }),
  };
}

/** El formulario de un envío; vacío si el cuerpo no es un formulario. */
export async function readFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch (error) {
    if (error instanceof TypeError) {
      // El cuerpo no es un formulario. Ningún navegador manda eso desde un
      // formulario del sitio: se trata como un envío vacío, que no trae
      // marca de tiempo y cae en la segunda capa.
      return new FormData();
    }
    throw error;
  }
}

function buildRateLimitKey(
  request: Request,
  formId: string,
  { env, now }: ProtectedFormDependencies,
): string {
  const client = readClientIp(request.headers, {
    header: env.clientIpHeader,
    trustedHops: env.clientIpTrustedHops,
  });
  if (client.ok) {
    const secret = env.formProtectionSecret;
    return `${formId}:${hashIp(client.ip, { secret, now })}`;
  }
  const hasNoProxy =
    client.reason === "missing_header" &&
    ENVIRONMENTS_WITHOUT_PROXY.includes(env.appEnv);
  if (!hasNoProxy) {
    // Con el proxy delante la cabecera siempre llega. Si falta, el entorno
    // está mal configurado, y sin IP no hay límite que aplicar.
    throw new Error(
      `No se pudo leer la IP del visitante (${client.reason}). Revisa CLIENT_IP_HEADER y CLIENT_IP_TRUSTED_HOPS.`,
    );
  }
  const secret = env.formProtectionSecret;
  return `${formId}:${hashIp(OWN_MACHINE_IP, { secret, now })}`;
}

/** Los campos de texto del formulario, sin los de la protección. Un archivo
 * donde iba un texto se ignora, y el esquema lo verá como ausente. */
function readTextFields(formData: FormData): Record<string, string> {
  // Un Map y no un objeto: un campo llamado `constructor` o `toString` es
  // un campo como cualquier otro.
  const fields = new Map<string, string>();
  for (const [name, value] of formData) {
    const isOwnField = !PROTECTION_FIELDS.includes(name) && !fields.has(name);
    if (isOwnField && typeof value === "string") {
      fields.set(name, value);
    }
  }
  return Object.fromEntries(fields);
}

function describeInvalid<Data>(
  error: z.ZodError<Data>,
  fields: Readonly<Record<string, string>>,
): ProtectedFormResult<Data> {
  const flattened = z.flattenError(error);
  const fieldErrors: Record<string, string> = {};
  for (const [name, messages] of Object.entries<string[] | undefined>(
    flattened.fieldErrors,
  )) {
    const [firstMessage] = messages ?? [];
    if (firstMessage !== undefined) {
      fieldErrors[name] = firstMessage;
    }
  }
  const values = Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [
      name,
      value.slice(0, MAX_ECHOED_VALUE_LENGTH),
    ]),
  );
  return {
    status: "invalid",
    fieldErrors,
    formErrors: flattened.formErrors,
    values,
  };
}

type Rejection<Data> = Exclude<
  ProtectedFormResult<Data>,
  { status: "accepted" }
>;

const REJECTION_REASONS: Record<Rejection<unknown>["status"], RejectionReason> =
  {
    discarded: "honeypot",
    too_fast: "too_fast",
    verification_failed: "turnstile",
    rate_limited: "rate_limit",
    invalid: "validation",
  };

/** Las tres primeras capas no tocan la base ni leen los campos del envío. */
async function findEarlyRejection(
  formData: FormData,
  formId: string,
  { env, now, fetch: fetchImplementation }: ProtectedFormDependencies,
): Promise<Rejection<never> | undefined> {
  if (isHoneypotFilled(formData)) {
    return { status: "discarded" };
  }
  const timestamp = verifySignedTimestamp(
    formData.get(TIMESTAMP_FIELD),
    formId,
    { secret: env.formProtectionSecret, now },
  );
  if (timestamp.status !== "ok") {
    // Vencida o alterada se trata igual que demasiado rápido: la persona
    // recibe un formulario fresco y lo intenta de nuevo.
    return { status: "too_fast" };
  }
  const isVerified = await verifyTurnstile(formData.get(TURNSTILE_FIELD), {
    secretKey: env.turnstileSecretKey,
    appEnv: env.appEnv,
    fetch: fetchImplementation,
  });
  return isVerified ? undefined : { status: "verification_failed" };
}

async function applyLayers<Data>(
  request: Request,
  form: ProtectedForm<Data>,
  dependencies: ProtectedFormDependencies,
): Promise<ProtectedFormResult<Data>> {
  const formData = await readFormData(request);
  const earlyRejection = await findEarlyRejection(
    formData,
    form.id,
    dependencies,
  );
  if (earlyRejection !== undefined) {
    return earlyRejection;
  }
  const { maxAttempts, windowSeconds, mode } = form.rateLimit;
  const isWithinLimit = await dependencies.store.checkRateLimit({
    key: buildRateLimitKey(request, form.id, dependencies),
    maxAttempts,
    windowSeconds,
  });
  if (!isWithinLimit && mode === "block") {
    return { status: "rate_limited" };
  }
  const fields = readTextFields(formData);
  const parsed = form.schema.safeParse(fields);
  if (!parsed.success) {
    return describeInvalid(parsed.error, fields);
  }
  return { status: "accepted", data: parsed.data, overLimit: !isWithinLimit };
}

/**
 * Aplica las cinco capas a un envío. Se llama en el `action`.
 *
 * Todo resultado que no sea `accepted` suma 1 al contador de rechazos de
 * ese formulario, y de ese envío no se guarda nada más. Lanza si la base
 * falla o si no se puede leer la IP: un envío nunca se acepta en silencio.
 * El tercer argumento existe para las pruebas.
 */
export async function processProtectedForm<Data>(
  request: Request,
  form: ProtectedForm<Data>,
  overrides: Partial<ProtectedFormDependencies> = {},
): Promise<ProtectedFormResult<Data>> {
  const dependencies = resolveDependencies(overrides);
  const result = await applyLayers(request, form, dependencies);
  if (result.status !== "accepted") {
    await dependencies.store.recordRejection(
      form.id,
      REJECTION_REASONS[result.status],
    );
  }
  return result;
}
