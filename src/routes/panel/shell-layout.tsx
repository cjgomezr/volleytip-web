import type { ReactElement, ReactNode } from "react";
import {
  isRouteErrorResponse,
  Outlet,
  useLocation,
  useParams,
  useRouteError,
  useRouteLoaderData,
} from "react-router";

import { FaqNotFound } from "~/components/panel/faqs/faq-not-found";
import { MessageErrorBoundary } from "~/components/panel/messages/message-error";
import { PanelFailure } from "~/components/panel/panel-failure";
import { PanelShell } from "~/components/panel/panel-shell";
import { RootError } from "~/components/root-error";
import { TeamNotFound } from "~/components/panel/team/team-not-found";
import { ADMIN_MODULES } from "~/lib/admin/modules";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useLanguage } from "~/lib/i18n/use-language";
import { isFaqPath } from "~/lib/panel/faq-path";
import { findPanelNotFound } from "~/lib/panel/panel-not-found";
import { isTeamPath } from "~/lib/panel/team-path";

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

// El 404 de un mensaje, de una pregunta o de un miembro que no existe. El del
// panel (quien dejó de ser del equipo) trae sus propios datos.
function isMissingRecord(error: unknown): boolean {
  return (
    isRouteErrorResponse(error) &&
    error.status === NOT_FOUND_STATUS &&
    findPanelNotFound(error) === undefined
  );
}

interface FailureScreenProps {
  readonly error: unknown;
  readonly isMessageRoute: boolean;
  readonly isTeamScreen: boolean;
  /** El 404 de un registro que no existe, y no el del panel. */
  readonly isOwnMissing: boolean;
}

function FailureScreen({
  error,
  isMessageRoute,
  isTeamScreen,
  isOwnMissing,
}: FailureScreenProps): ReactElement {
  if (isMessageRoute) return <MessageErrorBoundary />;
  // Fuera de los mensajes, un 404 propio es de un miembro o de una pregunta.
  if (isOwnMissing) return isTeamScreen ? <TeamNotFound /> : <FaqNotFound />;
  return <PanelFailure error={error} />;
}

/**
 * Un fallo inesperado de una pantalla se pinta dentro del panel. Una
 * respuesta de ruta (el 404 del panel, la de la guardia) es una decisión de
 * la app y sale como siempre, sin la cáscara. Los errores de un mensaje y la
 * pregunta que no existe tienen su pantalla. Hay un solo límite para todo el
 * panel: un envío hecho con `fetcher` falla en el límite de quien lo envió,
 * y uno propio en la ruta del mensaje o de la pregunta atraparía también las
 * respuestas de la guardia. Por eso mismo las preguntas y el equipo se
 * reconocen por la dirección: sus botones envían desde la lista, que no trae
 * el id.
 */
export function ErrorBoundary(): ReactNode {
  const error = useRouteError();
  const isMessageRoute = useParams().messageId !== undefined;
  const { pathname } = useLocation();
  const isTeamScreen = isTeamPath(pathname);
  const isOwnMissing =
    (isMessageRoute || isFaqPath(pathname) || isTeamScreen) &&
    isMissingRecord(error);
  if (isRouteErrorResponse(error) && !isOwnMissing) {
    return <RootError error={error} />;
  }
  const failure = (
    <FailureScreen
      error={error}
      isMessageRoute={isMessageRoute}
      isTeamScreen={isTeamScreen}
      isOwnMissing={isOwnMissing}
    />
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
