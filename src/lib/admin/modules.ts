import type { PageDeclaration } from "../i18n/page-path";
import { findPanelPage } from "../i18n/panel-pages";
import type { MessageKey } from "../i18n/translate";
import type { PanelMember } from "../panel/visitor.server";

export type PanelRole = PanelMember["role"];

/** Una sección del panel (FR-079). El menú lateral, la barra inferior y "Más"
 * se pintan de la lista de módulos: agregar una sección es agregar uno. */
export interface AdminModule {
  readonly id: string;
  /** La página a la que lleva. Es la misma declaración que usa su ruta. */
  readonly page: PageDeclaration;
  readonly labelKey: MessageKey;
  /** `admin` solo la ve un admin; `staff`, todo el equipo. */
  readonly requiredRole: PanelRole;
  /** Presente cuando pide un lugar en la barra inferior del celular, con el
   * signo que se pinta sobre su nombre. Los demás van en "Más". */
  readonly bottomBar?: { readonly glyph: string };
  /** Su entrada muestra cuántos pendientes tiene, si hay alguno. */
  readonly hasPendingCounter?: boolean;
}

/** La lista de módulos, en el orden del menú. Falla si dos comparten id. */
export function defineModules(
  modules: readonly AdminModule[],
): readonly AdminModule[] {
  const seen = new Set<string>();
  for (const { id } of modules) {
    if (seen.has(id)) {
      throw new Error(`Dos módulos del panel comparten el id "${id}".`);
    }
    seen.add(id);
  }
  return modules;
}

export const ADMIN_MODULES = defineModules([
  {
    id: "overview",
    page: findPanelPage("adminHome"),
    labelKey: "panel.module.overview",
    requiredRole: "admin",
    bottomBar: { glyph: "⌂" },
  },
]);
