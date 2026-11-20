import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Marca de tiempo firmada (FR-135, capa 2). El servidor la emite al pintar
 * el formulario y la verifica al recibirlo. Un envío que llega antes de 3
 * segundos no lo llenó una persona. La firma impide que el cliente se
 * invente la marca o le cambie la hora, y ata la marca a un formulario.
 */

const MIN_FILL_TIME_MS = 3 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SEPARATOR = ".";
// Milisegundos desde 1970 en decimal: 13 dígitos hoy, 15 alcanzan por milenios.
const ISSUED_AT_FORMAT = /^\d{1,15}$/;
// Una marca legítima mide unos 57 caracteres. Lo que pase de aquí no se
// procesa: ni se divide ni se le calcula una firma.
const MAX_TOKEN_LENGTH = 128;
// Separa estas firmas de cualquier otro uso del mismo secreto.
const SIGNATURE_CONTEXT = "form-timestamp";

export interface TimestampOptions {
  /** `FORM_PROTECTION_SECRET` del entorno. */
  readonly secret: string;
  /** Reloj en milisegundos. Se inyecta para poder probar sin esperar. */
  readonly now: () => number;
}

export type TimestampVerdict =
  | { readonly status: "ok" }
  /** Llegó antes del tiempo mínimo: no lo llenó una persona. */
  | { readonly status: "too_fast" }
  /** Pasaron más de 24 horas desde que se pintó el formulario. */
  | { readonly status: "expired" }
  /** Falta, está mal formada, la firma no coincide o es de otro formulario. */
  | { readonly status: "invalid" };

const INVALID: TimestampVerdict = { status: "invalid" };

function sign(formId: string, issuedAt: string, secret: string): Buffer {
  return createHmac("sha256", secret)
    .update(`${SIGNATURE_CONTEXT}:${formId}:${issuedAt}`)
    .digest();
}

/** Compara en tiempo constante, para que el tiempo de respuesta no delate
 * cuántos caracteres de una firma falsa iban bien. */
function isSameSignature(received: string, expected: Buffer): boolean {
  // Se comparan los textos y no los bytes decodificados: `base64url` ignora
  // caracteres inválidos, y así varias cadenas valdrían como la misma firma.
  const receivedText = Buffer.from(received, "utf8");
  const expectedText = Buffer.from(expected.toString("base64url"), "utf8");
  return (
    receivedText.length === expectedText.length &&
    timingSafeEqual(receivedText, expectedText)
  );
}

/** Emite la marca que el formulario lleva en un campo oculto. */
export function issueSignedTimestamp(
  formId: string,
  { secret, now }: TimestampOptions,
): string {
  const issuedAt = String(now());
  const signature = sign(formId, issuedAt, secret).toString("base64url");
  return `${issuedAt}${SEPARATOR}${signature}`;
}

function judgeAge(ageMs: number): TimestampVerdict {
  if (ageMs < 0) {
    // Emitida "en el futuro": un servidor nuestro no la pudo firmar así.
    return INVALID;
  }
  if (ageMs < MIN_FILL_TIME_MS) {
    return { status: "too_fast" };
  }
  if (ageMs > MAX_AGE_MS) {
    return { status: "expired" };
  }
  return { status: "ok" };
}

/**
 * Verifica la marca que llegó con el envío. Recibe el valor crudo del
 * formulario, que puede faltar o ser un archivo.
 */
export function verifySignedTimestamp(
  token: FormDataEntryValue | null | undefined,
  formId: string,
  { secret, now }: TimestampOptions,
): TimestampVerdict {
  if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) {
    return INVALID;
  }
  const parts = token.split(SEPARATOR);
  const [issuedAt, signature] = parts;
  if (
    parts.length !== 2 ||
    issuedAt === undefined ||
    signature === undefined ||
    !ISSUED_AT_FORMAT.test(issuedAt)
  ) {
    return INVALID;
  }
  if (!isSameSignature(signature, sign(formId, issuedAt, secret))) {
    return INVALID;
  }
  return judgeAge(now() - Number(issuedAt));
}
