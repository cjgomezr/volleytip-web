import type { ReactElement } from "react";
import { data } from "react-router";

import { FaqEditorScreen } from "~/components/panel/faqs/faq-editor-screen";
import { FaqListScreen } from "~/components/panel/faqs/faq-list-screen";
import { PanelShell } from "~/components/panel/panel-shell";
import { ADMIN_MODULES, type AdminModule } from "~/lib/admin/modules";
import {
  buildSampleFaqs,
  SAMPLE_FAQ_STATES,
  type SampleFaqs,
} from "~/lib/admin/sample-faqs";
import { serverEnv } from "~/lib/env.server";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useLanguage } from "~/lib/i18n/use-language";

import type { Route } from "./+types/dev-panel-faqs";

// Pinta la lista y el editor de las preguntas en cada estado, sin sesión ni
// base, para capturarlos en Playwright:
// `?estado=lista|vacia|editor|errores`. Solo pinta: sus formularios apuntan
// al panel de verdad. En producción responde 404.
const NOT_FOUND_STATUS = 404;
const STATE_PARAM = "estado";

export function loader({ request }: Route.LoaderArgs): SampleFaqs {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const asked = new URL(request.url).searchParams.get(STATE_PARAM) ?? "lista";
  const state = SAMPLE_FAQ_STATES.find((candidate) => candidate === asked);
  if (state === undefined) throw data(null, { status: NOT_FOUND_STATUS });
  return buildSampleFaqs(state, getRequestLanguage(request));
}

// El menú real, con "Preguntas frecuentes" apuntando aquí para que salga
// marcado.
const SAMPLE_MENU: readonly AdminModule[] = ADMIN_MODULES.map((module) =>
  module.id === "faqs"
    ? {
        ...module,
        page: {
          id: "sample-faqs",
          file: "routes/dev-panel-faqs.tsx",
          path: "dev/preguntas",
        },
      }
    : module,
);

export default function DevPanelFaqs({
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
      {loaderData.screen === "list" ? (
        <FaqListScreen {...loaderData.view} />
      ) : (
        <FaqEditorScreen
          {...loaderData.view}
          initialOutcome={loaderData.outcome}
        />
      )}
    </PanelShell>
  );
}

export function meta(): Route.MetaDescriptors {
  return [{ name: "robots", content: "noindex" }];
}
