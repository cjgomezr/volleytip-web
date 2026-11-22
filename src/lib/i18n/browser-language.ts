import { isSupportedLanguage, type Language } from "./languages";

// Una cabecera real mide decenas de caracteres. Una enorme es un intento de
// gastar tiempo del servidor, y se trata como si no hubiera cabecera.
const MAX_HEADER_LENGTH = 500;
const MAX_PREFERENCES = 20;
const MAX_WEIGHT = 1;
const DEFAULT_WEIGHT = 1;
const WEIGHT_PATTERN = /^\d(\.\d{0,3})?$/;

interface Preference {
  readonly language: Language;
  readonly weight: number;
}

function parseWeight(parameter: string | undefined): number | undefined {
  if (parameter === undefined) return DEFAULT_WEIGHT;
  const [name, value = ""] = parameter.split("=").map((part) => part.trim());
  if (name?.toLowerCase() !== "q" || !WEIGHT_PATTERN.test(value)) {
    return undefined;
  }
  const weight = Number(value);
  return weight > MAX_WEIGHT ? undefined : weight;
}

function parsePreference(entry: string): Preference | undefined {
  const [tag = "", parameter] = entry.split(";").map((part) => part.trim());
  const primary = tag.split("-")[0]?.toLowerCase() ?? "";
  const weight = parseWeight(parameter);
  if (weight === undefined || weight === 0) return undefined;
  if (!isSupportedLanguage(primary)) return undefined;
  return { language: primary, weight };
}

/**
 * El idioma que el sitio soporta y que el navegador prefiere según
 * `Accept-Language`, o `undefined` si no hay ninguno. Nunca lanza: una
 * cabecera mal formada solo pierde esa preferencia.
 */
export function getPreferredLanguage(
  header: string | null,
): Language | undefined {
  if (header === null || header.length > MAX_HEADER_LENGTH) return undefined;
  const preferences = header
    .split(",")
    .slice(0, MAX_PREFERENCES)
    .map(parsePreference)
    .filter((preference) => preference !== undefined);
  // Orden estable: en un empate gana la que viene primero.
  const [best] = [...preferences].sort((a, b) => b.weight - a.weight);
  return best?.language;
}
