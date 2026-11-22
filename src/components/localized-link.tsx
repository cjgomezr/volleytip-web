import type { ComponentProps, ReactElement } from "react";
import { Link } from "react-router";

import type { PageParams } from "~/lib/i18n/page-path";
import { getPagePath, type PageId } from "~/lib/i18n/pages";
import { useLanguage } from "~/lib/i18n/use-language";

type LocalizedLinkProps = Omit<ComponentProps<typeof Link>, "to"> & {
  /** Una página del mapa (`src/lib/i18n/pages.ts`), no una dirección. */
  readonly page: PageId;
  readonly params?: PageParams;
};

/**
 * El enlace a otra página del sitio. Lleva a esa página en el idioma de la
 * que se está pintando, así que un enlace nunca saca a nadie de su idioma
 * (FR-005). Todo enlace interno pasa por aquí.
 */
export function LocalizedLink({
  page,
  params,
  ...linkProps
}: LocalizedLinkProps): ReactElement {
  const language = useLanguage();
  return <Link {...linkProps} to={getPagePath(page, language, params)} />;
}
