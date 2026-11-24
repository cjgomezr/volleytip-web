import type { ReactElement } from "react";

import { WaitlistForm } from "~/components/waitlist-form";
import type { AppAvailability } from "~/lib/app-availability.server";
import type { FormProtectionFields } from "~/lib/forms/protected-form.server";
import type { WaitlistOutcome } from "~/lib/forms/waitlist-form.server";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";

interface Feature {
  readonly id: string;
  readonly titleKey: MessageKey;
  readonly textKey: MessageKey;
  /** Las dos que no salen en la primera versión de la app. */
  readonly isSoon: boolean;
}

// El orden y la numeración del mockup: el número es la posición en la lista.
const FEATURES: readonly Feature[] = [
  {
    id: "library",
    titleKey: "app.features.library.title",
    textKey: "app.features.library.text",
    isSoon: false,
  },
  {
    id: "routine",
    titleKey: "app.features.routine.title",
    textKey: "app.features.routine.text",
    isSoon: false,
  },
  {
    id: "share",
    titleKey: "app.features.share.title",
    textKey: "app.features.share.text",
    isSoon: false,
  },
  {
    id: "auto",
    titleKey: "app.features.auto.title",
    textKey: "app.features.auto.text",
    isSoon: false,
  },
  {
    id: "timers",
    titleKey: "app.features.timers.title",
    textKey: "app.features.timers.text",
    isSoon: false,
  },
  {
    id: "scoreboard",
    titleKey: "app.features.scoreboard.title",
    textKey: "app.features.scoreboard.text",
    isSoon: false,
  },
  {
    id: "programs",
    titleKey: "app.features.programs.title",
    textKey: "app.features.programs.text",
    isSoon: true,
  },
  {
    id: "fixtures",
    titleKey: "app.features.fixtures.title",
    textKey: "app.features.fixtures.text",
    isSoon: true,
  },
];

const FAQ: readonly {
  readonly id: string;
  readonly questionKey: MessageKey;
  readonly answerKey: MessageKey;
}[] = [
  {
    id: "when",
    questionKey: "app.faq.when.question",
    answerKey: "app.faq.when.answer",
  },
  {
    id: "free",
    questionKey: "app.faq.free.question",
    answerKey: "app.faq.free.answer",
  },
  {
    id: "devices",
    questionKey: "app.faq.devices.question",
    answerKey: "app.faq.devices.answer",
  },
  {
    id: "privacy",
    questionKey: "app.faq.privacy.question",
    answerKey: "app.faq.privacy.answer",
  },
];

const DISPLAY_HEADING_STYLES = "font-display leading-[1] uppercase";
const MAX_CONTENT_STYLES = "mx-auto max-w-[1280px] px-6";
const STORE_BUTTON_STYLES =
  "inline-flex min-h-[60px] items-center gap-3 rounded-[14px] bg-brand-mist px-5 py-3 text-brand-night no-underline transition-colors hovered:bg-brand-lime focused:outline-brand-lime motion-reduce:transition-none";

const APPLE_LOGO_PATH =
  "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";
const PLAY_LOGO_PATH =
  "M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z";

function StoreButton({
  href,
  logoPath,
  captionKey,
  nameKey,
  labelKey,
}: {
  readonly href: string;
  readonly logoPath: string;
  readonly captionKey: MessageKey;
  readonly nameKey: MessageKey;
  readonly labelKey: MessageKey;
}): ReactElement {
  const translate = useTranslate();
  return (
    <a
      href={href}
      aria-label={translate(labelKey)}
      className={STORE_BUTTON_STYLES}
    >
      <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24">
        <path fill="currentColor" d={logoPath} />
      </svg>
      <span>
        <span className="block text-[12px]">{translate(captionKey)}</span>
        <span className="block text-[18px] font-bold">
          {translate(nameKey)}
        </span>
      </span>
    </a>
  );
}

export function StoreButtons({
  appStoreUrl,
  playStoreUrl,
}: {
  readonly appStoreUrl: string | null;
  readonly playStoreUrl: string | null;
}): ReactElement {
  const translate = useTranslate();
  return (
    <div
      role="group"
      aria-label={translate("app.stores.label")}
      className="mt-8 flex flex-wrap items-center gap-4"
    >
      {appStoreUrl === null ? null : (
        <StoreButton
          href={appStoreUrl}
          logoPath={APPLE_LOGO_PATH}
          captionKey="app.stores.appStore.caption"
          nameKey="app.stores.appStore.name"
          labelKey="app.stores.appStore.label"
        />
      )}
      {playStoreUrl === null ? null : (
        <StoreButton
          href={playStoreUrl}
          logoPath={PLAY_LOGO_PATH}
          captionKey="app.stores.playStore.caption"
          nameKey="app.stores.playStore.name"
          labelKey="app.stores.playStore.label"
        />
      )}
    </div>
  );
}

function PhoneExercise({
  nameKey,
  setsKey,
}: {
  readonly nameKey: MessageKey;
  readonly setsKey: MessageKey;
}): ReactElement {
  const translate = useTranslate();
  return (
    <div className="flex justify-between gap-2 rounded-control bg-brand-indigo p-3 text-[13px]">
      <span>{translate(nameKey)}</span>
      <span className="shrink-0 text-ink-muted">{translate(setsKey)}</span>
    </div>
  );
}

// Ilustración armada con HTML y CSS: no es una captura de la app. Se oculta a
// los lectores de pantalla y en celular, donde no cabe junto al texto.
function PhoneIllustration(): ReactElement {
  const translate = useTranslate();
  return (
    <div
      aria-hidden="true"
      className="hidden w-[240px] shrink-0 flex-col gap-3 rounded-[38px] border-[6px] border-brand-indigo bg-brand-night px-[18px] py-6 lg:flex lg:h-[490px]"
    >
      <p className="text-[11px] font-bold tracking-[0.1em] text-ink-muted uppercase">
        {translate("app.phone.eyebrow")}
      </p>
      <p className="font-display text-[28px] leading-[1] text-white uppercase">
        {translate("app.phone.title")}
      </p>
      <p className="text-[12px] text-ink-muted">
        {translate("app.phone.summary")}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <PhoneExercise
          nameKey="app.phone.exerciseOne"
          setsKey="app.phone.exerciseOneSets"
        />
        <PhoneExercise
          nameKey="app.phone.exerciseTwo"
          setsKey="app.phone.exerciseTwoSets"
        />
        <PhoneExercise
          nameKey="app.phone.exerciseThree"
          setsKey="app.phone.exerciseThreeSets"
        />
        <p className="rounded-control border-2 border-dashed border-brand-indigo p-2.5 text-center text-[13px] text-ink-muted">
          {translate("app.phone.add")}
        </p>
      </div>
      <div className="mt-auto flex gap-2">
        <span className="flex-1 rounded-pill bg-brand-red p-3 text-center text-[14px] font-bold text-brand-night">
          {translate("app.phone.start")}
        </span>
        <span className="rounded-pill border-2 border-brand-mist px-3.5 py-2.5 text-[14px] font-bold">
          {translate("app.phone.share")}
        </span>
      </div>
    </div>
  );
}

function Hero({
  availability,
  protection,
  outcome,
}: AppPageProps): ReactElement {
  const translate = useTranslate();
  return (
    <section data-zone="dark" className="pt-10 pb-20">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-14 px-6">
        <div className="min-w-0 flex-[999_1_520px]">
          {availability.state === "waitlist" ? (
            <p className="inline-block rounded-md bg-brand-lime px-3 py-1.5 text-[13px] font-bold tracking-[0.08em] text-brand-night uppercase">
              {translate("app.badge")}
            </p>
          ) : null}
          <h1
            className={`mt-5 text-[56px] md:text-[88px] lg:text-[112px] font-display uppercase leading-[0.92] break-words`}
          >
            {translate("app.headingStart")}{" "}
            <span className="text-brand-red">
              {translate("app.headingHighlight")}
            </span>
          </h1>
          <p className="mt-6 max-w-[520px] text-[18px] leading-[1.5] text-ink-muted md:text-[20px]">
            {translate("app.intro")}
          </p>
          {availability.state === "waitlist" ? (
            <WaitlistForm protection={protection} outcome={outcome} />
          ) : (
            <StoreButtons
              appStoreUrl={availability.appStoreUrl}
              playStoreUrl={availability.playStoreUrl}
            />
          )}
        </div>
        <PhoneIllustration />
      </div>
    </section>
  );
}

function FeatureCards(): ReactElement {
  const translate = useTranslate();
  return (
    <section data-zone="dark" className="bg-brand-indigo">
      <div className={`${MAX_CONTENT_STYLES} py-16 md:py-24`}>
        <h2
          className={`mb-10 text-[44px] md:text-[64px] ${DISPLAY_HEADING_STYLES}`}
        >
          {translate("app.features.title")}
        </h2>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5">
          {FEATURES.map(({ id, titleKey, textKey, isSoon }, index) => (
            <li
              key={id}
              className="flex flex-col gap-3 rounded-panel bg-brand-night p-7"
            >
              <div className="flex items-center justify-between">
                <span
                  aria-hidden="true"
                  className="font-display text-[40px] leading-[1] text-brand-red"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {isSoon ? (
                  <span className="rounded-md border border-ink-muted px-2 py-1 text-[12px] font-bold tracking-[0.06em] text-ink-muted uppercase">
                    {translate("app.features.soon")}
                  </span>
                ) : null}
              </div>
              <h3 className="text-[22px] font-bold text-white">
                {translate(titleKey)}
              </h3>
              <p className="leading-[1.6] text-ink-muted">
                {translate(textKey)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AccountAndFree(): ReactElement {
  const translate = useTranslate();
  return (
    <section
      data-zone="dark"
      className={`${MAX_CONTENT_STYLES} py-16 md:py-24`}
    >
      <div className="flex flex-wrap items-center gap-12">
        <div className="min-w-0 flex-[1_1_420px]">
          <h2
            className={`text-[44px] md:text-[56px] ${DISPLAY_HEADING_STYLES}`}
          >
            {translate("app.account.title")}
          </h2>
          <p className="mt-4 text-[18px] leading-[1.6] text-ink-muted">
            {translate("app.account.text")}
          </p>
        </div>
        <div className="min-w-0 flex-[1_1_420px] rounded-panel bg-brand-red p-8 text-brand-night">
          <p className="font-display text-[44px] leading-[1] uppercase md:text-[56px]">
            {translate("app.free.title")}
          </p>
          <p className="mt-3 text-[18px] leading-[1.5] font-semibold">
            {translate("app.free.text")}
          </p>
        </div>
      </div>
    </section>
  );
}

function Faq(): ReactElement {
  const translate = useTranslate();
  return (
    <section data-zone="dark" className={`${MAX_CONTENT_STYLES} pb-24`}>
      <h2
        className={`mb-6 text-[40px] md:text-[48px] ${DISPLAY_HEADING_STYLES}`}
      >
        {translate("app.faq.title")}
      </h2>
      <div className="border-t-2 border-brand-indigo">
        {FAQ.map(({ id, questionKey, answerKey }) => (
          <details key={id} className="border-b border-brand-indigo py-4">
            <summary className="min-h-11 cursor-pointer text-[18px] font-bold text-brand-mist">
              {translate(questionKey)}
            </summary>
            <p className="mt-2.5 text-ink-muted">{translate(answerKey)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export interface AppPageProps {
  readonly availability: AppAvailability;
  readonly protection: FormProtectionFields;
  readonly outcome: WaitlistOutcome | undefined;
}

/** El cuerpo de la página de la app. Lo usan la ruta y su versión de /dev/. */
export function AppPage(props: AppPageProps): ReactElement {
  return (
    <>
      <Hero {...props} />
      <FeatureCards />
      <AccountAndFree />
      <Faq />
    </>
  );
}
