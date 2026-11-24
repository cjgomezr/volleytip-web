import type { ReactElement } from "react";

import { buildPageAddresses } from "~/lib/i18n/language-alternates";
import { getAddressedPage } from "~/lib/i18n/pages";
import { useCurrentPage } from "~/lib/i18n/use-current-page";
import { useLanguage } from "~/lib/i18n/use-language";

interface LanguageAlternatesProps {
  /** El dominio público del entorno (`SITE_ORIGIN`). */
  readonly siteOrigin: string;
}

/**
 * La dirección canónica de la página y sus versiones en cada idioma. Es el
 * único lugar que las pinta: ninguna página las arma por su cuenta. React
 * sube estas etiquetas al `<head>` desde donde se pinten. Fuera de una
 * página del sitio (un 404, `/dev/`) no pinta nada.
 */
export function LanguageAlternates({
  siteOrigin,
}: LanguageAlternatesProps): ReactElement | null {
  const language = useLanguage();
  const current = useCurrentPage();
  if (current === undefined) {
    return null;
  }
  const { canonical, alternates } = buildPageAddresses({
    siteOrigin,
    language,
    ...getAddressedPage(current),
  });
  return (
    <>
      <link rel="canonical" href={canonical} />
      {alternates.map(({ hreflang, href }) => (
        <link key={hreflang} rel="alternate" hrefLang={hreflang} href={href} />
      ))}
    </>
  );
}
