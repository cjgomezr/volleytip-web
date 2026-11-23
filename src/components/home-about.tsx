import type { ReactElement } from "react";

import { LocalizedLink } from "~/components/localized-link";
import { OptimizedImage } from "~/components/optimized-image";
import { PAGES } from "~/lib/i18n/pages";
import { useTranslate } from "~/lib/i18n/translations-context";

/** Dónde vive la foto dentro del almacenamiento de imágenes. */
export const ABOUT_PHOTO_PATH = "sitio/camilo-estudio.jpg";
const ABOUT_PHOTO_WIDTH = 640;
const ABOUT_PHOTO_HEIGHT = 360;
const ABOUT_PAGE_ID: string = "about";

const LINK_STYLES =
  "mt-6 inline-flex min-h-[50px] items-center justify-center rounded-pill border-2 border-brand-mist px-6 py-2 text-[16px] leading-tight font-bold text-brand-mist no-underline hovered:border-brand-lime hovered:text-brand-lime pressed:border-brand-mist pressed:bg-brand-mist pressed:text-brand-night transition-colors motion-reduce:transition-none";

/**
 * El bloque "Quiénes somos". El enlace al equipo aparece cuando la página
 * Nosotros exista en el mapa de páginas; mientras tanto, solo hay texto.
 */
export function HomeAbout({
  cdnHost,
}: {
  readonly cdnHost: string;
}): ReactElement {
  const translate = useTranslate();
  const aboutPage = PAGES.find((page) => page.id === ABOUT_PAGE_ID);

  return (
    <section className="mx-auto grid max-w-[1280px] gap-8 px-6 py-16 md:grid-cols-2 md:items-center md:gap-12 md:py-24">
      <OptimizedImage
        cdnHost={cdnHost}
        src={ABOUT_PHOTO_PATH}
        alt={translate("home.about.photoAlt")}
        width={ABOUT_PHOTO_WIDTH}
        height={ABOUT_PHOTO_HEIGHT}
        sizes="(min-width: 768px) 50vw, 100vw"
        className="h-auto w-full aspect-video rounded-2xl bg-brand-indigo object-cover"
      />
      <div>
        <p className="m-0 text-[12px] font-bold tracking-[0.12em] uppercase">
          {translate("home.about.eyebrow")}
        </p>
        <h2 className="mt-3 mb-0 font-display text-[40px] leading-none font-normal uppercase md:text-[56px]">
          {translate("home.about.title")}
        </h2>
        <p className="mt-4 mb-0 max-w-[44ch] text-[16px] leading-[1.5] text-ink-muted">
          {translate("home.about.text")}
        </p>
        {aboutPage === undefined ? null : (
          <LocalizedLink page={aboutPage.id} className={LINK_STYLES}>
            {translate("home.about.link")}
          </LocalizedLink>
        )}
      </div>
    </section>
  );
}
