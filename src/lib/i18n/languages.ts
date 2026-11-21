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

export const DEFAULT_LANGUAGE: Language = "es";

export function isSupportedLanguage(code: string): code is Language {
  return SUPPORTED_LANGUAGES.some((language) => language.code === code);
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
  const [, firstSegment = ""] = pathname.split("/");
  const prefixed = languages.find(
    (language) => !language.isDefault && language.code === firstSegment,
  );
  return (
    prefixed?.code ??
    languages.find((language) => language.isDefault)?.code ??
    DEFAULT_LANGUAGE
  );
}
