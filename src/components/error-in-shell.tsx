import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";

import { PAGES } from "~/lib/i18n/pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { getMenuEntries } from "~/lib/site-menu";

import { ErrorContent } from "./error-content";
import { SiteShell } from "./site-shell";

// 44 px de alto como mínimo: zona de toque en celular.
const SECTION_LINK_STYLES =
  "inline-flex min-h-11 items-center px-1 text-[14px] font-bold underline hovered:text-brand-lime transition-colors motion-reduce:transition-none";

// Los enlaces del 404 a las secciones que ya existen en el mapa de páginas.
// Una sección que todavía no tiene página no se pinta.
function SectionLinks(): ReactElement {
  const translate = useTranslate();
  const entries = getMenuEntries(PAGES, useLanguage());
  return (
    <>
      {entries.map((entry) => (
        <Link key={entry.id} to={entry.href} className={SECTION_LINK_STYLES}>
          {translate(entry.labelKey)}
        </Link>
      ))}
    </>
  );
}

/** Un 404 u otra respuesta de error controlada, con la cáscara del sitio. */
export function ErrorInShell({
  error,
  announcements,
  notice,
  year,
}: {
  readonly error: unknown;
  readonly announcements?: readonly string[];
  readonly notice?: ReactNode;
  readonly year: number;
}): ReactElement {
  return (
    <SiteShell announcements={announcements} notice={notice} year={year}>
      <ErrorContent error={error}>
        <SectionLinks />
      </ErrorContent>
    </SiteShell>
  );
}
