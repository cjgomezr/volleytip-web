const DATA_SUFFIX = ".data";
// React Router pide los datos de una dirección que termina en barra con un
// guion bajo en su lugar: `/` es `/_.data` y `/en/` es `/en/_.data`.
const TRAILING_SLASH_DATA_SUFFIX = "/_.data";

/**
 * La dirección de la página que sirve una petición, sea del documento o de
 * los datos que React Router pide al navegar (`/en.data`). El middleware ve la
 * petición original, y las reglas de idioma hablan de páginas.
 */
export function getDocumentPath(url: URL): string {
  const { pathname } = url;
  if (pathname.endsWith(TRAILING_SLASH_DATA_SUFFIX)) {
    return pathname.slice(0, -TRAILING_SLASH_DATA_SUFFIX.length + 1);
  }
  if (pathname.endsWith(DATA_SUFFIX)) {
    return pathname.slice(0, -DATA_SUFFIX.length);
  }
  return pathname;
}
