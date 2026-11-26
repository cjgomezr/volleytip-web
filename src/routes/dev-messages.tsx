import type { ReactElement } from "react";
import { data } from "react-router";

import { InboxScreen } from "~/components/panel/messages/inbox-screen";
import { MessageScreen } from "~/components/panel/messages/message-screen";
import { PanelShell } from "~/components/panel/panel-shell";
import { ADMIN_MODULES, type AdminModule } from "~/lib/admin/modules";
import {
  buildSampleMessages,
  SAMPLE_MESSAGES_STATES,
  type SampleMessages,
} from "~/lib/admin/sample-messages";
import { serverEnv } from "~/lib/env.server";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useLanguage } from "~/lib/i18n/use-language";

import type { Route } from "./+types/dev-messages";

// Pinta la bandeja y el detalle de un mensaje en cada estado, sin sesión ni
// base, para capturarlos en Playwright:
// `?estado=lista|vacia|sin-resultados|detalle-pedido|detalle-marcas`. Solo
// pinta: no recibe envíos. En producción responde 404.
const NOT_FOUND_STATUS = 404;
const STATE_PARAM = "estado";

export function loader({ request }: Route.LoaderArgs): SampleMessages {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const url = new URL(request.url);
  const asked = url.searchParams.get(STATE_PARAM) ?? "lista";
  const state = SAMPLE_MESSAGES_STATES.find((candidate) => candidate === asked);
  if (state === undefined) throw data(null, { status: NOT_FOUND_STATUS });
  return buildSampleMessages(
    state,
    getRequestLanguage(request),
    `${url.pathname}?${STATE_PARAM}=detalle-pedido`,
  );
}

// El menú real, con "Mensajes" apuntando aquí para que salga marcado.
const SAMPLE_MENU: readonly AdminModule[] = ADMIN_MODULES.map((module) =>
  module.id === "messages"
    ? {
        ...module,
        page: {
          id: "sample-inbox",
          file: "routes/dev-messages.tsx",
          path: "dev/mensajes",
        },
      }
    : module,
);

export default function DevMessages({
  loaderData,
}: Route.ComponentProps): ReactElement {
  const language = useLanguage();
  return (
    <PanelShell
      modules={SAMPLE_MENU}
      member={{ displayName: "Andrés Gómez", role: "admin" }}
      pendingCounts={{ messages: 3 }}
      isMaintenanceOn={false}
      morePath={getPanelPath("adminMore", language)}
      languageAction={getPanelPath("adminLanguage", language)}
    >
      {loaderData.screen === "inbox" ? (
        <InboxScreen {...loaderData.view} />
      ) : (
        <MessageScreen {...loaderData.view} />
      )}
    </PanelShell>
  );
}

export function meta(): Route.MetaDescriptors {
  return [{ name: "robots", content: "noindex" }];
}
