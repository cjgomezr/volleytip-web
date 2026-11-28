import type { ReactElement } from "react";
import { data } from "react-router";

import { PanelShell } from "~/components/panel/panel-shell";
import { SampleTeamScreen } from "~/components/panel/team/sample-team-screen";
import { ADMIN_MODULES, type AdminModule } from "~/lib/admin/modules";
import {
  buildSampleTeam,
  SAMPLE_TEAM_STATES,
  type SampleTeam,
} from "~/lib/admin/sample-team";
import { serverEnv } from "~/lib/env.server";
import { getRequestLanguage } from "~/lib/i18n/languages";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useLanguage } from "~/lib/i18n/use-language";

import type { Route } from "./+types/dev-team";

// Pinta la lista del equipo, la invitación y la confirmación en cada estado,
// sin sesión ni base, para capturarlos en Playwright:
// `?estado=` con uno de `SAMPLE_TEAM_STATES`.
// Solo pinta: sus formularios apuntan al panel de verdad. En producción
// responde 404.
const NOT_FOUND_STATUS = 404;
const STATE_PARAM = "estado";

export function loader({ request }: Route.LoaderArgs): SampleTeam {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const asked = new URL(request.url).searchParams.get(STATE_PARAM) ?? "lista";
  const state = SAMPLE_TEAM_STATES.find((candidate) => candidate === asked);
  if (state === undefined) throw data(null, { status: NOT_FOUND_STATUS });
  return buildSampleTeam(state, getRequestLanguage(request));
}

// El menú real, con "Equipo" apuntando aquí para que salga marcado.
const SAMPLE_MENU: readonly AdminModule[] = ADMIN_MODULES.map((module) =>
  module.id === "team"
    ? {
        ...module,
        page: {
          id: "sample-team",
          file: "routes/dev-team.tsx",
          path: "dev/equipo",
        },
      }
    : module,
);

export default function DevTeam({
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
      <SampleTeamScreen {...loaderData} />
    </PanelShell>
  );
}

export function meta(): Route.MetaDescriptors {
  return [{ name: "robots", content: "noindex" }];
}
