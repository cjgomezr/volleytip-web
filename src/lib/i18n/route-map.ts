import { index, route, type RouteConfigEntry } from "@react-router/dev/routes";

import { SUPPORTED_LANGUAGES, type LanguageDefinition } from "./languages";

// Una página se declara una sola vez. `path` es una cadena cuando la sección
// se llama igual en todos los idiomas, o un nombre por idioma cuando se
// traduce (decisión 3 del PRD de W2). "" es la home.
export interface PageDeclaration {
  readonly id: string;
  readonly file: string;
  readonly path: string | Readonly<Record<string, string>>;
}

function pathInLanguage(page: PageDeclaration, language: string): string {
  return typeof page.path === "string"
    ? page.path
    : (page.path[language] ?? "");
}

function joinPrefix(language: LanguageDefinition, path: string): string {
  if (language.isDefault) return path;
  return path === "" ? language.code : `${language.code}/${path}`;
}

function toRoute(
  page: PageDeclaration,
  language: LanguageDefinition,
  fullPath: string,
): RouteConfigEntry {
  const id = `${page.id}.${language.code}`;
  // React Router ignora las mayúsculas por defecto; los prefijos no.
  return fullPath === ""
    ? index(page.file, { id })
    : route(fullPath, page.file, { id, caseSensitive: true });
}

/** Una ruta por página e idioma, sin que la página repita su declaración. */
export function buildLocalizedRoutes(
  pages: readonly PageDeclaration[],
  languages: readonly LanguageDefinition[] = SUPPORTED_LANGUAGES,
): RouteConfigEntry[] {
  const seen = new Set<string>();
  return languages.flatMap((language) =>
    pages.map((page) => {
      const fullPath = joinPrefix(
        language,
        pathInLanguage(page, language.code),
      );
      if (seen.has(fullPath)) {
        throw new Error(
          `Dos páginas comparten la dirección "/${fullPath}" (${page.id}).`,
        );
      }
      seen.add(fullPath);
      return toRoute(page, language, fullPath);
    }),
  );
}
