import { index, route, type RouteConfigEntry } from "@react-router/dev/routes";

import {
  SUPPORTED_LANGUAGES,
  findDefaultLanguage,
  type LanguageDefinition,
} from "./languages";

import {
  buildRouteId,
  getSectionPath,
  type PageDeclaration,
} from "./page-path";

export type { PageDeclaration } from "./page-path";

function joinPrefix(language: LanguageDefinition, path: string): string {
  if (language.isDefault) return path;
  return path === "" ? language.code : `${language.code}/${path}`;
}

function toRoute(
  page: PageDeclaration,
  language: LanguageDefinition,
  fullPath: string,
): RouteConfigEntry {
  const id = buildRouteId(page.id, language.code);
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
  findDefaultLanguage(languages);
  const seen = new Set<string>();
  return languages.flatMap((language) =>
    pages.map((page) => {
      const fullPath = joinPrefix(
        language,
        getSectionPath(page, language.code),
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
