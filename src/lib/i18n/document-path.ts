const DATA_SUFFIX = ".data";
// React Router pide los datos de `/` como `/_root.data` y los de una
// dirección que termina en barra como `/en/_.data`.
const ROOT_DATA_NAME = /(^|\/)_root$/;
const TRAILING_DATA_NAME = /_$/;

/**
 * La dirección de la página que sirve una petición, sea del documento o de
 * los datos que React Router pide al navegar (`/_root.data`). El middleware
 * ve la petición original, y las reglas de idioma hablan de páginas.
 */
export function getDocumentPath(url: URL): string {
  const { pathname } = url;
  if (!pathname.endsWith(DATA_SUFFIX)) return pathname;
  const withoutSuffix = pathname.slice(0, -DATA_SUFFIX.length);
  const path = withoutSuffix
    .replace(ROOT_DATA_NAME, "$1")
    .replace(TRAILING_DATA_NAME, "");
  return path === "" ? "/" : path;
}
