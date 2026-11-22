import type { ReactElement, ReactNode } from "react";

import { useTranslate } from "~/lib/i18n/translations-context";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

const MAIN_ID = "contenido";

// Fuera de pantalla hasta recibir foco; entonces aparece arriba a la izquierda.
const SKIP_LINK_STYLES =
  "absolute top-4 left-4 z-50 -translate-y-24 rounded-pill bg-brand-lime px-5 py-3 text-[14px] font-bold text-brand-night no-underline focus:translate-y-0";

/** Lo que comparten las páginas públicas: salto, header, el único `<main>` y el pie. */
export function SiteShell({
  notice = null,
  year,
  children,
}: {
  /** Un aviso sobre el header (el de idioma). Va después del enlace de salto
   * para que este siga siendo el primer foco. */
  readonly notice?: ReactNode;
  /** El año de la línea legal del pie. */
  readonly year: number;
  readonly children: ReactNode;
}): ReactElement {
  const translate = useTranslate();
  return (
    <>
      <a href={`#${MAIN_ID}`} className={SKIP_LINK_STYLES}>
        {translate("header.skipLink")}
      </a>
      {notice}
      <SiteHeader />
      <main id={MAIN_ID} tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter year={year} />
    </>
  );
}
