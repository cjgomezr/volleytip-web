import { useEffect, useRef, type ReactElement, type RefObject } from "react";
import { Link } from "react-router";

import type { Language } from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";
import type { Translate } from "~/lib/i18n/translate";
import {
  TIP_FUNDAMENTAL_NAME_KEYS,
  TIP_FUNDAMENTALS,
  TIP_LEVEL_NAME_KEYS,
  TIP_LEVELS,
} from "~/lib/tips";
import { getTipsListPath } from "~/lib/tips-path";
import type { TipsQuery } from "~/lib/tips-query";

import { TRANSITION_STYLES } from "../pressable-styles";

// 44 px de alto: zona de toque mínima.
const OPTION_STYLES = `inline-flex min-h-11 items-center justify-center rounded-pill whitespace-nowrap no-underline pressed:bg-brand-mist pressed:text-brand-night ${TRANSITION_STYLES}`;

interface FilterStyles {
  readonly list: string;
  readonly item: string;
  readonly link: string;
  readonly current: string;
  readonly idle: string;
}

// En celular los fundamentos van en una fila que se desliza hasta el borde de
// la pantalla. El relleno deja sitio al anillo de foco, que la fila recortaría.
const FUNDAMENTAL_STYLES: FilterStyles = {
  list: "relative -mx-4 flex gap-2 overflow-x-auto px-4 py-1.5 md:m-0 md:flex-wrap md:overflow-visible md:p-0",
  item: "shrink-0",
  link: "px-[18px] text-[15px]",
  current: "bg-brand-lime font-bold text-brand-night",
  idle: "bg-brand-indigo font-semibold text-brand-mist hovered:text-brand-lime",
};

const LEVEL_STYLES: FilterStyles = {
  list: "flex rounded-pill bg-brand-indigo p-1",
  item: "flex flex-1 md:flex-none",
  link: "w-full px-2 text-[14px] md:px-4",
  current: "bg-brand-mist font-bold text-brand-night",
  idle: "font-semibold text-brand-mist hovered:text-brand-lime",
};

interface FilterOption {
  readonly id: string;
  readonly label: string;
  /** El nombre para el lector de pantalla, cuando el visible no basta. */
  readonly accessibleName?: string;
  readonly href: string;
  readonly isCurrent: boolean;
}

/** Si la fila se desliza, deja a la vista la opción elegida. */
function useShowCurrentOption(
  currentId: string | undefined,
): RefObject<HTMLUListElement | null> {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !current) return;
    const margin = (list.clientWidth - current.offsetWidth) / 2;
    list.scrollTo({ left: current.offsetLeft - margin });
  }, [currentId]);
  return listRef;
}

// Cada opción es un enlace: funciona sin JavaScript y con teclado.
function FilterGroup({
  label,
  options,
  styles,
}: {
  readonly label: string;
  readonly options: readonly FilterOption[];
  readonly styles: FilterStyles;
}): ReactElement {
  const listRef = useShowCurrentOption(
    options.find(({ isCurrent }) => isCurrent)?.id,
  );
  return (
    <nav aria-label={label} className="min-w-0">
      <ul ref={listRef} className={`m-0 list-none ${styles.list}`}>
        {options.map((option) => (
          <li key={option.id} className={styles.item}>
            <Link
              to={option.href}
              preventScrollReset
              aria-current={option.isCurrent ? "true" : undefined}
              aria-label={option.accessibleName}
              className={`${OPTION_STYLES} ${styles.link} ${option.isCurrent ? styles.current : styles.idle}`}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface FilterContext {
  readonly query: TipsQuery;
  readonly language: Language;
  readonly translate: Translate;
}

// Elegir un filtro conserva el otro y la búsqueda, y vuelve a la primera
// página.
function hrefWith(
  { query, language }: FilterContext,
  change: Partial<TipsQuery>,
): string {
  return getTipsListPath(language, { ...query, ...change, page: 1 });
}

function buildFundamentalOptions(context: FilterContext): FilterOption[] {
  const { query, translate } = context;
  const all: FilterOption = {
    id: "all",
    label: translate("tips.filters.all"),
    accessibleName: translate("tips.filters.allFundamentals"),
    href: hrefWith(context, { fundamental: undefined }),
    isCurrent: query.fundamental === undefined,
  };
  return [
    all,
    ...TIP_FUNDAMENTALS.map((fundamental) => ({
      id: fundamental,
      label: translate(TIP_FUNDAMENTAL_NAME_KEYS[fundamental]),
      href: hrefWith(context, { fundamental }),
      isCurrent: query.fundamental === fundamental,
    })),
  ];
}

function buildLevelOptions(context: FilterContext): FilterOption[] {
  const { query, translate } = context;
  const all: FilterOption = {
    id: "all",
    label: translate("tips.filters.all"),
    accessibleName: translate("tips.filters.allLevels"),
    href: hrefWith(context, { level: undefined }),
    isCurrent: query.level === undefined,
  };
  return [
    all,
    ...TIP_LEVELS.map((level) => ({
      id: level,
      label: translate(TIP_LEVEL_NAME_KEYS[level]),
      href: hrefWith(context, { level }),
      isCurrent: query.level === level,
    })),
  ];
}

/** Los filtros de fundamento y de nivel. */
export function TipsFilters({
  query,
  language,
}: {
  readonly query: TipsQuery;
  readonly language: Language;
}): ReactElement {
  const translate = useTranslate();
  const context: FilterContext = { query, language, translate };
  return (
    <section
      aria-label={translate("tips.filters.label")}
      data-tips-filters
      className="border-b border-brand-indigo bg-brand-night xl:sticky xl:top-0 xl:z-10"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-4 md:px-6 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4">
        <FilterGroup
          label={translate("tips.filters.fundamental")}
          options={buildFundamentalOptions(context)}
          styles={FUNDAMENTAL_STYLES}
        />
        <FilterGroup
          label={translate("tips.filters.level")}
          options={buildLevelOptions(context)}
          styles={LEVEL_STYLES}
        />
      </div>
    </section>
  );
}
