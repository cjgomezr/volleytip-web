import { isRouteErrorResponse } from "react-router";

import type { ActiveLanguages } from "./active-languages";
import type { Messages } from "./translate";

const INACTIVE_LANGUAGE = "inactive-language";

/** Lo que lleva el 404 de un idioma desactivado. El middleware corre antes que
 * los loaders, así que la raíz no tiene sus datos y la respuesta tiene que
 * traerlos, en el idioma por defecto. */
export interface InactiveLanguageNotFound {
  readonly kind: typeof INACTIVE_LANGUAGE;
  readonly activeLanguages: ActiveLanguages;
  readonly messages: Messages;
  readonly year: number;
  readonly announcements: readonly string[];
}

export function buildInactiveLanguageData(
  content: Omit<InactiveLanguageNotFound, "kind">,
): InactiveLanguageNotFound {
  return { kind: INACTIVE_LANGUAGE, ...content };
}

function isInactiveLanguageData(
  value: unknown,
): value is InactiveLanguageNotFound {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === INACTIVE_LANGUAGE
  );
}

/** Los datos de ese 404, si ese es el error que se está pintando. */
export function findInactiveLanguageNotFound(
  error: unknown,
): InactiveLanguageNotFound | undefined {
  return isRouteErrorResponse(error) && isInactiveLanguageData(error.data)
    ? error.data
    : undefined;
}
