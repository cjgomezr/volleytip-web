import { DEFAULT_LANGUAGE } from "./languages";

const MOVED_PERMANENTLY = 301;

/** El idioma por defecto tiene una sola dirección: sin prefijo. Devuelve la
 * redirección de `/es/...` a `/...` con la búsqueda intacta, o `null`. */
export function redirectFromDefaultPrefix(url: URL): Response | null {
  const prefix = `/${DEFAULT_LANGUAGE}`;
  const { pathname } = url;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null;

  const target = `${pathname.slice(prefix.length) || "/"}${url.search}`;
  return new Response(null, {
    status: MOVED_PERMANENTLY,
    headers: { Location: target },
  });
}
