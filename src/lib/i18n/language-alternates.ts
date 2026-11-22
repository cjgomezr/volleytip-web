import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type Language,
} from "./languages";
import type { PageParams } from "./page-path";
import { getPagePath, type PageId } from "./pages";

// Las direcciones que una página declara a los buscadores (NFR-008): la suya
// propia y la de sus versiones en los demás idiomas. Son absolutas y salen
// del dominio público del entorno, no de la petición: detrás del proxy el
// servidor ve llegar todo por `http` y con otro `Host`.

/** El valor de `hreflang` para quien no habla ninguno de los idiomas. */
export const FALLBACK_HREFLANG = "x-default";

export interface LanguageAlternate {
  readonly hreflang: string;
  readonly href: string;
}

export interface PageAddresses {
  readonly canonical: string;
  readonly alternates: readonly LanguageAlternate[];
}

interface PageAddressesInput {
  readonly siteOrigin: string;
  readonly language: Language;
  readonly page: PageId;
  readonly params?: PageParams;
}

/** Nunca llevan parámetros de búsqueda: se arman solo con la página. */
export function buildPageAddresses({
  siteOrigin,
  language,
  page,
  params,
}: PageAddressesInput): PageAddresses {
  const addressIn = (code: Language): string =>
    `${siteOrigin}${getPagePath(page, code, params)}`;
  return {
    canonical: addressIn(language),
    alternates: [
      ...SUPPORTED_LANGUAGES.map(({ code }) => ({
        hreflang: code,
        href: addressIn(code),
      })),
      { hreflang: FALLBACK_HREFLANG, href: addressIn(DEFAULT_LANGUAGE) },
    ],
  };
}
