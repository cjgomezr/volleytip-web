import { randomBytes } from "node:crypto";

const REFERENCE_CODE_BYTES = 4;

// Un código por petición: si fallan dos loaders de la misma petición, la
// persona ve un solo código y el registro lo repite en cada error.
const codesByRequest = new WeakMap<Request, string>();

function createReferenceCode(): string {
  return randomBytes(REFERENCE_CODE_BYTES).toString("hex").toUpperCase();
}

/** El código que el registro le dio a esta petición, si algún error lo pidió. */
export function findRequestReferenceCode(request: Request): string | undefined {
  return codesByRequest.get(request);
}

/**
 * Registra un error del servidor con el código de referencia de su petición,
 * el mismo que la página 500 le muestra a la persona. Una petición que el
 * cliente abortó no es un fallo nuestro.
 */
export function reportServerError(error: unknown, request: Request): void {
  if (request.signal.aborted) return;
  const code = codesByRequest.get(request) ?? createReferenceCode();
  codesByRequest.set(request, code);
  console.error(`Error del servidor, referencia ${code}`, error);
}
