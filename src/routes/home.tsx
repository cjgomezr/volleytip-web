import type { ReactElement } from "react";

import { getRequestLanguage } from "~/lib/i18n/languages";
import { getTranslate } from "~/lib/i18n/messages.server";
import { useTranslate } from "~/lib/i18n/translations-context";

import type { Route } from "./+types/home";

// Página provisional de la cáscara; W3 trae la home real.
const WORDMARK_WIDTH = 312;
const WORDMARK_HEIGHT = 59;

export function loader({ request }: Route.LoaderArgs): {
  readonly title: string;
  readonly description: string;
} {
  const translate = getTranslate(getRequestLanguage(request));
  return {
    title: translate("home.title"),
    description: translate("home.description"),
  };
}

export function meta({
  loaderData,
}: Route.MetaArgs): { title: string }[] | Record<string, string>[] {
  return [
    { title: loaderData.title },
    { name: "description", content: loaderData.description },
  ];
}

export default function Home(): ReactElement {
  const translate = useTranslate();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1280px] items-center px-6 py-5">
        <img
          src="/brand/wordmark.png"
          alt={translate("site.name")}
          width={WORDMARK_WIDTH}
          height={WORDMARK_HEIGHT}
          className="h-[30px] w-auto"
        />
      </header>
      <main className="mx-auto max-w-[1280px] px-6 pt-12 pb-24">
        <p className="text-[12px] font-bold tracking-[0.12em] uppercase">
          {translate("home.eyebrow")}
        </p>
        <h1 className="mt-4 font-display text-[56px] leading-[0.95] uppercase md:text-[72px]">
          {translate("home.headingStart")}{" "}
          <span className="text-brand-red">
            {translate("home.headingHighlight")}
          </span>{" "}
          {translate("home.headingEnd")}
        </h1>
        <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.5] text-ink-muted">
          {translate("home.intro")}
        </p>
        <a
          href="/healthz"
          className="mt-8 inline-flex h-[54px] items-center justify-center rounded-pill bg-brand-red px-8 text-[17px] font-bold text-brand-night no-underline hover:bg-brand-lime active:bg-brand-mist"
        >
          {translate("home.healthLink")}
        </a>
      </main>
    </div>
  );
}
