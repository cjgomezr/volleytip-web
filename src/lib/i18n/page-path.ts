import type { LanguageDefinition } from "./languages";

// Cómo se arma la dirección de una página en un idioma. Lo usan las rutas
// (`route-map.ts`) y los enlaces, así que no importa nada de React Router:
// el navegador también lo carga.

// Una página se declara una sola vez. `path` es una cadena cuando la sección
// se llama igual en todos los idiomas, o un nombre por idioma cuando se
// traduce (decisión 3 del PRD de W2). "" es la home.
export interface PageDeclaration {
  readonly id: string;
  readonly file: string;
  readonly path: string | Readonly<Record<string, string>>;
}

export type PageParams = Readonly<Record<string, string>>;

const ROUTE_ID_SEPARATOR = ".";
const PARAM_PREFIX = ":";

/** El nombre de la sección de una página en un idioma, sin barras al borde. */
export function getSectionPath(
  page: PageDeclaration,
  language: string,
): string {
  if (typeof page.path === "string") return page.path;
  const name = page.path[language];
  // Sin nombre en un idioma, la página quedaría en la raíz de ese idioma sin
  // avisar. La raíz es solo de la home, que se declara con `path: ""`.
  if (name === undefined || name === "") {
    throw new Error(
      `A la página "${page.id}" le falta el nombre de su sección en "${language}".`,
    );
  }
  return name;
}

/** El identificador de la ruta de una página en un idioma. */
export function buildRouteId(pageId: string, language: string): string {
  return `${pageId}${ROUTE_ID_SEPARATOR}${language}`;
}

function fillSegment(
  segment: string,
  page: string,
  params: PageParams,
): string {
  if (!segment.startsWith(PARAM_PREFIX)) return segment;
  const name = segment.slice(PARAM_PREFIX.length);
  const value = params[name];
  if (value === undefined || value === "") {
    throw new Error(
      `A la dirección de la página "${page}" le falta el parámetro "${name}".`,
    );
  }
  return encodeURIComponent(value);
}

/**
 * La dirección de una página en un idioma, con la barra inicial y sin
 * dominio: `/`, `/en/`, `/tienda/balon`, `/en/shop/balon`. La home de un
 * idioma con prefijo termina en barra, como la escribe el PRD; las demás no.
 */
export function buildPagePath(
  page: PageDeclaration,
  language: LanguageDefinition,
  params: PageParams = {},
): string {
  const section = getSectionPath(page, language.code)
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => fillSegment(segment, page.id, params))
    .join("/");
  const prefix = language.isDefault ? "" : `/${language.code}`;
  return section === "" ? `${prefix}/` : `${prefix}/${section}`;
}

export interface PageMatch<Page extends PageDeclaration> {
  readonly page: Page;
  readonly language: string;
  readonly params: PageParams;
}

// React Router decodifica cada segmento antes de comparar. Uno mal
// codificado no coincide con nada.
function decodeSegment(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

function splitPath(path: string): string[] {
  return path.split("/").filter((segment) => segment !== "");
}

function matchSegments(
  pattern: readonly string[],
  actual: readonly string[],
): PageParams | undefined {
  if (pattern.length !== actual.length) return undefined;
  const params: Record<string, string> = {};
  for (const [index, expected] of pattern.entries()) {
    const value = decodeSegment(actual[index] ?? "");
    if (value === undefined) return undefined;
    if (expected.startsWith(PARAM_PREFIX)) {
      params[expected.slice(PARAM_PREFIX.length)] = value;
    } else if (expected !== value) {
      return undefined;
    }
  }
  return params;
}

/**
 * La página, el idioma y los parámetros de una dirección, o `undefined` si
 * no es de ninguna página (un 404, `/healthz`, las páginas de `/dev/`).
 * Compara como las rutas: con mayúsculas exactas y sin importar la barra
 * final.
 */
export function findPageAtPath<Page extends PageDeclaration>(
  pathname: string,
  pages: readonly Page[],
  languages: readonly LanguageDefinition[],
): PageMatch<Page> | undefined {
  const actual = splitPath(pathname);
  for (const language of languages) {
    const prefix = language.isDefault ? [] : [language.code];
    for (const page of pages) {
      const pattern = [
        ...prefix,
        ...splitPath(getSectionPath(page, language.code)),
      ];
      const params = matchSegments(pattern, actual);
      if (params !== undefined) {
        return { page, language: language.code, params };
      }
    }
  }
  return undefined;
}
