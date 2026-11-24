import type { ReactElement } from "react";

import type { Language } from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";
import type { SiteStat } from "~/lib/site-stats.server";

interface StatsStripProps {
  readonly stats: readonly SiteStat[];
  /** Idioma de la página: un texto que cayó al español lleva su `lang`. */
  readonly pageLanguage: Language;
  /** Nombre accesible de la franja; sin él, el de la home. */
  readonly label?: string;
}

function langFor(
  textLanguage: Language,
  pageLanguage: Language,
): Language | undefined {
  return textLanguage === pageLanguage ? undefined : textLanguage;
}

/** La franja de cifras. Sin ninguna cifra, no se pinta. */
export function StatsStrip({
  stats,
  pageLanguage,
  label,
}: StatsStripProps): ReactElement | null {
  const translate = useTranslate();
  if (stats.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={label ?? translate("home.stats.label")}
      className="border-t-2 border-brand-red bg-brand-indigo"
    >
      <ul className="m-0 mx-auto grid max-w-[1280px] list-none grid-cols-2 gap-x-4 gap-y-8 px-6 py-10 md:py-12 lg:grid-cols-4">
        {stats.map((stat) => (
          <li key={stat.id} className="text-center">
            <p
              lang={langFor(stat.valueLanguage, pageLanguage)}
              className="m-0 font-display text-[40px] leading-none uppercase md:text-[56px]"
            >
              {stat.value}
            </p>
            <p
              lang={langFor(stat.labelLanguage, pageLanguage)}
              className="mt-2 mb-0 text-[12px] font-bold tracking-[0.08em] text-ink-muted uppercase"
            >
              {stat.label}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
