import { DEFAULT_LANGUAGE } from "./languages";

const MOVED_PERMANENTLY = 301;

/** El idioma por defecto tiene una sola dirección: sin prefijo. Devuelve la
 * redirección de `/es/...` a `/...` con la búsqueda intacta, o `null`. */
export function redirectFromDefaultPrefix(url: URL): Response | null {
  const prefix = `/${DEFAULT_LANGUAGE}`;
  const { pathname } = url;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null;

  // `/es//evil.com` dejaría `//evil.com`, que el navegador toma por otro
  // sitio. Se colapsan las barras (y las barras invertidas) iniciales.
  const rest = pathname.slice(prefix.length).replace(/^[/\\]+/, "/");
  const target = `${rest || "/"}${url.search}`;
  return new Response(null, {
    status: MOVED_PERMANENTLY,
    headers: { Location: target },
  });
}
