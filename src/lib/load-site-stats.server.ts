import type { Language } from "./i18n/languages";
import { giveUpAfter } from "./site-settings.server";
import { readSiteStats, type SiteStat } from "./site-stats.server";

/** Lo máximo que una página espera a la base por las cifras. */
export const SITE_STATS_TIMEOUT_MS = 1500;

/**
 * Las cifras para la home y para Nosotros. Son un adorno: si la base falla o
 * tarda, la página sale sin ellas en vez de caerse o hacerse esperar.
 */
export async function loadSiteStats(
  language: Language,
): Promise<readonly SiteStat[]> {
  try {
    return await giveUpAfter(SITE_STATS_TIMEOUT_MS, readSiteStats(language));
  } catch (error) {
    console.error("No se pudieron leer las cifras del sitio", error);
    return [];
  }
}
