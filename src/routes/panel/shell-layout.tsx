import type { ReactElement, ReactNode } from "react";
import {
  isRouteErrorResponse,
  Outlet,
  useParams,
  useRouteError,
  useRouteLoaderData,
} from "react-router";

import { MessageErrorBoundary } from "~/components/panel/messages/message-error";
import { PanelFailure } from "~/components/panel/panel-failure";
import { PanelShell } from "~/components/panel/panel-shell";
import { RootError } from "~/components/root-error";
import { ADMIN_MODULES } from "~/lib/admin/modules";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useLanguage } from "~/lib/i18n/use-language";
import { findPanelNotFound } from "~/lib/panel/panel-not-found";

import type { loader as memberLoader } from "./member-layout";

/** La cáscara es de los admin: el staff no la tiene (decisión 11 del PRD de
 * W10a). Sus datos los carga `member-layout.tsx`, que solo responde a quien
 * pasó la guardia. Sin ellos se pinta `bare`. */
function InPanel({
  children,
  bare = children,
}: {
  readonly children: ReactNode;
  readonly bare?: ReactNode;
}): ReactNode {
  const language = useLanguage();
  const panel = useRouteLoaderData<typeof memberLoader>(
    "routes/panel/member-layout",
  );
  if (panel?.view !== "admin") return bare;
  return (
    <PanelShell
      modules={ADMIN_MODULES}
      member={panel.member}
      pendingCounts={panel.pendingCounts}
      isMaintenanceOn={panel.isMaintenanceOn}
      morePath={getPanelPath("adminMore", language)}
      languageAction={getPanelPath("adminLanguage", language)}
    >
      {children}
    </PanelShell>
  );
}

export default function PanelShellLayout(): ReactElement {
  return (
    <InPanel>
      <Outlet />
    </InPanel>
  );
}

const NOT_FOUND_STATUS = 404;

// El 404 de un mensaje que no existe. El del panel (quien dejó de ser del
// equipo) trae sus propios datos.
function isMissingMessage(error: unknown): boolean {
  return (
    isRouteErrorResponse(error) &&
    error.status === NOT_FOUND_STATUS &&
    findPanelNotFound(error) === undefined
  );
}

/**
 * Un fallo inesperado de una pantalla se pinta dentro del panel. Una
 * respuesta de ruta (el 404 del panel, la de la guardia) es una decisión de
 * la app y sale como siempre, sin la cáscara. Los errores de un mensaje
 * tienen su pantalla. Hay un solo límite para todo el panel: un envío hecho
 * con `fetcher` falla en el límite de quien lo envió, y uno propio en la ruta
 * del mensaje atraparía también las respuestas de la guardia.
 */
export function ErrorBoundary(): ReactNode {
  const error = useRouteError();
  const isMessageRoute = useParams().messageId !== undefined;
  const isOwnMissing = isMessageRoute && isMissingMessage(error);
  if (isRouteErrorResponse(error) && !isOwnMissing) {
    return <RootError error={error} />;
  }
  const failure = isMessageRoute ? (
    <MessageErrorBoundary />
  ) : (
    <PanelFailure error={error} />
  );
  return (
    <InPanel
      bare={
        <main
          data-zone="light"
          className="min-h-screen bg-brand-mist px-4 py-12 text-brand-night [color-scheme:light] md:px-8"
        >
          {failure}
        </main>
      }
    >
      {failure}
    </InPanel>
  );
}
