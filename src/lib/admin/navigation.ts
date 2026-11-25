import type { Language } from "../i18n/languages";
import { buildPagePath } from "../i18n/page-path";
import { findLanguage } from "../i18n/pages";
import type { MessageKey } from "../i18n/translate";
import type { AdminModule, PanelRole } from "./modules";

/** Los lugares de la barra inferior para módulos: FR-066 fija cinco y el
 * último es "Más". */
const BOTTOM_BAR_MODULE_SLOTS = 4;
const TRAILING_SLASHES = /\/+$/;

/** Cuántos pendientes tiene cada módulo, por su id. */
export type PendingCounts = Readonly<Record<string, number>>;

export interface NavigationEntry {
  readonly id: string;
  readonly labelKey: MessageKey;
  readonly href: string;
  readonly isCurrent: boolean;
  /** Solo cuando el módulo declara contador y hay algo pendiente. */
  readonly pendingCount?: number;
}

export interface BottomBarEntry extends NavigationEntry {
  readonly glyph: string;
}

export interface PanelNavigation {
  readonly sidebar: readonly NavigationEntry[];
  readonly bar: readonly BottomBarEntry[];
  /** Lo que no está en la barra inferior. */
  readonly more: readonly NavigationEntry[];
  /** Si la pantalla que se pinta es "Más": ahí ningún módulo es el actual. */
  readonly isMorePage: boolean;
}

export interface NavigationRequest {
  readonly role: PanelRole;
  readonly language: Language;
  /** La dirección de la pantalla que se pinta. */
  readonly pathname: string;
  readonly pendingCounts: PendingCounts;
  /** La dirección de la pantalla "Más". */
  readonly morePath: string;
}

function canSee(module: AdminModule, role: PanelRole): boolean {
  return role === "admin" || module.requiredRole === "staff";
}

// La dirección más larga que contiene a la actual: `/admin/mensajes/7` es de
// Mensajes, aunque también cuelgue del inicio del panel.
function findCurrentHref(
  hrefs: readonly string[],
  pathname: string,
): string | undefined {
  const path = pathname.replace(TRAILING_SLASHES, "");
  return hrefs
    .filter((href) => path === href || path.startsWith(`${href}/`))
    .sort((first, second) => second.length - first.length)[0];
}

function readPendingCount(
  module: AdminModule,
  pendingCounts: PendingCounts,
): number | undefined {
  if (!module.hasPendingCounter) return undefined;
  return pendingCounts[module.id] || undefined;
}

/** Arma el menú lateral, la barra inferior y "Más" de la lista de módulos,
 * en su orden y sin lo que el rol no puede ver. */
export function buildPanelNavigation(
  modules: readonly AdminModule[],
  { role, language, pathname, pendingCounts, morePath }: NavigationRequest,
): PanelNavigation {
  const visible = modules
    .filter((module) => canSee(module, role))
    .map((module) => ({
      module,
      href: buildPagePath(module.page, findLanguage(language)),
    }));
  const currentHref = findCurrentHref(
    [...visible.map(({ href }) => href), morePath],
    pathname,
  );
  const entries = visible.map(({ module, href }) => ({
    bottomBar: module.bottomBar,
    entry: {
      id: module.id,
      labelKey: module.labelKey,
      href,
      isCurrent: href === currentHref,
      pendingCount: readPendingCount(module, pendingCounts),
    },
  }));
  const bar = entries
    .flatMap(({ entry, bottomBar }) =>
      bottomBar ? [{ ...entry, glyph: bottomBar.glyph }] : [],
    )
    .slice(0, BOTTOM_BAR_MODULE_SLOTS);
  const barIds = new Set(bar.map(({ id }) => id));
  const sidebar = entries.map(({ entry }) => entry);
  return {
    sidebar,
    bar,
    more: sidebar.filter(({ id }) => !barIds.has(id)),
    isMorePage: currentHref === morePath,
  };
}
