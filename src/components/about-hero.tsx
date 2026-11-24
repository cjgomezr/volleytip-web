import type { ReactElement } from "react";

import { OptimizedImage } from "~/components/optimized-image";
import { useTranslate } from "~/lib/i18n/translations-context";

/** Dónde vive la foto del héroe dentro del almacenamiento de imágenes. */
const HERO_PHOTO_PATH = "sitio/camilo-estudio.jpg";
const HERO_PHOTO_WIDTH = 1280;
const HERO_PHOTO_HEIGHT = 720;

/**
 * El héroe de Nosotros: foto a todo el ancho con un degradado encima. El
 * texto es blanco, así que el degradado oscurece toda la foto para que el
 * contraste se cumpla en cualquier ancho.
 */
export function AboutHero({
  cdnHost,
}: {
  readonly cdnHost: string;
}): ReactElement {
  const translate = useTranslate();

  return (
    <section className="relative flex min-h-[480px] items-end overflow-hidden md:min-h-[640px]">
      <OptimizedImage
        cdnHost={cdnHost}
        src={HERO_PHOTO_PATH}
        alt={translate("about.hero.photoAlt")}
        width={HERO_PHOTO_WIDTH}
        height={HERO_PHOTO_HEIGHT}
        sizes="100vw"
        isPriority
        className="absolute inset-0 size-full object-cover object-[center_35%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-brand-night/95 via-brand-night/80 to-brand-night/70"
      />
      <div className="relative mx-auto w-full max-w-[1280px] px-6 pt-24 pb-12 md:pt-32 md:pb-[72px]">
        <p className="m-0 text-[14px] font-bold tracking-[0.12em] text-white uppercase">
          {translate("about.eyebrow")}
        </p>
        <h1 className="mt-4 mb-0 font-display text-[64px] leading-[0.9] font-normal text-white uppercase md:text-[120px] lg:text-[144px]">
          {translate("about.heading.start")}{" "}
          <span className="text-brand-red">
            {translate("about.heading.highlight")}
          </span>
        </h1>
        <p className="mt-6 mb-0 max-w-[720px] text-[18px] leading-[1.5] text-white md:text-[22px]">
          {translate("about.intro.start")}
          <strong>{translate("about.intro.emphasis")}</strong>
          {translate("about.intro.end")}
        </p>
      </div>
    </section>
  );
}
