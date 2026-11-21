import type { Language } from "../languages";

// Los textos de la página de error, en todos los idiomas y en un archivo
// aparte. Los demás textos llegan al navegador con los datos de la raíz, y
// solo los del idioma de la página. Estos no pueden depender de eso: la
// página de error tiene que poder pintarse también cuando el fallo ocurrió
// antes de que la raíz tuviera sus datos. Por eso viajan siempre, y son los
// únicos que lo hacen.
export const errorsEs = {
  "error.notFoundTitle": "404",
  "error.notFoundDetails": "Esta página no existe.",
  "error.genericTitle": "Error",
  "error.genericDetails": "Algo salió mal. Intenta de nuevo.",
} as const;

export type ErrorMessages = {
  readonly [Key in keyof typeof errorsEs]: string;
};

export const errorsEn = {
  "error.notFoundTitle": "404",
  "error.notFoundDetails": "This page does not exist.",
  "error.genericTitle": "Error",
  "error.genericDetails": "Something went wrong. Please try again.",
} as const satisfies ErrorMessages;

export const ERROR_MESSAGES: Readonly<Record<Language, ErrorMessages>> = {
  es: errorsEs,
  en: errorsEn,
};
