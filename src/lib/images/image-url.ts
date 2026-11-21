/**
 * URL de una imagen servida por Bunny Optimizer (FR-123). El CDN la entrega
 * redimensionada al ancho que se le pide.
 *
 * El formato no va en la URL: con "WebP Image Compression" activado en la
 * zona, Bunny entrega WebP a los navegadores que lo aceptan y el original a
 * los demás, con la misma dirección.
 *
 * Parámetro `width` según la documentación de Bunny, consultada el 21 de
 * noviembre de 2026:
 * https://bunny.net/docs/optimizer/dynamic-images/resizing.md
 *
 * Es una función pura y no es de servidor: el componente de imagen la usa
 * también en el navegador. Por eso el dominio le llega como argumento.
 */

/** El ancho más grande que se le pide al CDN. Cubre una foto a pantalla
 * completa en alta densidad; más que eso es un error de quien llama. */
export const MAX_IMAGE_WIDTH = 4096;

export interface ImageUrlRequest {
  /** Dominio del CDN de imágenes, sin protocolo ni ruta. */
  readonly cdnHost: string;
  /** Ruta de la imagen dentro del almacenamiento: `productos/balon.jpg`. */
  readonly path: string;
  /** Ancho en píxeles al que el CDN debe entregarla. */
  readonly width: number;
}

const SEGMENT_SEPARATOR = "/";
// `https:`, `data:` y cualquier otro esquema al principio de la ruta.
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const PROTOCOL_RELATIVE_PREFIX = "//";
const BACKSLASH = "\\";
const RELATIVE_SEGMENTS: readonly string[] = [".", ".."];
const HOSTNAME_LABEL = "[a-z0-9]([a-z0-9-]*[a-z0-9])?";
const HOSTNAME = new RegExp(`^${HOSTNAME_LABEL}(\\.${HOSTNAME_LABEL})+$`, "i");
// Los logos viven en `public/brand/` y los sirve el propio sitio.
const BRAND_FOLDER = "brand";

/** Dice si el texto sirve como dominio del CDN: un nombre de host, sin
 * protocolo, puerto ni ruta. */
export function isImageCdnHost(value: string): boolean {
  return HOSTNAME.test(value);
}

function isUsableSegment(segment: string): boolean {
  return (
    segment !== "" &&
    !RELATIVE_SEGMENTS.includes(segment) &&
    !segment.includes(BACKSLASH)
  );
}

function readSegments(path: string): string[] {
  const trimmed = path.trim();
  if (
    trimmed.startsWith(PROTOCOL_RELATIVE_PREFIX) ||
    URL_SCHEME.test(trimmed)
  ) {
    throw new Error(
      "La imagen debe ser una ruta dentro del almacenamiento, no una URL absoluta.",
    );
  }
  const withoutLeadingSlash = trimmed.startsWith(SEGMENT_SEPARATOR)
    ? trimmed.slice(SEGMENT_SEPARATOR.length)
    : trimmed;
  if (withoutLeadingSlash === "") {
    throw new Error("La ruta de la imagen está vacía.");
  }
  const segments = withoutLeadingSlash.split(SEGMENT_SEPARATOR);
  if (!segments.every(isUsableSegment)) {
    throw new Error(
      "La ruta de la imagen no puede tener segmentos vacíos, relativos ni barras invertidas.",
    );
  }
  return segments;
}

function assertUsableWidth(width: number): void {
  if (!Number.isInteger(width) || width < 1 || width > MAX_IMAGE_WIDTH) {
    throw new Error(
      `El ancho de la imagen debe ser un entero entre 1 y ${String(MAX_IMAGE_WIDTH)}.`,
    );
  }
}

/**
 * Construye la URL de una imagen en el CDN. Lanza si la ruta, el ancho o el
 * dominio no sirven: son errores de quien programa, no de quien visita.
 */
export function buildImageUrl({
  cdnHost,
  path,
  width,
}: ImageUrlRequest): string {
  if (!isImageCdnHost(cdnHost)) {
    throw new Error(
      "El dominio del CDN de imágenes no es válido: va sin protocolo ni ruta.",
    );
  }
  assertUsableWidth(width);
  const segments = readSegments(path);
  if (segments[0] === BRAND_FOLDER) {
    throw new Error(
      "Los logos de public/brand/ se sirven desde el sitio, no por el CDN de imágenes.",
    );
  }
  const encodedPath = segments.map(encodeURIComponent).join(SEGMENT_SEPARATOR);
  return `https://${cdnHost}/${encodedPath}?width=${String(width)}`;
}
