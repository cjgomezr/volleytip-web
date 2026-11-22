import type { ReactElement } from "react";
import { useLocation } from "react-router";

import type { Language } from "~/lib/i18n/languages";

import { Button } from "./button";

export interface LanguageSuggestionTexts {
  readonly label: string;
  readonly message: string;
  readonly accept: string;
  readonly stay: string;
}

interface LanguageSuggestionProps {
  readonly proposed: Language;
  readonly pageLanguage: Language;
  /** Ya vienen en el idioma propuesto: es el que la persona lee. */
  readonly texts: LanguageSuggestionTexts;
}

interface ChoiceFormProps {
  readonly language: Language;
  readonly from: string;
  readonly variant: "primary" | "secondary";
  readonly label: string;
}

// Un formulario por opción: funciona sin JavaScript y cada botón lleva su
// idioma en un campo oculto.
function ChoiceForm({
  language,
  from,
  variant,
  label,
}: ChoiceFormProps): ReactElement {
  return (
    <form method="post" action="/idioma">
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="from" value={from} />
      <Button type="submit" variant={variant}>
        {label}
      </Button>
    </form>
  );
}

/**
 * La franja que propone el idioma del navegador (FR-005). Va en el flujo de la
 * página, arriba, para no tapar nada. Es una región con nombre para que un
 * lector de pantalla la anuncie.
 */
export function LanguageSuggestion({
  proposed,
  pageLanguage,
  texts,
}: LanguageSuggestionProps): ReactElement {
  const { pathname, search } = useLocation();
  const from = `${pathname}${search}`;

  return (
    <section
      aria-label={texts.label}
      lang={proposed}
      className="bg-brand-indigo text-brand-mist"
    >
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <p className="text-[15px] leading-snug font-bold">{texts.message}</p>
        <div className="flex flex-wrap gap-3">
          <ChoiceForm
            language={proposed}
            from={from}
            variant="primary"
            label={texts.accept}
          />
          <ChoiceForm
            language={pageLanguage}
            from={from}
            variant="secondary"
            label={texts.stay}
          />
        </div>
      </div>
    </section>
  );
}
