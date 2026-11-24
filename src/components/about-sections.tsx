import type { ReactElement } from "react";
import { Link } from "react-router";

import { OptimizedImage } from "~/components/optimized-image";
import { TRANSITION_STYLES } from "~/components/pressable-styles";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";

const SECTION_TITLE_STYLES =
  "m-0 mb-10 font-display text-[44px] leading-none font-normal uppercase md:text-[64px]";
const PHOTO_BASE_PATH = "sitio";

interface TitledText {
  readonly titleKey: MessageKey;
  readonly textKey: MessageKey;
}

const HOW_STEPS: readonly TitledText[] = [
  { titleKey: "about.how.step1.title", textKey: "about.how.step1.text" },
  { titleKey: "about.how.step2.title", textKey: "about.how.step2.text" },
  { titleKey: "about.how.step3.title", textKey: "about.how.step3.text" },
];

// El último momento es "Hoy": va resaltado.
const STORY_MOMENTS: readonly TitledText[] = [
  { titleKey: "about.story.moment1.title", textKey: "about.story.moment1.text" },
  { titleKey: "about.story.moment2.title", textKey: "about.story.moment2.text" },
  { titleKey: "about.story.moment3.title", textKey: "about.story.moment3.text" },
  { titleKey: "about.story.moment4.title", textKey: "about.story.moment4.text" },
];

interface Founder {
  readonly id: "piza" | "gomez";
  readonly photoFile: string;
  readonly nameKey: MessageKey;
  readonly positionKey: MessageKey;
  readonly textKey: MessageKey;
  readonly photoAltKey: MessageKey;
}

// Textos de las traducciones hasta que el admin los edite (FR-065, W10a).
const FOUNDERS: readonly Founder[] = [
  {
    id: "piza",
    photoFile: "piza.webp",
    nameKey: "about.founders.piza.name",
    positionKey: "about.founders.piza.position",
    textKey: "about.founders.piza.text",
    photoAltKey: "about.founders.piza.photoAlt",
  },
  {
    id: "gomez",
    photoFile: "gomez.webp",
    nameKey: "about.founders.gomez.name",
    positionKey: "about.founders.gomez.position",
    textKey: "about.founders.gomez.text",
    photoAltKey: "about.founders.gomez.photoAlt",
  },
];

const FOUNDER_PHOTO_WIDTH = 480;
const FOUNDER_PHOTO_HEIGHT = 600;
const CHARACTERS_PHOTO_WIDTH = 360;
const CHARACTERS_PHOTO_HEIGHT = 640;
const STEP_NUMBER_DIGITS = 2;

const CTA_STYLES = `inline-flex min-h-[54px] items-center justify-center rounded-pill bg-brand-red px-7 py-2 text-[17px] leading-tight font-bold text-brand-night no-underline hovered:bg-brand-lime pressed:bg-brand-mist ${TRANSITION_STYLES}`;

export function HowWeDoIt(): ReactElement {
  const translate = useTranslate();

  return (
    <section className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
      <h2 className={SECTION_TITLE_STYLES}>{translate("about.how.title")}</h2>
      <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
        {HOW_STEPS.map((step, index) => (
          <li key={step.titleKey} className="border-t-4 border-brand-red pt-6">
            <p className="m-0 font-display text-[56px] leading-none text-brand-red">
              {String(index + 1).padStart(STEP_NUMBER_DIGITS, "0")}
            </p>
            <h3 className="mt-4 mb-2.5 text-[26px] leading-tight font-bold">
              {translate(step.titleKey)}
            </h3>
            <p className="m-0 leading-[1.6] text-ink-muted">
              {translate(step.textKey)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OurStory(): ReactElement {
  const translate = useTranslate();
  const lastIndex = STORY_MOMENTS.length - 1;

  return (
    <section className="bg-brand-indigo">
      <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
        <h2 className={SECTION_TITLE_STYLES}>
          {translate("about.story.title")}
        </h2>
        <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-4">
          {STORY_MOMENTS.map((moment, index) => {
            const isToday = index === lastIndex;
            return (
              <li
                key={moment.titleKey}
                className={
                  isToday
                    ? "rounded-[20px] bg-brand-red p-6 text-brand-night"
                    : "rounded-[20px] bg-brand-night p-6"
                }
              >
                <p className="m-0 font-display text-[40px] leading-none">
                  {translate(moment.titleKey)}
                </p>
                <p
                  className={
                    isToday
                      ? "mt-3 mb-0 leading-[1.5] font-semibold"
                      : "mt-3 mb-0 leading-[1.5] text-ink-muted"
                  }
                >
                  {translate(moment.textKey)}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export function Founders({
  cdnHost,
}: {
  readonly cdnHost: string;
}): ReactElement {
  const translate = useTranslate();

  return (
    <section className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
      <h2 className={SECTION_TITLE_STYLES}>
        {translate("about.founders.title")}
      </h2>
      <ul className="m-0 grid list-none gap-6 p-0 lg:grid-cols-2">
        {FOUNDERS.map((founder) => (
          <li
            key={founder.id}
            className="grid overflow-hidden rounded-3xl bg-brand-indigo sm:grid-cols-2"
          >
            <OptimizedImage
              cdnHost={cdnHost}
              src={`${PHOTO_BASE_PATH}/${founder.photoFile}`}
              alt={translate(founder.photoAltKey)}
              width={FOUNDER_PHOTO_WIDTH}
              height={FOUNDER_PHOTO_HEIGHT}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="aspect-[4/5] h-full w-full object-cover"
            />
            <div className="flex min-w-0 flex-col justify-end p-6 md:p-8">
              <p className="m-0 text-[13px] font-bold tracking-[0.1em] text-brand-lime uppercase">
                {translate("about.founders.role")}
              </p>
              <h3 className="mt-2.5 mb-0 font-display text-[36px] leading-none font-normal uppercase md:text-[44px]">
                {translate(founder.nameKey)}
              </h3>
              <p className="mt-2 mb-0 font-semibold">
                {translate(founder.positionKey)}
              </p>
              <p className="mt-3.5 mb-0 leading-[1.6] text-ink-muted">
                {translate(founder.textKey)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Los personajes: solo imagen y frase hasta que se defina su texto (P-07). */
export function Characters({
  cdnHost,
}: {
  readonly cdnHost: string;
}): ReactElement {
  const translate = useTranslate();

  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-16 md:pb-24">
      <div className="grid overflow-hidden rounded-[32px] bg-brand-red text-brand-night md:grid-cols-[minmax(0,360px)_1fr]">
        <OptimizedImage
          cdnHost={cdnHost}
          src={`${PHOTO_BASE_PATH}/personajes.jpg`}
          alt={translate("about.characters.photoAlt")}
          width={CHARACTERS_PHOTO_WIDTH}
          height={CHARACTERS_PHOTO_HEIGHT}
          sizes="(min-width: 768px) 360px, 100vw"
          className="max-h-[360px] w-full object-cover object-top md:max-h-[520px]"
        />
        <div className="flex flex-col justify-center p-8 md:p-14">
          <p className="m-0 mb-3 text-[14px] font-bold tracking-[0.12em] uppercase">
            {translate("about.characters.eyebrow")}
          </p>
          <h2 className="m-0 font-display text-[44px] leading-none font-normal uppercase md:text-[56px]">
            {translate("about.characters.title")}
          </h2>
        </div>
      </div>
    </section>
  );
}

/** El botón lleva a Contacto; sin `contactHref` (Contacto no existe aún) no
 * se pinta. Usa `Link` y no `LocalizedLink` porque la dirección ya trae el
 * idioma y el motivo en la query, que `LocalizedLink` no arma. */
export function WorkTogether({
  contactHref,
}: {
  readonly contactHref: string | undefined;
}): ReactElement {
  const translate = useTranslate();

  return (
    <section className="bg-brand-indigo">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-8 px-6 py-16 md:py-[72px]">
        <div className="min-w-0 flex-1 basis-[480px]">
          <h2 className="m-0 font-display text-[44px] leading-none font-normal uppercase md:text-[56px]">
            {translate("about.together.title")}
          </h2>
          <p className="mt-3.5 mb-0 max-w-[560px] text-[18px] leading-[1.6] text-ink-muted">
            {translate("about.together.text")}
          </p>
        </div>
        {contactHref === undefined ? null : (
          <Link to={contactHref} className={CTA_STYLES}>
            {translate("about.together.cta")}
          </Link>
        )}
      </div>
    </section>
  );
}
