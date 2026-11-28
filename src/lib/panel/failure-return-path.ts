import { NOTICE_PARAM } from "../admin/messages";
import { SAVED_PARAM } from "../admin/settings-view";
import {
  getPanelPath,
  PANEL_PAGES,
  type PanelPageId,
} from "../i18n/panel-pages";
import { findPageAtPath } from "../i18n/page-path";
import { SUPPORTED_LANGUAGES, type Language } from "../i18n/languages";

// Las direcciones que solo reciben un envío, con la pantalla desde donde se
// envía. Las demás son su propia pantalla.
const SCREEN_OF_SUBMISSION: Partial<Record<PanelPageId, PanelPageId>> = {
  adminSiteTextsAnnouncements: "adminSiteTexts",
  adminSiteTextsStats: "adminSiteTexts",
  adminMarketsLanguage: "adminMarkets",
  adminMarketsMarket: "adminMarkets",
  adminMarketsRate: "adminMarkets",
  adminSettingsMaintenance: "adminSettings",
  adminFaqPublish: "adminFaqs",
  adminFaqRetire: "adminFaqs",
  adminFaqMove: "adminFaqs",
  // El idioma se cambia y la sesión se cierra desde cualquier pantalla.
  adminLanguage: "adminHome",
  adminSignOut: "adminHome",
};

// Anuncian cómo salió el envío anterior: al volver de un fallo dirían que se
// guardó.
const ONE_TIME_PARAMS = [SAVED_PARAM, NOTICE_PARAM];

function keepScreenSearch(search: string): string {
  const params = new URLSearchParams(search);
  for (const name of ONE_TIME_PARAMS) params.delete(name);
  const kept = params.toString();
  return kept === "" ? "" : `?${kept}`;
}

/** La pantalla donde estaba la persona cuando algo falló en `pathname`. */
export function getFailureReturnPath({
  pathname,
  search,
}: {
  readonly pathname: string;
  readonly search: string;
}): string {
  const match = findPageAtPath(pathname, PANEL_PAGES, SUPPORTED_LANGUAGES);
  const screen = match && SCREEN_OF_SUBMISSION[match.page.id as PanelPageId];
  if (match === undefined || screen === undefined) {
    return `${pathname.replace(/\/+$/, "")}${keepScreenSearch(search)}`;
  }
  return getPanelPath(screen, match.language as Language);
}
