import { SUPPORTED_LANGUAGES, type Language } from "./languages";
import {
  buildPagePath,
  findPageAtPath,
  type PageDeclaration,
  type PageParams,
} from "./page-path";

// El mapa de páginas del sitio. Cada una se declara una vez aquí y existe en
// todos los idiomas: de esta lista salen las rutas (`src/routes.ts`) y la
// dirección de cada enlace. Una página que no esté aquí no se puede enlazar.
export const PAGES = [
  { id: "home", file: "routes/home.tsx", path: "" },
  // Decisión 9 del PRD de W3: `/app` en los dos idiomas.
  { id: "app", file: "routes/app.tsx", path: "app" },
  // Enlace compartido de una rutina. Sin la app, es una página "Próximamente"
  // (FR-080); el código solo va en la dirección.
  { id: "routineLink", file: "routes/routine-link.tsx", path: "r/:code" },
  // Decisión 9 del PRD de W3: `/nosotros` y `/en/about`.
  {
    id: "about",
    file: "routes/about.tsx",
    path: { es: "nosotros", en: "about" },
  },
  {
    id: "terms",
    file: "routes/terms.tsx",
    path: { es: "terminos", en: "terms" },
  },
  {
    id: "privacy",
    file: "routes/privacy.tsx",
    path: { es: "privacidad", en: "privacy" },
  },
] as const satisfies readonly PageDeclaration[];

export type PageId = (typeof PAGES)[number]["id"];

function findPage(id: PageId): PageDeclaration {
  const page = PAGES.find((candidate) => candidate.id === id);
  if (page === undefined) {
    throw new Error(`La página "${id}" no está en el mapa de páginas.`);
  }
  return page;
}

export function findLanguage(
  code: Language,
): (typeof SUPPORTED_LANGUAGES)[number] {
  const language = SUPPORTED_LANGUAGES.find(
    (candidate) => candidate.code === code,
  );
  if (language === undefined) {
    throw new Error(`El idioma "${code}" no está soportado.`);
  }
  return language;
}

/** La dirección de una página del sitio en un idioma: `/` o `/en/`. */
export function getPagePath(
  id: PageId,
  language: Language,
  params?: PageParams,
): string {
  return buildPagePath(findPage(id), findLanguage(language), params);
}

export interface CurrentPage {
  readonly page: PageId;
  readonly params: PageParams;
}

/** La página del sitio que hay en una dirección, o `undefined` si no es
 * ninguna (un 404, `/healthz`, las páginas de `/dev/`). */
export function getPageAtPath(pathname: string): CurrentPage | undefined {
  const match = findPageAtPath(pathname, PAGES, SUPPORTED_LANGUAGES);
  return match && { page: match.page.id, params: match.params };
}

// Páginas cuya dirección lleva un dato que no debe llegar a los buscadores
// (el código de un enlace compartido): declaran la dirección de otra página.
const ADDRESSED_AS: Readonly<Partial<Record<PageId, PageId>>> = {
  routineLink: "app",
};

/** La página que declaran a los buscadores como canónica y sus idiomas:
 * casi siempre ella misma, sin los parámetros de la dirección. */
export function getAddressedPage(current: CurrentPage): CurrentPage {
  const page = ADDRESSED_AS[current.page];
  return page === undefined ? current : { page, params: {} };
}
