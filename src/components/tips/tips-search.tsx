import { useEffect, useId, useRef, type ReactElement } from "react";
import { Form } from "react-router";

import type { Language } from "~/lib/i18n/languages";
import { getPagePath } from "~/lib/i18n/pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import {
  buildTipsSearch,
  MAX_TIP_QUERY_LENGTH,
  TIPS_PARAMETERS,
  type TipsQuery,
} from "~/lib/tips-query";

import { TRANSITION_STYLES } from "../pressable-styles";

interface TipsSearchProps {
  readonly query: TipsQuery;
  readonly language: Language;
}

function SearchIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <circle cx={11} cy={11} r={7} />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

// Los filtros puestos viajan con la búsqueda. La página no: una búsqueda nueva
// empieza por la primera.
function KeptFilters({ query, language }: TipsSearchProps): ReactElement {
  const kept = new URLSearchParams(
    buildTipsSearch({ ...query, query: "", page: 1 }, language),
  );
  return (
    <>
      {[...kept].map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/** La búsqueda del listado: un formulario `get`, que sirve sin JavaScript. */
export function TipsSearch({ query, language }: TipsSearchProps): ReactElement {
  const translate = useTranslate();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // El campo no está controlado. Si la dirección cambia por otro lado (quitar
  // los filtros, volver atrás), toma lo que ella diga sin perder el foco.
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = query.query;
  }, [query.query]);

  return (
    <Form
      method="get"
      action={getPagePath("tips", language)}
      preventScrollReset
      role="search"
      className="w-full md:w-[380px] md:shrink-0"
    >
      <KeptFilters query={query} language={language} />
      <label
        htmlFor={id}
        className="mb-2 block text-[13px] font-bold tracking-[0.1em] text-ink-muted uppercase"
      >
        {translate("tips.search.label")}
      </label>
      <div
        className={`flex h-[52px] items-center gap-1 rounded-pill bg-brand-indigo pr-4 pl-1 hovered:inset-ring-2 hovered:inset-ring-brand-lime has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-brand-lime ${TRANSITION_STYLES}`}
      >
        <button
          type="submit"
          aria-label={translate("tips.search.submit")}
          className={`inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent p-0 text-ink-muted hovered:text-brand-lime pressed:bg-brand-mist pressed:text-brand-night ${TRANSITION_STYLES}`}
        >
          <SearchIcon />
        </button>
        {/* El anillo de foco lo pinta la píldora que envuelve el campo. */}
        <input
          ref={inputRef}
          id={id}
          type="search"
          name={TIPS_PARAMETERS[language].query}
          defaultValue={query.query}
          maxLength={MAX_TIP_QUERY_LENGTH}
          placeholder={translate("tips.search.placeholder")}
          className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] text-brand-mist outline-none placeholder:text-ink-muted"
        />
      </div>
    </Form>
  );
}
