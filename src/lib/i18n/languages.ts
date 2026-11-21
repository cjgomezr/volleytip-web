// Única lista de idiomas que sirve el sitio (decisión 5 del PRD de W2): la
// decide el código, no la base. El idioma por defecto se sirve sin prefijo y
// cada otro bajo el suyo.
export interface LanguageDefinition {
  readonly code: string;
  readonly isDefault: boolean;
}

export const SUPPORTED_LANGUAGES = [
  { code: "es", isDefault: true },
  { code: "en", isDefault: false },
] as const satisfies readonly LanguageDefinition[];

export type Language = (typeof SUPPORTED_LANGUAGES)[number]["code"];

/** Falla pronto si la lista no tiene exactamente un idioma por defecto. */
export function findDefaultLanguage(
  languages: readonly LanguageDefinition[],
): string {
  const defaults = languages.filter(({ isDefault }) => isDefault);
  const [only, ...extra] = defaults;
  if (only === undefined || extra.length > 0) {
    throw new Error(
      `Debe haber exactamente un idioma por defecto, hay ${defaults.length}.`,
    );
  }
  return only.code;
}

export const DEFAULT_LANGUAGE = findDefaultLanguage(
  SUPPORTED_LANGUAGES,
) as Language;

export function isSupportedLanguage(code: string): code is Language {
  return SUPPORTED_LANGUAGES.some((language) => language.code === code);
}

// React Router decodifica cada segmento antes de buscar la ruta, así que
// `/%65n/` sirve la misma página que `/en/`. El idioma se decide igual, o el
// `lang` contradiría lo que se pinta. Un segmento mal codificado se deja tal
// cual: no es un idioma.
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// Los prefijos van en minúsculas y exactos: `/EN/` o `/english` no cuentan.
// `/es/...` tampoco: se redirige antes de llegar aquí.
export function getLanguageFromPath(pathname: string): Language;
export function getLanguageFromPath(
  pathname: string,
  languages: readonly LanguageDefinition[],
): string;
export function getLanguageFromPath(
  pathname: string,
  languages: readonly LanguageDefinition[] = SUPPORTED_LANGUAGES,
): string {
  const [, rawSegment = ""] = pathname.split("/");
  const firstSegment = decodeSegment(rawSegment);
  const prefixed = languages.find(
    (language) => !language.isDefault && language.code === firstSegment,
  );
  return prefixed?.code ?? findDefaultLanguage(languages);
}

/** El idioma de la página que atiende un loader o un action. */
export function getRequestLanguage(request: Request): Language {
  return getLanguageFromPath(new URL(request.url).pathname);
}
