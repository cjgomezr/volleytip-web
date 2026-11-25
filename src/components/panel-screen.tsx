import type { ReactElement, ReactNode } from "react";

import { useTranslate } from "~/lib/i18n/translations-context";

import { Eyebrow } from "./eyebrow";

/**
 * La pantalla suelta del panel: una tarjeta centrada sobre fondo claro (el
 * admin es zona clara). La usan las pantallas sin la cáscara del panel.
 */
export function PanelScreen({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactElement {
  const translate = useTranslate();
  return (
    <main
      data-zone="light"
      className="flex min-h-screen flex-col justify-center bg-brand-mist px-4 py-12 text-brand-night [color-scheme:light] md:px-6"
    >
      <title>{title}</title>
      <div className="mx-auto w-full max-w-[480px] rounded-card bg-surface-light p-6 md:p-8">
        <Eyebrow text={translate("panel.eyebrow")} />
        <h1 className="mt-4 font-display text-[44px] leading-[0.95] uppercase">
          {title}
        </h1>
        {children}
      </div>
    </main>
  );
}
