import type { Language } from "./i18n/languages";

/** El país que sale elegido en los formularios de lista de espera y contacto. */
export const DEFAULT_COUNTRY_CODE = "CO";

// Códigos ISO 3166-1 de los países desde donde escribe la gente de VolleyTip:
// el continente americano, España, Portugal y los demás países de mayor
// diáspora. Es la única lista: los formularios que piden un país la comparten.
export const COUNTRY_CODES = [
  "AR",
  "BO",
  "BR",
  "CL",
  "CO",
  "CR",
  "CU",
  "DO",
  "EC",
  "SV",
  "GT",
  "HN",
  "MX",
  "NI",
  "PA",
  "PY",
  "PE",
  "PR",
  "UY",
  "VE",
  "US",
  "CA",
  "ES",
  "PT",
  "FR",
  "IT",
  "DE",
  "GB",
  "IE",
  "NL",
  "CH",
  "AU",
  "JP",
  "AE",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

export interface Country {
  readonly code: CountryCode;
  readonly name: string;
}

export function isCountryCode(value: string): value is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(value);
}

/** Los países con su nombre en el idioma pedido, ordenados por ese nombre. */
export function listCountries(language: Language): readonly Country[] {
  const names = new Intl.DisplayNames([language], { type: "region" });
  const collator = new Intl.Collator(language);
  return COUNTRY_CODES.map((code) => ({
    code,
    name: names.of(code) ?? code,
  })).sort((first, second) => collator.compare(first.name, second.name));
}
