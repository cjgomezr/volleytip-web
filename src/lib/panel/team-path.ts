import { SUPPORTED_LANGUAGES } from "../i18n/languages";
import { findPageAtPath } from "../i18n/page-path";
import { PANEL_PAGES, type PanelPageId } from "../i18n/panel-pages";

const TEAM_PAGES: readonly PanelPageId[] = [
  "adminTeam",
  "adminTeamInvite",
  "adminTeamRole",
  "adminTeamDeactivate",
  "adminTeamActivate",
];

/** Dice si la dirección es del equipo del panel, en cualquier idioma. */
export function isTeamPath(pathname: string): boolean {
  const match = findPageAtPath(pathname, PANEL_PAGES, SUPPORTED_LANGUAGES);
  return (
    match !== undefined && TEAM_PAGES.includes(match.page.id as PanelPageId)
  );
}
