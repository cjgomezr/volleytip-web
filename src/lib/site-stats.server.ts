import type { Language } from "./i18n/languages";
import {
  MissingSiteTextError,
  readSiteTexts,
  type SiteText,
} from "./site-texts.server";
import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

/** Las cifras de la franja de la home y de la página Nosotros, en el orden
 * en que se pintan. Cada una vive en `site_texts` como `stats.<id>.value` y
 * `stats.<id>.label`. */
export const SITE_STAT_IDS = [
  "instagram",
  "tiktok",
  "views",
  "region",
] as const;

export type SiteStatId = (typeof SITE_STAT_IDS)[number];

export interface SiteStat {
  readonly id: SiteStatId;
  readonly value: string;
  /** Idioma del que salió el valor: el pedido o el español de respaldo. */
  readonly valueLanguage: Language;
  readonly label: string;
  readonly labelLanguage: Language;
}

async function readSiteStat(
  id: SiteStatId,
  language: Language,
  client: TypedSupabaseClient,
): Promise<SiteStat | undefined> {
  const valueKey = `stats.${id}.value`;
  const labelKey = `stats.${id}.label`;
  let texts: Readonly<Record<string, SiteText>>;
  try {
    texts = await readSiteTexts([valueKey, labelKey], language, client);
  } catch (error) {
    // Una cifra sin valor o sin leyenda no se pinta; la página sigue.
    if (error instanceof MissingSiteTextError) {
      return undefined;
    }
    throw error;
  }
  const { [valueKey]: value, [labelKey]: label } = texts;
  if (value === undefined || label === undefined) {
    return undefined;
  }
  return {
    id,
    value: value.text,
    valueLanguage: value.language,
    label: label.text,
    labelLanguage: label.language,
  };
}

/**
 * Lee las cifras del sitio en el idioma pedido. Una cifra a la que le falta
 * el valor o la leyenda en todos los idiomas se omite; sin ninguna, la lista
 * sale vacía. Si la base falla, lanza: quien llama decide si la página sigue.
 */
export async function readSiteStats(
  language: Language,
  client: TypedSupabaseClient = createAnonSupabaseClient(),
): Promise<readonly SiteStat[]> {
  const stats = await Promise.all(
    SITE_STAT_IDS.map((id) => readSiteStat(id, language, client)),
  );
  return stats.filter((stat): stat is SiteStat => stat !== undefined);
}
