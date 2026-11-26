import { DEFAULT_LANGUAGE, type Language } from "./i18n/languages";

/** Los campos traducibles de un registro, en un idioma. */
export type TranslatedFields = object;

/** Las traducciones de un registro por idioma, tal como salen de la base. */
export type TranslationsByLanguage<Fields extends TranslatedFields> = Readonly<
  Partial<Record<Language, Partial<Fields>>>
>;

/** Los campos resueltos y el idioma del que salió cada uno. */
export interface ResolvedFields<Fields extends TranslatedFields> {
  readonly fields: Fields;
  readonly languages: { readonly [Field in keyof Fields]: Language };
}

interface ResolveOptions<Fields extends TranslatedFields> {
  readonly requestedLanguage: Language;
  readonly translations: TranslationsByLanguage<Fields>;
}

/** Un registro no tiene su versión en español, que es la de respaldo. */
export class MissingSpanishTranslationError extends Error {
  constructor() {
    super(
      "El español es obligatorio: el registro no tiene traducción en español y no hay de dónde respaldar los campos que falten.",
    );
    this.name = "MissingSpanishTranslationError";
  }
}

// Un texto en blanco o una lista vacía es una traducción que no se hizo.
function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

/**
 * Elige, campo por campo, el idioma pedido y cae al español cuando el campo
 * falta, está en blanco o es una lista vacía (FR-007, AC-003).
 *
 * Es pura: recibe las traducciones ya leídas. Lanza si falta el español. Los
 * campos que devuelve son los que trae el español.
 */
export function resolveTranslatedFields<Fields extends TranslatedFields>(
  options: ResolveOptions<Fields>,
): ResolvedFields<Fields> {
  const { requestedLanguage, translations } = options;
  const spanish = translations[DEFAULT_LANGUAGE];
  if (spanish === undefined) {
    throw new MissingSpanishTranslationError();
  }
  const requested = translations[requestedLanguage] ?? {};

  const fields: Record<string, unknown> = {};
  const languages: Record<string, Language> = {};
  for (const [name, spanishValue] of Object.entries(spanish)) {
    const requestedValue: unknown = (requested as Record<string, unknown>)[
      name
    ];
    const usesRequested =
      requestedLanguage !== DEFAULT_LANGUAGE && isPresent(requestedValue);
    fields[name] = usesRequested ? requestedValue : spanishValue;
    languages[name] = usesRequested ? requestedLanguage : DEFAULT_LANGUAGE;
  }
  return {
    fields: fields as Fields,
    languages: languages as ResolvedFields<Fields>["languages"],
  };
}
