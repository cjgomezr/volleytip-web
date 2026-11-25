import type { ReactElement, ReactNode } from "react";
import { useLocation } from "react-router";

import type { AdminModule } from "~/lib/admin/modules";
import {
  buildPanelNavigation,
  type PendingCounts,
} from "~/lib/admin/navigation";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { PanelBottomBar } from "./panel-bottom-bar";
import { PanelBrand } from "./panel-brand";
import { PanelLanguageSwitcher } from "./panel-language-switcher";
import { PanelNavigationContext } from "./panel-navigation-context";
import { PanelSidebar } from "./panel-sidebar";
import { PanelUser, type PanelUserData } from "./panel-user";

export interface PanelShellProps {
  readonly modules: readonly AdminModule[];
  readonly member: PanelUserData;
  readonly pendingCounts: PendingCounts;
  readonly isMaintenanceOn: boolean;
  /** La pantalla "Más" en el idioma de la página. */
  readonly morePath: string;
  /** A dónde envía el selector de idioma. */
  readonly languageAction: string;
  readonly children: ReactNode;
}

function MaintenanceStripe(): ReactElement {
  const translate = useTranslate();
  return (
    <p
      data-panel-region="maintenance"
      className="m-0 flex items-start justify-center gap-2 bg-brand-red px-4 py-2.5 text-[14px] leading-[1.4] font-bold text-brand-night"
    >
      <span aria-hidden="true">⚠</span>
      <span>{translate("panel.maintenance")}</span>
    </p>
  );
}

/** El encabezado del celular: ahí no hay menú lateral. */
function PanelTopBar({
  member,
  languageAction,
}: {
  readonly member: PanelUserData;
  readonly languageAction: string;
}): ReactElement {
  return (
    <header className="flex flex-col gap-3 bg-brand-night px-4 py-3.5 text-brand-mist md:hidden">
      <div className="flex items-center justify-between gap-3">
        <PanelBrand />
        <PanelLanguageSwitcher action={languageAction} />
      </div>
      <PanelUser {...member} />
    </header>
  );
}

/**
 * La cáscara de todas las pantallas del panel: menú lateral desde 768 px,
 * encabezado y barra inferior en celular (FR-066). El menú sale de `modules`.
 */
export function PanelShell({
  modules,
  member,
  pendingCounts,
  isMaintenanceOn,
  morePath,
  languageAction,
  children,
}: PanelShellProps): ReactElement {
  const language = useLanguage();
  const { pathname } = useLocation();
  const navigation = buildPanelNavigation(modules, {
    role: member.role,
    language,
    pathname,
    pendingCounts,
    morePath,
  });
  return (
    <PanelNavigationContext value={navigation}>
      <div
        data-zone="light"
        data-panel-shell
        className="flex min-h-screen flex-col bg-line-light text-brand-night [color-scheme:light]"
      >
        <div className="flex flex-1 flex-col md:flex-row">
          <PanelSidebar member={member} languageAction={languageAction} />
          {/* La franja va en la columna del contenido: encima de todo empujaría
              el pie del menú lateral fuera de la pantalla. */}
          <div className="flex min-w-0 flex-1 flex-col">
            {isMaintenanceOn ? <MaintenanceStripe /> : null}
            <PanelTopBar member={member} languageAction={languageAction} />
            <main className="flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
          </div>
        </div>
        <PanelBottomBar morePath={morePath} />
      </div>
    </PanelNavigationContext>
  );
}
