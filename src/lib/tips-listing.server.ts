import type { Language } from "./i18n/languages";
import type { TipFundamental, TipLevel } from "./tips";
import { hasTipFilters, type TipsQuery } from "./tips-query";
import {
  countPublishedTips,
  listPublishedTips,
  readLatestTip,
  TIPS_PAGE_SIZE,
  type Tip,
} from "./tips.server";

// Lo que la página del listado le entrega al navegador, campo por campo.

export interface TipCardData {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  /** El idioma del que salió el título, para el atributo `lang`. */
  readonly titleLanguage: Language;
  readonly thumbnailUrl: string;
  readonly durationSeconds: number;
  readonly fundamental: TipFundamental;
  readonly level: TipLevel;
}

export interface LatestTipData extends TipCardData {
  readonly achievement: string | null;
  readonly achievementLanguage: Language;
}

export interface TipsListing {
  readonly query: TipsQuery;
  /** Todos los publicados, con o sin filtros. */
  readonly publishedTotal: number;
  /** Los que cumplen los filtros y la búsqueda, en todas las páginas. */
  readonly total: number;
  readonly tips: readonly TipCardData[];
  /** Nulo cuando hay filtros o búsqueda, no hay ninguno publicado o solo se
   * pidieron más tips. */
  readonly latestTip: LatestTipData | null;
  readonly hasNextPage: boolean;
}

function toCard(tip: Tip): TipCardData {
  return {
    id: tip.id,
    slug: tip.slug,
    title: tip.text.title,
    titleLanguage: tip.textLanguages.title,
    thumbnailUrl: tip.thumbnailUrl,
    durationSeconds: tip.durationSeconds,
    fundamental: tip.fundamental,
    level: tip.level,
  };
}

function toLatest(tip: Tip): LatestTipData {
  return {
    ...toCard(tip),
    achievement: tip.text.achievement,
    achievementLanguage: tip.textLanguages.achievement,
  };
}

interface TipsListingOptions {
  /** Falso para quien solo pide más tips: el último video ya está pintado. */
  readonly withLatest?: boolean;
}

/** Una página del listado con lo que la acompaña. Si la base falla, lanza. */
export async function loadTipsListing(
  language: Language,
  query: TipsQuery,
  { withLatest = true }: TipsListingOptions = {},
): Promise<TipsListing> {
  const { page, ...filters } = query;
  const isFiltered = hasTipFilters(query);
  const [found, countedTotal, latest] = await Promise.all([
    listPublishedTips(language, {
      ...filters,
      offset: (page - 1) * TIPS_PAGE_SIZE,
    }),
    isFiltered ? countPublishedTips(language) : null,
    isFiltered || !withLatest ? null : readLatestTip(language),
  ]);
  return {
    query,
    publishedTotal: countedTotal ?? found.total,
    total: found.total,
    tips: found.tips.map(toCard),
    latestTip: latest === null ? null : toLatest(latest),
    hasNextPage: page * TIPS_PAGE_SIZE < found.total,
  };
}
