import type { ReactElement, ReactNode } from "react";

import { useTranslate } from "~/lib/i18n/translations-context";

const WORDMARK_WIDTH = 312;
const WORDMARK_HEIGHT = 59;

// La mitad oscura del mockup. En celular es una franja sobre el formulario.
function SignInHero(): ReactElement {
  const translate = useTranslate();
  return (
    <div
      data-zone="dark"
      className="flex flex-col gap-6 bg-brand-night px-4 py-8 text-brand-mist md:justify-between md:p-12"
    >
      <img
        src="/brand/wordmark.png"
        alt={translate("panel.brand")}
        width={WORDMARK_WIDTH}
        height={WORDMARK_HEIGHT}
        className="h-[30px] w-auto self-start"
      />
      <p className="font-display text-[48px] leading-[0.95] uppercase md:text-[64px] lg:text-[96px]">
        <span className="block">{translate("panel.signIn.hero.first")}</span>
        <span className="block text-brand-red">
          {translate("panel.signIn.hero.second")}
        </span>
      </p>
      <p className="text-[15px] leading-[1.5] text-ink-muted md:text-[16px]">
        {translate("panel.signIn.aside")}
      </p>
    </div>
  );
}

/** La entrada del panel y la página de su enlace: la marca a un lado y lo que
 * hay que hacer al otro. */
export function SignInLayout({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: ReactNode;
}): ReactElement {
  const translate = useTranslate();
  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] md:grid-cols-2 md:grid-rows-1">
      <title>{translate("panel.signIn.title")}</title>
      <SignInHero />
      <div
        data-zone="light"
        className="flex flex-col items-center bg-line-light px-4 py-10 text-brand-night [color-scheme:light] md:justify-center md:p-12"
      >
        <div className="w-full max-w-[400px]">
          <h1 className="font-display text-[44px] leading-[0.95] uppercase md:text-[48px]">
            {heading}
          </h1>
          {children}
        </div>
      </div>
    </main>
  );
}
